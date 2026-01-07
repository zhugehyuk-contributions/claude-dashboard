/**
 * Rate limit widgets - displays 5h and 7d usage limits
 */

import type { Widget } from './base.js';
import type { WidgetContext, RateLimitData } from '../types.js';
import { COLORS, getColorForPercent, colorize } from '../utils/colors.js';
import { formatTimeRemaining } from '../utils/formatters.js';

/**
 * 5-hour rate limit widget
 */
export const rateLimit5hWidget: Widget<RateLimitData> = {
  id: 'rateLimit5h',
  name: '5h Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    const limits = ctx.rateLimits;
    if (!limits?.five_hour) {
      return null;
    }

    return {
      utilization: Math.round(limits.five_hour.utilization),
      resetsAt: limits.five_hour.resets_at,
    };
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const color = getColorForPercent(data.utilization);
    let text = `${t.labels['5h']}: ${colorize(`${data.utilization}%`, color)}`;

    // Add reset time if available
    if (data.resetsAt) {
      const remaining = formatTimeRemaining(data.resetsAt, t);
      text += ` (${remaining})`;
    }

    return text;
  },
};

/**
 * 7-day rate limit widget (Max plan only)
 */
export const rateLimit7dWidget: Widget<RateLimitData> = {
  id: 'rateLimit7d',
  name: '7d Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    // Only show for Max plan
    if (ctx.config.plan !== 'max') {
      return null;
    }

    const limits = ctx.rateLimits;
    if (!limits?.seven_day) {
      return null;
    }

    return {
      utilization: Math.round(limits.seven_day.utilization),
      resetsAt: limits.seven_day.resets_at,
    };
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const color = getColorForPercent(data.utilization);
    return `${t.labels['7d_all']}: ${colorize(`${data.utilization}%`, color)}`;
  },
};

/**
 * 7-day Sonnet-only rate limit widget (Max plan only)
 */
export const rateLimit7dSonnetWidget: Widget<RateLimitData> = {
  id: 'rateLimit7dSonnet',
  name: '7d Sonnet Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    // Only show for Max plan
    if (ctx.config.plan !== 'max') {
      return null;
    }

    const limits = ctx.rateLimits;
    if (!limits?.seven_day_sonnet) {
      return null;
    }

    return {
      utilization: Math.round(limits.seven_day_sonnet.utilization),
      resetsAt: limits.seven_day_sonnet.resets_at,
    };
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const color = getColorForPercent(data.utilization);
    return `${t.labels['7d_sonnet']}: ${colorize(`${data.utilization}%`, color)}`;
  },
};
