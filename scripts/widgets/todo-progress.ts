/**
 * Todo progress widget - displays current task and completion rate
 */

import type { Widget } from './base.js';
import type { WidgetContext, TodoProgressData } from '../types.js';
import { COLORS, colorize, getColorForPercent } from '../utils/colors.js';
import { parseTranscript, extractTodoProgress } from '../utils/transcript-parser.js';
import { calculatePercent } from '../utils/formatters.js';

export const todoProgressWidget: Widget<TodoProgressData> = {
  id: 'todoProgress',
  name: 'Todo Progress',

  async getData(ctx: WidgetContext): Promise<TodoProgressData | null> {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) {
      return null;
    }

    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) {
      return null;
    }

    const progress = extractTodoProgress(transcript);
    if (!progress) {
      return null;
    }

    return progress;
  },

  render(data: TodoProgressData, ctx: WidgetContext): string {
    const { translations: t } = ctx;

    if (data.total === 0) {
      return '';
    }

    const percent = calculatePercent(data.completed, data.total);
    const color = getColorForPercent(100 - percent); // Invert: lower completion = more red

    // Format: ✓ 3/5 or ✓ Task name [3/5]
    if (data.current) {
      const taskName =
        data.current.content.length > 15
          ? data.current.content.slice(0, 15) + '...'
          : data.current.content;
      return `${colorize('✓', COLORS.green)} ${taskName} [${data.completed}/${data.total}]`;
    }

    // All done or no current task
    return colorize(
      `${t.widgets.todos}: ${data.completed}/${data.total}`,
      data.completed === data.total ? COLORS.green : color
    );
  },
};
