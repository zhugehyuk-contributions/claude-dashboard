/**
 * Gemini CLI API client
 * Fetches usage limits from Google Code Assist API
 */

import { readFile, stat } from 'fs/promises';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import type { GeminiUsageLimits, CacheEntry } from '../types.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';

const API_TIMEOUT_MS = 5000;
const GEMINI_DIR = '.gemini';
const OAUTH_CREDS_FILE = 'oauth_creds.json';
const SETTINGS_FILE = 'settings.json';
const KEYCHAIN_SERVICE_NAME = 'gemini-cli-oauth';
const MAIN_ACCOUNT_KEY = 'main-account';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

/**
 * In-memory cache for Gemini usage
 */
const geminiCacheMap: Map<string, CacheEntry<GeminiUsageLimits>> = new Map();

/**
 * Pending API requests to prevent duplicates
 */
const pendingRequests: Map<string, Promise<GeminiUsageLimits | null>> = new Map();

/**
 * Cached OAuth credentials with mtime tracking
 */
let cachedCredentials: { data: GeminiCredentials; mtime: number } | null = null;

/**
 * Cached settings with mtime tracking
 */
let cachedSettings: { data: GeminiSettings; mtime: number } | null = null;

interface GeminiCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface GeminiSettings {
  cloudaicompanionProject?: string;
  selectedModel?: string;
  auth?: {
    type?: string;
  };
}

interface LoadCodeAssistResponse {
  currentTier?: {
    id: string;
    name?: string;
  } | null;
  cloudaicompanionProject?: string | null;
}

interface BucketInfo {
  remainingAmount?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
  modelId?: string;
}

interface RetrieveUserQuotaResponse {
  buckets?: BucketInfo[];
}

/**
 * Get Gemini directory path
 */
function getGeminiDir(): string {
  return path.join(os.homedir(), GEMINI_DIR);
}

/**
 * Check if Gemini CLI is installed (has credentials)
 */
