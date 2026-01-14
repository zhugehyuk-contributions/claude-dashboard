/**
 * Burn rate widget - displays tokens consumed per minute
 */

import type { Widget } from './base.js';
import type { WidgetContext, BurnRateData } from '../types.js';
import { formatTokens } from '../utils/formatters.js';
import { getSessionElapsedMs } from '../utils/session.js';

export const burnRateWidget: Widget<BurnRateData> = {
  id: 'burnRate',
  name: 'Burn Rate',

  async getData(ctx: WidgetContext): Promise<BurnRateData | null> {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) return null;

    const totalTokens =
      usage.input_tokens +
      usage.output_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;

    // Get session elapsed time
    const sessionId = ctx.stdin.session_id || 'default';
    const elapsedMs = await getSessionElapsedMs(sessionId);
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Don't show burn rate if session is less than 1 minute old
    if (elapsedMinutes < 1) return null;

    const tokensPerMinute = totalTokens / elapsedMinutes;

    return { tokensPerMinute };
  },

  render(data: BurnRateData): string {
    return `🔥 ${formatTokens(Math.round(data.tokensPerMinute))}/min`;
  },
};
