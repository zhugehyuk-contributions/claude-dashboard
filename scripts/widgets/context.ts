/**
 * Context widget - displays progress bar, percentage, and token count
 */

import type { Widget } from './base.js';
import type { WidgetContext, ContextData } from '../types.js';
import { COLORS, RESET, getColorForPercent, colorize } from '../utils/colors.js';
import { formatTokens, calculatePercent } from '../utils/formatters.js';
import { renderProgressBar } from '../utils/progress-bar.js';

export const contextWidget: Widget<ContextData> = {
  id: 'context',
  name: 'Context',

  async getData(ctx: WidgetContext): Promise<ContextData | null> {
    const { context_window } = ctx.stdin;
    const usage = context_window?.current_usage;

    if (!usage) {
      return null;
    }

    const inputTokens =
      usage.input_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const contextSize = context_window.context_window_size;
    const percentage = calculatePercent(inputTokens, contextSize);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      contextSize,
      percentage,
    };
  },

  render(data: ContextData): string {
    const parts: string[] = [];

    // Progress bar
    parts.push(renderProgressBar(data.percentage));

    // Percentage with color
    const percentColor = getColorForPercent(data.percentage);
    parts.push(colorize(`${data.percentage}%`, percentColor));

    // Token count (input tokens / context size)
    parts.push(
      `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`
    );

    const separator = ` ${COLORS.dim}│${RESET} `;
    return parts.join(separator);
  },
};
