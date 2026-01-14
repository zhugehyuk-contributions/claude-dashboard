/**
 * Session utilities - shared session time management
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { WidgetContext } from '../types.js';

const SESSION_DIR = join(homedir(), '.cache', 'claude-dashboard', 'sessions');

/**
 * Get or create session start time
 */
export async function getSessionStartTime(sessionId: string): Promise<number> {
  const sessionFile = join(SESSION_DIR, `${sessionId}.json`);

  const content = await readFile(sessionFile, 'utf-8').catch(() => null);
  if (content) {
    const data = JSON.parse(content);
    return data.startTime;
  }

  const startTime = Date.now();
  await mkdir(SESSION_DIR, { recursive: true }).catch(() => {});
  await writeFile(sessionFile, JSON.stringify({ startTime }), 'utf-8').catch(() => {});
  return startTime;
}

/**
 * Get session elapsed time in milliseconds
 */
export async function getSessionElapsedMs(sessionId: string): Promise<number> {
  const startTime = await getSessionStartTime(sessionId);
  return Date.now() - startTime;
}

/**
 * Get session elapsed minutes from context
 * Returns null if session is less than minMinutes old
 */
export async function getSessionElapsedMinutes(
  ctx: WidgetContext,
  minMinutes = 1
): Promise<number | null> {
  const sessionId = ctx.stdin.session_id || 'default';
  const elapsedMs = await getSessionElapsedMs(sessionId);
  const elapsedMinutes = elapsedMs / (1000 * 60);

  if (elapsedMinutes < minMinutes) return null;
  return elapsedMinutes;
}
