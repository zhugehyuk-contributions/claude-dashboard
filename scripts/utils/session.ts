/**
 * Session utilities - shared session time management
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const SESSION_DIR = join(homedir(), '.cache', 'claude-dashboard', 'sessions');

/**
 * Get or create session start time
 */
export async function getSessionStartTime(sessionId: string): Promise<number> {
  const sessionFile = join(SESSION_DIR, `${sessionId}.json`);

  try {
    const content = await readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);
    return data.startTime;
  } catch {
    // Session file doesn't exist, create it
    const startTime = Date.now();
    try {
      await mkdir(SESSION_DIR, { recursive: true });
      await writeFile(sessionFile, JSON.stringify({ startTime }), 'utf-8');
    } catch {
      // Ignore write errors
    }
    return startTime;
  }
}

/**
 * Get session elapsed time in milliseconds
 */
export async function getSessionElapsedMs(sessionId: string): Promise<number> {
  const startTime = await getSessionStartTime(sessionId);
  return Date.now() - startTime;
}
