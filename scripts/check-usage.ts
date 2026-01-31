#!/usr/bin/env node
/**
 * CLI Usage Dashboard
 * Displays usage limits for all AI CLIs (Claude, Codex, Gemini, z.ai)
 * and recommends the one with the most available capacity.
 */

import { fetchUsageLimits } from './utils/api-client.js';
import { fetchCodexUsage, isCodexInstalled } from './utils/codex-client.js';
import { fetchGeminiUsage, isGeminiInstalled } from './utils/gemini-client.js';
import { fetchZaiUsage, isZaiInstalled, type ZaiUsageLimits } from './utils/zai-api-client.js';
import { formatTimeRemaining } from './utils/formatters.js';
import { getColorForPercent, colorize, COLORS } from './utils/colors.js';
import { getTranslationsByLang, detectSystemLanguage } from './utils/i18n.js';
import type { UsageLimits, CodexUsageLimits, GeminiUsageLimits, Translations } from './types.js';

interface CLIUsage {
  name: string;
  available: boolean;
  error: boolean;
  fiveHourPercent: number | null;
  sevenDayPercent: number | null;
  fiveHourReset: string | null;
  sevenDayReset: string | null;
  model?: string;
  plan?: string;
}

interface CheckUsageOutput {
  claude: CLIUsage;
  codex: CLIUsage | null;
  gemini: CLIUsage | null;
  zai: CLIUsage | null;
  recommendation: string | null;
  recommendationReason: string;
}

const BOX_WIDTH = 40;

/**
 * Format time remaining from Unix timestamp in milliseconds
 */
function formatTimeFromTimestampMs(resetAtMs: number, t: Translations): string {
  const resetDate = new Date(resetAtMs);
  return formatTimeRemaining(resetDate, t);
}

/**
 * Format time remaining from Unix timestamp in seconds (Codex style)
 */
function formatTimeFromTimestamp(resetAt: number, t: Translations): string {
  const resetDate = new Date(resetAt * 1000);
  return formatTimeRemaining(resetDate, t);
}

/**
 * Render horizontal line
 */
function renderLine(char: string = '═'): string {
  return char.repeat(BOX_WIDTH);
}

/**
 * Render centered title
 */
function renderTitle(title: string): string {
  const padding = Math.max(0, Math.floor((BOX_WIDTH - title.length) / 2));
  return ' '.repeat(padding) + colorize(title, COLORS.bold);
}

/**
 * Render a CLI section
 */
