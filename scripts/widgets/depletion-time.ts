/**
 * Depletion time widget - estimates time until rate limit is reached
 */

import type { Widget } from './base.js';
import type { WidgetContext, DepletionTimeData } from '../types.js';
import { COLORS, colorize } from '../utils/colors.js';
import { formatDuration } from '../utils/formatters.js';
import { getSessionElapsedMinutes } from '../utils/session.js';

const MAX_DISPLAY_MINUTES = 24 * 60;
const MIN_UTILIZATION_RATE = 0.01;

export const depletionTimeWidget: Widget<DepletionTimeData> = {
  id: 'depletionTime',
  name: 'Depletion Time',

  async getData(ctx: WidgetContext): Promise<DepletionTimeData | null> {
    const utilization = ctx.rateLimits?.five_hour?.utilization;
    if (!utilization || utilization < 1) return null;

    const elapsedMinutes = await getSessionElapsedMinutes(ctx);
    if (!elapsedMinutes) return null;

    // Calculate utilization rate per minute (approximation: assumes all usage from this session)
    const utilizationPerMinute = utilization / elapsedMinutes;
    if (utilizationPerMinute < MIN_UTILIZATION_RATE) return null;

    const minutesToLimit = (100 - utilization) / utilizationPerMinute;
    if (minutesToLimit > MAX_DISPLAY_MINUTES) return null;

    return {
      minutesToLimit: Math.round(minutesToLimit),
      limitType: '5h',
    };
  },

  render(data: DepletionTimeData, ctx: WidgetContext): string {
    const duration = formatDuration(data.minutesToLimit * 60 * 1000, ctx.translations.time);
    return colorize(`⏳ ~${duration} to ${data.limitType}`, COLORS.yellow);
  },
};
