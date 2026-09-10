import type { OrdinaryGameMode } from '../meta/GameStats.ts';

export type StatisticsMode = OrdinaryGameMode | 'daily';
export type GlobalLeaderboardMode = 'winnable' | 'daily';

export const STANDARD_LEADERBOARD_NAME = 'standardwinstreak';
export const DAILY_LEADERBOARD_NAME = 'dailyfastest';

export const LEADERBOARD_NAMES = {
  winnable: STANDARD_LEADERBOARD_NAME,
  daily: DAILY_LEADERBOARD_NAME,
} as const satisfies Record<GlobalLeaderboardMode, string>;

const DAY_MS = 86_400_000;
const DAILY_SCORE_SCALE = 1_000_000_000;

function parseDailyId(dailyId: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dailyId);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return Math.floor(timestamp / DAY_MS);
}

function formatDailyId(dayNumber: number): string | null {
  if (!Number.isSafeInteger(dayNumber) || dayNumber < 0) return null;
  const date = new Date(dayNumber * DAY_MS);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function hasGlobalLeaderboard(mode: StatisticsMode): mode is GlobalLeaderboardMode {
  return mode === 'winnable' || mode === 'daily';
}

export function getLeaderboardName(mode: GlobalLeaderboardMode): string {
  return LEADERBOARD_NAMES[mode];
}

export function encodeDailyLeaderboardScore(dailyId: string, elapsedMs: number): number {
  const dayNumber = parseDailyId(dailyId);
  const duration = Math.round(elapsedMs);
  if (
    dayNumber === null
    || !Number.isSafeInteger(duration)
    || duration <= 0
    || duration >= DAILY_SCORE_SCALE
  ) {
    throw new Error('Daily leaderboard score requires a valid day and positive bounded duration.');
  }

  const score = dayNumber * DAILY_SCORE_SCALE + (DAILY_SCORE_SCALE - duration);
  if (!Number.isSafeInteger(score) || score <= 0) {
    throw new Error('Daily leaderboard score exceeds the safe integer range.');
  }
  return score;
}

export function decodeDailyLeaderboardScore(score: number): {
  readonly dailyId: string;
  readonly elapsedMs: number;
} | null {
  if (!Number.isSafeInteger(score) || score <= 0) return null;
  const dayNumber = Math.floor(score / DAILY_SCORE_SCALE);
  const remainder = score - dayNumber * DAILY_SCORE_SCALE;
  const dailyId = formatDailyId(dayNumber);
  const elapsedMs = DAILY_SCORE_SCALE - remainder;
  if (dailyId === null || remainder <= 0 || elapsedMs <= 0 || elapsedMs >= DAILY_SCORE_SCALE) {
    return null;
  }
  return { dailyId, elapsedMs };
}
