/**
 * Burn rate widget - displays tokens consumed per minute
 */

import type { Widget } from './base.js';
import type { WidgetContext, BurnRateData } from '../types.js';
import { formatTokens } from '../utils/formatters.js';
import { getSessionElapsedMinutes } from '../utils/session.js';

export const burnRateWidget: Widget<BurnRateData> = {
  id: 'burnRate',
  name: 'Burn Rate',

  async getData(ctx: WidgetContext): Promise<BurnRateData | null> {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) return null;

    const elapsedMinutes = await getSessionElapsedMinutes(ctx);
    if (!elapsedMinutes) return null;

    const totalTokens =
      usage.input_tokens +
      usage.output_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;

    const tokensPerMinute = totalTokens / elapsedMinutes;

    return { tokensPerMinute };
  },

  render(data: BurnRateData): string {
    return `🔥 ${formatTokens(Math.round(data.tokensPerMinute))}/min`;
  },
};
