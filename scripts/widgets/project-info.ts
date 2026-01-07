/**
 * Project info widget - displays directory name and git branch
 */

import { execFileSync } from 'child_process';
import { basename } from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, ProjectInfoData } from '../types.js';
import { COLORS, RESET, colorize } from '../utils/colors.js';

/**
 * Get current git branch with timeout
 */
function getGitBranch(cwd: string): string | undefined {
  try {
    const result = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      timeout: 500, // 500ms timeout to prevent blocking
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || undefined;
  } catch {
    // Not a git repo or git not available
    return undefined;
  }
}

export const projectInfoWidget: Widget<ProjectInfoData> = {
  id: 'projectInfo',
  name: 'Project Info',

  async getData(ctx: WidgetContext): Promise<ProjectInfoData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }

    const dirName = basename(currentDir);
    const gitBranch = getGitBranch(currentDir);

    return {
      dirName,
      gitBranch,
    };
  },

  render(data: ProjectInfoData): string {
    const parts: string[] = [];

    // Directory name with folder icon
    parts.push(colorize(`📁 ${data.dirName}`, COLORS.cyan));

    // Git branch in parentheses
    if (data.gitBranch) {
      parts.push(colorize(`(${data.gitBranch})`, COLORS.magenta));
    }

    return parts.join(' ');
  },
};
