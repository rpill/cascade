import type { OrdinaryGameMode } from '../meta/GameStats.ts';
import type { MasteryRank, MetaSave } from '../meta/MetaSave.ts';

export type StatisticsMode = OrdinaryGameMode | 'daily';
export type GlobalLeaderboardMode = 'winnable' | 'daily' | 'streak' | 'mastery';

export const STANDARD_LEADERBOARD_NAME = 'standardwinstreak';
export const DAILY_LEADERBOARD_NAME = 'dailyfastest';
export const DAILY_STREAK_LEADERBOARD_NAME = 'dailystreak';
export const MASTERY_LEADERBOARD_NAME = 'cascademastery';

export const LEADERBOARD_NAMES = {
  winnable: STANDARD_LEADERBOARD_NAME,
  daily: DAILY_LEADERBOARD_NAME,
  streak: DAILY_STREAK_LEADERBOARD_NAME,
  mastery: MASTERY_LEADERBOARD_NAME,
} as const satisfies Record<GlobalLeaderboardMode, string>;

const DAY_MS = 86_400_000;
const DAILY_EPOCH_MS = Date.UTC(2026, 0, 1);
const DAILY_SCORE_BASE = 1_000_000_000_000_000;
const DAILY_DAY_SCALE = 1_000_000_000_000;
const DAILY_TIME_SCALE = 100_000_000;
const DAILY_MOVE_LIMIT = 10_000;
const DAILY_MAX_DAY_INDEX = 7_500;
const STREAK_SCALE = 100_000;
const STREAK_LIMIT = STREAK_SCALE - 1;
const MASTERY_SCORE_SCALE = 1_000_000_000;
const MASTERY_RANKS: readonly MasteryRank[] = ['novice','player','tactician','expert','master','grandmaster'];

export function lifetimeMasteryPoints(profile: MetaSave): number {
  const onboardingWins = new Set(profile.standard.completed.onboarding).size;
  const easyWins = new Set(profile.standard.completed.easy).size;
  const mediumWins = new Set(profile.standard.completed.medium).size;
  const hardWins = new Set(profile.standard.completed.hard).size;
  const onTimeDailyWins = new Set(profile.futurePrestige.onTimeDailyDates).size;
  return onboardingWins + easyWins + mediumWins * 2 + hardWins * 3 + onTimeDailyWins * 2;
}

export function encodeMasteryLeaderboardScore(profile: MetaSave): number {
  const ordinal = MASTERY_RANKS.indexOf(profile.mastery.rank) + 1;
  const points = lifetimeMasteryPoints(profile);
  if (ordinal <= 0 || !Number.isSafeInteger(points) || points < 0 || points >= MASTERY_SCORE_SCALE) {
    throw new Error('Mastery leaderboard score is outside the supported range.');
  }
  return ordinal * MASTERY_SCORE_SCALE + points;
}

export function decodeMasteryLeaderboardScore(score: number): { readonly rank: MasteryRank; readonly points: number } | null {
  if (!Number.isSafeInteger(score) || score <= 0) return null;
  const ordinal = Math.floor(score / MASTERY_SCORE_SCALE);
  const points = score - ordinal * MASTERY_SCORE_SCALE;
  const rank = MASTERY_RANKS[ordinal - 1];
  if (rank === undefined || points < 0 || points >= MASTERY_SCORE_SCALE) return null;
  return { rank, points };
}

function parseDailyIndex(dailyId: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) return null;
  const timestamp = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== dailyId) return null;
  const delta = timestamp - DAILY_EPOCH_MS;
  if (delta < 0 || delta % DAY_MS !== 0) return null;
  const index = delta / DAY_MS;
  return Number.isSafeInteger(index) && index <= DAILY_MAX_DAY_INDEX ? index : null;
}