function renderCLISection(
  name: string,
  usage: CLIUsage,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize(`[${name}]`, COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize('(not installed)', COLORS.gray)}`);
    return lines;
  }

  if (usage.error) {
    lines.push(`${label} ${colorize('⚠️ Error fetching data', COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // 5h usage
  if (usage.fiveHourPercent !== null) {
    const color5h = getColorForPercent(usage.fiveHourPercent);
    const reset5h = usage.fiveHourReset
      ? ` (${formatTimeRemaining(usage.fiveHourReset, t)})`
      : '';
    parts.push(`${t.labels['5h']}: ${colorize(`${usage.fiveHourPercent}%`, color5h)}${reset5h}`);
  }

  // 7d usage
  if (usage.sevenDayPercent !== null) {
    const color7d = getColorForPercent(usage.sevenDayPercent);
    const reset7d = usage.sevenDayReset
      ? ` (${formatTimeRemaining(usage.sevenDayReset, t)})`
      : '';
    parts.push(`${t.labels['7d']}: ${colorize(`${usage.sevenDayPercent}%`, color7d)}${reset7d}`);
  }

  // Plan info (for Codex)
  if (usage.plan) {
    parts.push(`Plan: ${colorize(usage.plan, COLORS.pastelGray)}`);
  }

  // Model info (for Gemini)
  if (usage.model && name === 'Gemini') {
    parts.push(`Model: ${colorize(usage.model, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Render Codex-specific section with timestamp-based reset
 */
function renderCodexSection(
  usage: CLIUsage,
  codexData: CodexUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[Codex]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize('(not installed)', COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !codexData) {
    lines.push(`${label} ${colorize('⚠️ Error fetching data', COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // 5h usage (primary window)
  if (codexData.primary) {
    const percent = Math.round(codexData.primary.usedPercent);
    const color5h = getColorForPercent(percent);
    const reset5h = formatTimeFromTimestamp(codexData.primary.resetAt, t);
    parts.push(`${t.labels['5h']}: ${colorize(`${percent}%`, color5h)} (${reset5h})`);
  }

  // 7d usage (secondary window)
  if (codexData.secondary) {
    const percent = Math.round(codexData.secondary.usedPercent);
    const color7d = getColorForPercent(percent);
    const reset7d = formatTimeFromTimestamp(codexData.secondary.resetAt, t);
    parts.push(`${t.labels['7d']}: ${colorize(`${percent}%`, color7d)} (${reset7d})`);
  }

  // Plan info
  if (codexData.planType) {
    parts.push(`Plan: ${colorize(codexData.planType, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Render Gemini-specific section
 */
function renderGeminiSection(
  usage: CLIUsage,
  geminiData: GeminiUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[Gemini]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize('(not installed)', COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !geminiData) {
    lines.push(`${label} ${colorize('⚠️ Error fetching data', COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // Usage percentage
  if (geminiData.usedPercent !== null) {
    const color = getColorForPercent(geminiData.usedPercent);
    const reset = geminiData.resetAt
      ? ` (${formatTimeRemaining(geminiData.resetAt, t)})`
      : '';
    parts.push(`Used: ${colorize(`${geminiData.usedPercent}%`, color)}${reset}`);
  }

  // Model info
  if (geminiData.model) {
    parts.push(`Model: ${colorize(geminiData.model, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Render z.ai-specific section
 */
function renderZaiSection(
  usage: CLIUsage,
  zaiData: ZaiUsageLimits | null,
  t: Translations
): string[] {
  const lines: string[] = [];
  const label = colorize('[z.ai]', COLORS.pastelCyan);

  if (!usage.available) {
    lines.push(`${label} ${colorize('(not configured)', COLORS.gray)}`);
    return lines;
  }

  if (usage.error || !zaiData) {
    lines.push(`${label} ${colorize('⚠️ Error fetching data', COLORS.pastelYellow)}`);
    return lines;
  }

  const parts: string[] = [];

  // Token usage (5h equivalent)
  if (zaiData.tokensPercent !== null) {
    const color = getColorForPercent(zaiData.tokensPercent);
    const reset = zaiData.tokensResetAt
      ? ` (${formatTimeFromTimestampMs(zaiData.tokensResetAt, t)})`
      : '';
    parts.push(`Tokens: ${colorize(`${zaiData.tokensPercent}%`, color)}${reset}`);
  }

  // MCP usage (monthly)
  if (zaiData.mcpPercent !== null) {
    const color = getColorForPercent(zaiData.mcpPercent);
    const reset = zaiData.mcpResetAt
      ? ` (${formatTimeFromTimestampMs(zaiData.mcpResetAt, t)})`
      : '';
    parts.push(`MCP: ${colorize(`${zaiData.mcpPercent}%`, color)}${reset}`);
  }

  // Model info
  if (zaiData.model) {
    parts.push(`Model: ${colorize(zaiData.model, COLORS.pastelGray)}`);
  }

  lines.push(`${label}`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join('  |  ')}`);
  }

  return lines;
}

/**
 * Calculate recommendation based on lowest usage
 */
function calculateRecommendation(
  claudeUsage: CLIUsage,
  codexUsage: CLIUsage | null,
  geminiUsage: CLIUsage | null,
  zaiUsage: CLIUsage | null,
  lang: 'en' | 'ko'
): { name: string | null; reason: string } {
  const candidates: { name: string; score: number }[] = [];

  // Claude score (lower is better - using 5h as primary metric)
  if (!claudeUsage.error && claudeUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'claude', score: claudeUsage.fiveHourPercent });
  }

  // Codex score
  if (codexUsage && codexUsage.available && !codexUsage.error && codexUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'codex', score: codexUsage.fiveHourPercent });
  }

  // Gemini score (uses single usage percent)
  if (geminiUsage && geminiUsage.available && !geminiUsage.error && geminiUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'gemini', score: geminiUsage.fiveHourPercent });
  }

  // z.ai score (uses token percent as primary metric)
  if (zaiUsage && zaiUsage.available && !zaiUsage.error && zaiUsage.fiveHourPercent !== null) {
    candidates.push({ name: 'z.ai', score: zaiUsage.fiveHourPercent });
  }

  if (candidates.length === 0) {
    return {
      name: null,
      reason: lang === 'ko' ? '사용량 데이터 없음' : 'No usage data available',
    };
  }

  // Sort by score (ascending - lower usage is better)
  candidates.sort((a, b) => a.score - b.score);

  const best = candidates[0];
  const reason = lang === 'ko'
    ? `가장 여유 (${best.score}% 사용)`
    : `Lowest usage (${best.score}% used)`;

  return { name: best.name, reason };
}

/**
 * Parse Claude usage limits
 * Note: API returns utilization as percentage (0-100), not fraction (0-1)
 */
function parseClaudeUsage(limits: UsageLimits | null): CLIUsage {
  if (!limits) {
    return {
      name: 'Claude',
      available: true,
      error: true,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  return {
    name: 'Claude',
    available: true,
    error: false,
    fiveHourPercent: limits.five_hour ? Math.round(limits.five_hour.utilization) : null,
    sevenDayPercent: limits.seven_day ? Math.round(limits.seven_day.utilization) : null,
    fiveHourReset: limits.five_hour?.resets_at ?? null,
    sevenDayReset: limits.seven_day?.resets_at ?? null,
  };
}

/**
 * Parse Codex usage limits
 */
function parseCodexUsage(limits: CodexUsageLimits | null, installed: boolean): CLIUsage {
  if (!installed) {
    return {
      name: 'Codex',
      available: false,
      error: false,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  if (!limits) {
    return {
      name: 'Codex',
      available: true,
      error: true,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  return {
    name: 'Codex',
    available: true,
    error: false,
    fiveHourPercent: limits.primary ? Math.round(limits.primary.usedPercent) : null,
    sevenDayPercent: limits.secondary ? Math.round(limits.secondary.usedPercent) : null,
    fiveHourReset: null, // Codex uses timestamps, not ISO strings
    sevenDayReset: null,
    model: limits.model,
    plan: limits.planType,
  };
}

/**
 * Parse Gemini usage limits
 */
function parseGeminiUsage(limits: GeminiUsageLimits | null, installed: boolean): CLIUsage {
  if (!installed) {
    return {
      name: 'Gemini',
      available: false,
      error: false,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  if (!limits) {
    return {
      name: 'Gemini',
      available: true,
      error: true,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  return {
    name: 'Gemini',
    available: true,
    error: false,
    // Gemini has single usage metric, map to fiveHourPercent for recommendation calculation
    fiveHourPercent: limits.usedPercent,
    sevenDayPercent: null,
    fiveHourReset: limits.resetAt,
    sevenDayReset: null,
    model: limits.model,
  };
}

/**
 * Parse z.ai usage limits
 */
function parseZaiUsage(limits: ZaiUsageLimits | null, installed: boolean): CLIUsage {
  if (!installed) {
    return {
      name: 'z.ai',
      available: false,
      error: false,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  if (!limits) {
    return {
      name: 'z.ai',
      available: true,
      error: true,
      fiveHourPercent: null,
      sevenDayPercent: null,
      fiveHourReset: null,
      sevenDayReset: null,
    };
  }

  return {
    name: 'z.ai',
    available: true,
    error: false,
    // Use tokensPercent as primary metric for recommendation
    fiveHourPercent: limits.tokensPercent,
    sevenDayPercent: limits.mcpPercent, // MCP is monthly, map to sevenDay for display
    fiveHourReset: null, // z.ai uses ms timestamps
    sevenDayReset: null,
    model: limits.model,
  };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isJsonMode = args.includes('--json');
  const lang = detectSystemLanguage();
  const t = getTranslationsByLang(lang);

  // Check installation status
  const zaiInstalled = isZaiInstalled();

  // Fetch all usage data in parallel
  const [
    claudeLimits,
    codexInstalled,
    geminiInstalled,
  ] = await Promise.all([
    fetchUsageLimits(60),
    isCodexInstalled(),
    isGeminiInstalled(),
  ]);

  // Fetch Codex, Gemini, and z.ai only if installed
  const [codexLimits, geminiLimits, zaiLimits] = await Promise.all([
    codexInstalled ? fetchCodexUsage(60) : Promise.resolve(null),
    geminiInstalled ? fetchGeminiUsage(60) : Promise.resolve(null),
    zaiInstalled ? fetchZaiUsage(60) : Promise.resolve(null),
  ]);

  // Parse usage data
  const claudeUsage = parseClaudeUsage(claudeLimits);
  const codexUsage = parseCodexUsage(codexLimits, codexInstalled);
  const geminiUsage = parseGeminiUsage(geminiLimits, geminiInstalled);
  const zaiUsage = parseZaiUsage(zaiLimits, zaiInstalled);

  // Calculate recommendation
  const recommendation = calculateRecommendation(
    claudeUsage,
    codexInstalled ? codexUsage : null,
    geminiInstalled ? geminiUsage : null,
    zaiInstalled ? zaiUsage : null,
    lang
  );

  // JSON output mode
  if (isJsonMode) {
    const output: CheckUsageOutput = {
      claude: claudeUsage,
      codex: codexInstalled ? codexUsage : null,
      gemini: geminiInstalled ? geminiUsage : null,
      zai: zaiInstalled ? zaiUsage : null,
      recommendation: recommendation.name,
      recommendationReason: recommendation.reason,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Pretty output
  const outputLines: string[] = [];

  // Header
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push(renderTitle('CLI Usage Dashboard'));
  outputLines.push(colorize(renderLine(), COLORS.gray));
  outputLines.push('');

  // Claude section
  outputLines.push(...renderCLISection('Claude', claudeUsage, t));
  outputLines.push('');

  // Codex section (use special renderer for timestamp handling)
  if (codexInstalled) {
    outputLines.push(...renderCodexSection(codexUsage, codexLimits, t));
    outputLines.push('');
  }

  // Gemini section
  if (geminiInstalled) {
    outputLines.push(...renderGeminiSection(geminiUsage, geminiLimits, t));
    outputLines.push('');
  }

  // z.ai section
  if (zaiInstalled) {
    outputLines.push(...renderZaiSection(zaiUsage, zaiLimits, t));
    outputLines.push('');
  }

  // Recommendation
  outputLines.push(colorize(renderLine(), COLORS.gray));
  if (recommendation.name) {
    const recLabel = lang === 'ko' ? '추천' : 'Recommendation';
    outputLines.push(
      `${recLabel}: ${colorize(recommendation.name, COLORS.pastelGreen)} (${recommendation.reason})`
    );
  } else {
    outputLines.push(colorize(recommendation.reason, COLORS.pastelYellow));
  }
  outputLines.push(colorize(renderLine(), COLORS.gray));

  // Print output
  console.log(outputLines.join('\n'));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