export async function isGeminiInstalled(): Promise<boolean> {
  try {
    // Check for keychain first
    const keychainToken = await getTokenFromKeychain();
    if (keychainToken) {
      return true;
    }

    // Fallback to file
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    await stat(oauthPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get OAuth token from macOS Keychain using security command
 * Uses execFileSync to prevent shell injection vulnerabilities
 */
async function getTokenFromKeychain(): Promise<GeminiCredentials | null> {
  if (os.platform() !== 'darwin') {
    return null;
  }

  try {
    // Use security command to get password from keychain
    // execFileSync is used instead of execSync for security
    const result = execFileSync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE_NAME, '-a', MAIN_ACCOUNT_KEY, '-w'],
      { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!result) {
      return null;
    }

    // Parse the stored JSON
    const stored = JSON.parse(result);
    if (!stored.token?.accessToken) {
      return null;
    }

    return {
      accessToken: stored.token.accessToken,
      refreshToken: stored.token.refreshToken,
      expiryDate: stored.token.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get OAuth credentials from file fallback
 */
async function getCredentialsFromFile(): Promise<GeminiCredentials | null> {
  try {
    const oauthPath = path.join(getGeminiDir(), OAUTH_CREDS_FILE);
    const fileStat = await stat(oauthPath);

    // Use cached credentials if file hasn't changed
    if (cachedCredentials && cachedCredentials.mtime === fileStat.mtimeMs) {
      return cachedCredentials.data;
    }

    const raw = await readFile(oauthPath, 'utf-8');
    const json = JSON.parse(raw);

    const accessToken = json?.access_token;
    if (!accessToken) {
      return null;
    }

    const data: GeminiCredentials = {
      accessToken,
      refreshToken: json?.refresh_token,
      expiryDate: json?.expiry_date,
    };

    cachedCredentials = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get Gemini OAuth credentials (Keychain first, then file fallback)
 */
async function getGeminiCredentials(): Promise<GeminiCredentials | null> {
  // Try keychain first
  const keychainCreds = await getTokenFromKeychain();
  if (keychainCreds) {
    return keychainCreds;
  }

  // Fallback to file
  return getCredentialsFromFile();
}

/**
 * Cached project ID from loadCodeAssist API
 */
let cachedProjectId: { data: string; timestamp: number } | null = null;
const PROJECT_ID_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get Gemini settings from ~/.gemini/settings.json
 */
async function getGeminiSettings(): Promise<GeminiSettings | null> {
  try {
    const settingsPath = path.join(getGeminiDir(), SETTINGS_FILE);
    const fileStat = await stat(settingsPath);

    // Use cached settings if file hasn't changed
    if (cachedSettings && cachedSettings.mtime === fileStat.mtimeMs) {
      return cachedSettings.data;
    }

    const raw = await readFile(settingsPath, 'utf-8');
    const json = JSON.parse(raw);

    const data: GeminiSettings = {
      cloudaicompanionProject: json?.cloudaicompanionProject,
      selectedModel: json?.selectedModel || json?.model,
      auth: json?.auth,
    };

    cachedSettings = { data, mtime: fileStat.mtimeMs };
    return data;
  } catch {
    return null;
  }
}

/**
 * Get current Gemini model from settings
 */
export async function getGeminiModel(): Promise<string | null> {
  const settings = await getGeminiSettings();
  return settings?.selectedModel ?? null;
}

/**
 * Get project ID via loadCodeAssist API
 * Falls back to environment variable or settings
 */
async function getProjectId(credentials: GeminiCredentials): Promise<string | null> {
  // Check environment variable first
  const envProjectId = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT_ID'];
  if (envProjectId) {
    return envProjectId;
  }

  // Check settings file
  const settings = await getGeminiSettings();
  if (settings?.cloudaicompanionProject) {
    return settings.cloudaicompanionProject;
  }

  // Check cache
  if (cachedProjectId && (Date.now() - cachedProjectId.timestamp) < PROJECT_ID_CACHE_TTL_MS) {
    return cachedProjectId.data;
  }

  // Fetch from loadCodeAssist API
  try {
    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:loadCodeAssist`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'GEMINI_CLI',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      debugLog('gemini', 'loadCodeAssist: response not ok', response.status);
      return null;
    }

    const data = await response.json() as LoadCodeAssistResponse;
    const projectId = data?.cloudaicompanionProject;

    if (projectId) {
      cachedProjectId = { data: projectId, timestamp: Date.now() };
      return projectId;
    }
  } catch (err) {
    debugLog('gemini', 'loadCodeAssist error:', err);
  }

  return null;
}

/**
 * Fetch Gemini usage limits
 */
export async function fetchGeminiUsage(ttlSeconds: number = 60): Promise<GeminiUsageLimits | null> {
  const credentials = await getGeminiCredentials();
  if (!credentials) {
    debugLog('gemini', 'fetchGeminiUsage: no credentials found');
    return null;
  }

  // Check if token is expired
  if (credentials.expiryDate && credentials.expiryDate < Date.now()) {
    debugLog('gemini', 'fetchGeminiUsage: token expired');
    return null;
  }

  const projectId = await getProjectId(credentials);
  if (!projectId) {
    debugLog('gemini', 'fetchGeminiUsage: no project ID found');
    return null;
  }

  const tokenHash = hashToken(credentials.accessToken);

  // Check memory cache
  const cached = geminiCacheMap.get(tokenHash);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) {
      debugLog('gemini', 'fetchGeminiUsage: returning cached data');
      return cached.data;
    }
  }

  // Check pending request
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = fetchFromGeminiApi(credentials, projectId);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Internal API fetch
 */
async function fetchFromGeminiApi(
  credentials: GeminiCredentials,
  projectId: string
): Promise<GeminiUsageLimits | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    debugLog('gemini', 'fetchFromGeminiApi: starting...');

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:retrieveUserQuota`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        project: projectId,
      }),
      signal: controller.signal,
    });

    debugLog('gemini', 'fetchFromGeminiApi: response status', response.status);

    if (!response.ok) {
      debugLog('gemini', 'fetchFromGeminiApi: response not ok');
      return null;
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      debugLog('gemini', 'fetchFromGeminiApi: invalid response - not an object');
      return null;
    }

    const typedData = data as RetrieveUserQuotaResponse;
    debugLog('gemini', 'fetchFromGeminiApi: got data', typedData.buckets?.length || 0, 'buckets');

    const model = await getGeminiModel();

    // Process buckets - find current model and aggregate
    let primaryBucket: BucketInfo | null = null;
    let currentModelBucket: BucketInfo | null = null;

    if (typedData.buckets && Array.isArray(typedData.buckets)) {
      for (const bucket of typedData.buckets) {
        // Find bucket for current model
        if (model && bucket.modelId && bucket.modelId.includes(model)) {
          currentModelBucket = bucket;
        }
        // Use first bucket as primary if no model match
        if (!primaryBucket) {
          primaryBucket = bucket;
        }
      }
    }

    // Use current model bucket if found, otherwise primary
    const activeBucket = currentModelBucket || primaryBucket;

    // Use settings model, or fall back to first bucket's model
    const displayModel = model ?? activeBucket?.modelId ?? 'unknown';

    const limits: GeminiUsageLimits = {
      model: displayModel,
      // remainingFraction is remaining, so usage = 1 - remaining
      usedPercent: activeBucket?.remainingFraction !== undefined
        ? Math.round((1 - activeBucket.remainingFraction) * 100)
        : null,
      resetAt: activeBucket?.resetTime ?? null,
      buckets: typedData.buckets?.map(b => ({
        modelId: b.modelId,
        usedPercent: b.remainingFraction !== undefined
          ? Math.round((1 - b.remainingFraction) * 100)
          : null,
        resetAt: b.resetTime ?? null,
      })) ?? [],
    };

    // Update cache
    const tokenHash = hashToken(credentials.accessToken);
    geminiCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    debugLog('gemini', 'fetchFromGeminiApi: success', limits);

    return limits;
  } catch (err) {
    debugLog('gemini', 'fetchFromGeminiApi: error', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Clear cache (for testing)
 */
export function clearGeminiCache(): void {
  geminiCacheMap.clear();
  cachedCredentials = null;
  cachedSettings = null;
  cachedProjectId = null;
}
