/**
 * Session duration widget - displays how long the session has been running
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, SessionDurationData } from '../types.js';
import { COLORS, colorize } from '../utils/colors.js';
import { formatDuration } from '../utils/formatters.js';

const SESSION_DIR = join(homedir(), '.cache', 'claude-dashboard', 'sessions');

/**
 * Get or create session start time
 */
async function getSessionStartTime(sessionId: string): Promise<number> {
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

export const sessionDurationWidget: Widget<SessionDurationData> = {
  id: 'sessionDuration',
  name: 'Session Duration',

  async getData(ctx: WidgetContext): Promise<SessionDurationData | null> {
    // Use session_id if available, otherwise use a default
    const sessionId = ctx.stdin.session_id || 'default';
    const startTime = await getSessionStartTime(sessionId);
    const elapsedMs = Date.now() - startTime;

    return { elapsedMs };
  },

  render(data: SessionDurationData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const duration = formatDuration(data.elapsedMs, t.time);
    return colorize(`⏱ ${duration}`, COLORS.dim);
  },
};
