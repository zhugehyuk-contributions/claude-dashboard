import fs from 'fs';
import type { UsageLimits, CacheEntry } from '../types.js';
import { getCredentials } from './credentials.js';
import { hashToken } from './hash.js';
import { VERSION } from '../version.js';

const API_TIMEOUT_MS = 5000;
const CACHE_FILE_PREFIX = '/tmp/claude-dashboard-cache-';

/**
 * In-memory cache Map: tokenHash -> CacheEntry
 */
const usageCacheMap: Map<string, CacheEntry<UsageLimits>> = new Map();

/**
 * Get cache file path for a specific token hash
 */
function getCacheFilePath(tokenHash: string): string {
  return `${CACHE_FILE_PREFIX}${tokenHash}.json`;
}

/**
 * Check if cache is still valid for given token
 */
function isCacheValid(tokenHash: string, ttlSeconds: number): boolean {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache) return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1000;
  return ageSeconds < ttlSeconds;
}

/**
 * Fetch usage limits from Anthropic API
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 60)
 * @returns Usage limits or null if failed
 */
export async function fetchUsageLimits(ttlSeconds: number = 60): Promise<UsageLimits | null> {
  // Get token first to determine cache key
  const token = await getCredentials();
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  // Check memory cache first
  if (isCacheValid(tokenHash, ttlSeconds)) {
    return usageCacheMap.get(tokenHash)!.data;
  }

  // Try to load from file cache (for persistence across calls)
  const fileCache = await loadFileCache(tokenHash, ttlSeconds);
  if (fileCache) {
    usageCacheMap.set(tokenHash, { data: fileCache, timestamp: Date.now() });
    return fileCache;
  }

  // Fetch from API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `claude-dashboard/${VERSION}`,
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const limits: UsageLimits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null,
    };

    // Update caches
    usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
    await saveFileCache(tokenHash, limits);

    return limits;
  } catch {
    return null;
  }
}

/**
 * Load cache from file for specific token
 */
async function loadFileCache(tokenHash: string, ttlSeconds: number): Promise<UsageLimits | null> {
  try {
    const cacheFile = getCacheFilePath(tokenHash);
    if (!fs.existsSync(cacheFile)) return null;

    const content = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const ageSeconds = (Date.now() - content.timestamp) / 1000;

    if (ageSeconds < ttlSeconds) {
      return content.data as UsageLimits;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save cache to file for specific token
 */
async function saveFileCache(tokenHash: string, data: UsageLimits): Promise<void> {
  try {
    const cacheFile = getCacheFilePath(tokenHash);
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache(): void {
  usageCacheMap.clear();
}