function formatDailyIndex(index: number): string | null {
  if (!Number.isSafeInteger(index) || index < 0 || index > DAILY_MAX_DAY_INDEX) return null;
  const date = new Date(DAILY_EPOCH_MS + index * DAY_MS);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function hasGlobalLeaderboard(mode: StatisticsMode): mode is Extract<StatisticsMode, GlobalLeaderboardMode> {
  return mode === 'winnable' || mode === 'daily';
}

export function getLeaderboardName(mode: GlobalLeaderboardMode): string {
  return LEADERBOARD_NAMES[mode];
}

/**
 * Daily ranking is descending in Yandex while product semantics are:
 * newer day first, then fewer moves, then lower elapsed time.
 */
export function encodeDailyLeaderboardScore(dailyId: string, moves: number, elapsedMs: number): number {
  const dayIndex = parseDailyIndex(dailyId);
  const roundedMoves = Math.round(moves);
  const duration = Math.round(elapsedMs);
  if (
    dayIndex === null
    || !Number.isSafeInteger(roundedMoves)
    || roundedMoves <= 0
    || roundedMoves >= DAILY_MOVE_LIMIT
    || !Number.isSafeInteger(duration)
    || duration <= 0
    || duration >= DAILY_TIME_SCALE
  ) {
    throw new Error('Daily leaderboard score requires a valid day, positive moves, and bounded duration.');
  }

  const rankWithinDay = (DAILY_MOVE_LIMIT - roundedMoves) * DAILY_TIME_SCALE
    + (DAILY_TIME_SCALE - duration);
  const score = DAILY_SCORE_BASE + dayIndex * DAILY_DAY_SCALE + rankWithinDay;
  if (!Number.isSafeInteger(score) || score <= 0) {
    throw new Error('Daily leaderboard score exceeds the safe integer range.');
  }
  return score;
}

export function decodeDailyLeaderboardScore(score: number): {
  readonly dailyId: string;
  readonly moves: number;
  readonly elapsedMs: number;
} | null {
  if (!Number.isSafeInteger(score) || score < DAILY_SCORE_BASE) return null;
  const payload = score - DAILY_SCORE_BASE;
  const dayIndex = Math.floor(payload / DAILY_DAY_SCALE);
  const rankWithinDay = payload - dayIndex * DAILY_DAY_SCALE;
  const dailyId = formatDailyIndex(dayIndex);
  if (dailyId === null || rankWithinDay <= 0 || rankWithinDay >= DAILY_DAY_SCALE) return null;

  const invertedMoves = Math.floor(rankWithinDay / DAILY_TIME_SCALE);
  const timeRemainder = rankWithinDay - invertedMoves * DAILY_TIME_SCALE;
  const moves = DAILY_MOVE_LIMIT - invertedMoves;
  const elapsedMs = DAILY_TIME_SCALE - timeRemainder;
  if (
    !Number.isSafeInteger(moves) || moves <= 0 || moves >= DAILY_MOVE_LIMIT
    || !Number.isSafeInteger(elapsedMs) || elapsedMs <= 0 || elapsedMs >= DAILY_TIME_SCALE
  ) return null;
  return { dailyId, moves, elapsedMs };
}

export function encodeDailyStreakLeaderboardScore(current: number, best: number): number {
  if (
    !Number.isSafeInteger(current) || current < 0 || current > STREAK_LIMIT
    || !Number.isSafeInteger(best) || best < current || best > STREAK_LIMIT
  ) throw new Error('Daily streak leaderboard score is outside the supported range.');
  return 1 + current * STREAK_SCALE + best;
}

export function decodeDailyStreakLeaderboardScore(score: number): {
  readonly current: number;
  readonly best: number;
} | null {
  if (!Number.isSafeInteger(score) || score <= 0) return null;
  const payload = score - 1;
  const current = Math.floor(payload / STREAK_SCALE);
  const best = payload - current * STREAK_SCALE;
  if (current < 0 || current > STREAK_LIMIT || best < current || best > STREAK_LIMIT) return null;
  return { current, best };
}
