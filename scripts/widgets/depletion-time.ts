/**
 * Depletion time widget - estimates time until rate limit is reached
 */

import type { Widget } from './base.js';
import type { WidgetContext, DepletionTimeData } from '../types.js';
import { COLORS, colorize } from '../utils/colors.js';
import { formatDuration } from '../utils/formatters.js';
import { getSessionElapsedMs } from '../utils/session.js';

export const depletionTimeWidget: Widget<DepletionTimeData> = {
  id: 'depletionTime',
  name: 'Depletion Time',

  async getData(ctx: WidgetContext): Promise<DepletionTimeData | null> {
    const limits = ctx.rateLimits;
    if (!limits?.five_hour) return null;

    const utilization = limits.five_hour.utilization;

    // If utilization is 0 or very low, we can't estimate
    if (utilization < 1) return null;

    // Get session elapsed time
    const sessionId = ctx.stdin.session_id || 'default';
    const elapsedMs = await getSessionElapsedMs(sessionId);
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Need at least 1 minute of session time to estimate
    if (elapsedMinutes < 1) return null;

    // Calculate utilization rate per minute
    // This assumes all current utilization was from this session (approximation)
    const utilizationPerMinute = utilization / elapsedMinutes;

    // If rate is too low, don't show (would be misleading)
    if (utilizationPerMinute < 0.01) return null;

    // Calculate minutes until 100%
    const remainingUtilization = 100 - utilization;
    const minutesToLimit = remainingUtilization / utilizationPerMinute;

    // If more than 24 hours, don't show (too uncertain)
    if (minutesToLimit > 24 * 60) return null;

    return {
      minutesToLimit: Math.round(minutesToLimit),
      limitType: '5h',
    };
  },

  render(data: DepletionTimeData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const duration = formatDuration(data.minutesToLimit * 60 * 1000, t.time);
    return colorize(`⏳ ~${duration} to ${data.limitType}`, COLORS.yellow);
  },
};
