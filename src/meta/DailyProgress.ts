import {
  WEEKLY_MILESTONES,
  type MetaSave,
} from './MetaSave.ts';

export interface BeginDailyAttemptOptions {
  readonly attemptId?: string;
  readonly rankingEligible?: boolean;
}

export interface DailyCompletionResult {
  readonly state: MetaSave;
  readonly firstCompletion: boolean;
  readonly improvedBest: boolean;
  readonly bestTimeMs: number;
  readonly newlyReachedMilestones: readonly number[];
}

function normalizeWeek(state: MetaSave, weekId: string): MetaSave['weekly'] {
  return state.weekly.weekId >= weekId
    ? {
        ...state.weekly,
        completedDailyIds: [...state.weekly.completedDailyIds],
        claimedMilestones: [...state.weekly.claimedMilestones],
      }
    : { weekId, completedDailyIds: [], claimedMilestones: [] };
}

export function beginDailyAttempt(
  state: MetaSave,
  dailyId: string,
  weekId: string,
  options: BeginDailyAttemptOptions = {},
): MetaSave {
  const previous = state.daily.records[dailyId] ?? { completed: false, completedOnTime: false, attempts: 0 };
  const rankingAttemptId = options.rankingEligible === true
    && previous.completed !== true
    && previous.rankingAttemptId === undefined
    && typeof options.attemptId === 'string'
    && /^[a-zA-Z0-9_~\-]{1,100}$/.test(options.attemptId)
      ? options.attemptId
      : previous.rankingAttemptId;

  return {
    ...state,
    daily: {
      ...state.daily,
      records: {
        ...state.daily.records,
        [dailyId]: {
          ...previous,
          attempts: previous.attempts + 1,
          ...(rankingAttemptId === undefined ? {} : { rankingAttemptId }),
        },
      },
    },
    weekly: normalizeWeek(state, weekId),
  };
}

export function completeDailyAttempt(
  state: MetaSave,
  dailyId: string,
  weekId: string,
  elapsedMs: number,
  moves?: number,
  attemptId?: string,
): DailyCompletionResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error('Daily elapsed time must be positive.');
  }
  if (moves !== undefined && (!Number.isSafeInteger(moves) || moves <= 0)) {
    throw new Error('Daily move count must be a positive integer.');
  }

  const weekly = normalizeWeek(state, weekId);
  const previous = state.daily.records[dailyId] ?? { completed: false, completedOnTime: false, attempts: 0 };
  const firstCompletion = !previous.completed;
  const previousBest = previous.bestTimeMs;
  const improvedBest = previousBest === undefined || elapsedMs < previousBest;
  const bestTimeMs = improvedBest ? elapsedMs : previousBest;
  const previousBestMoves = previous.bestMoves;
  const previousBestMovesTimeMs = previous.bestMovesTimeMs;
  const recordsRankingResult = moves !== undefined
    && previousBestMoves === undefined
    && previousBestMovesTimeMs === undefined
    && (
      (previous.rankingAttemptId !== undefined && previous.rankingAttemptId === attemptId)
      || (previous.rankingAttemptId === undefined && attemptId === undefined && previous.attempts <= 1)
    );
  const bestMoves = recordsRankingResult ? moves : previousBestMoves;
  const bestMovesTimeMs = recordsRankingResult ? elapsedMs : previousBestMovesTimeMs;
  const beforeCount = weekly.completedDailyIds.length;
  const completedDailyIds = firstCompletion && weekly.weekId === weekId
    ? [...weekly.completedDailyIds, dailyId]
    : [...weekly.completedDailyIds];
  const afterCount = completedDailyIds.length;
  const newlyReachedMilestones = WEEKLY_MILESTONES.filter(
    (threshold) => beforeCount < threshold && afterCount >= threshold,
  );

  return {
    state: {
      ...state,
      daily: {
        ...state.daily,
        records: {
          ...state.daily.records,
          [dailyId]: {
            ...previous,
            completed: true,
            ...(bestTimeMs === undefined ? {} : { bestTimeMs }),
            ...(bestMoves === undefined || bestMovesTimeMs === undefined ? {} : { bestMoves, bestMovesTimeMs }),
          },
        },
      },
      weekly: { ...weekly, completedDailyIds },
    },
    firstCompletion,
    improvedBest,
    bestTimeMs: bestTimeMs as number,
    newlyReachedMilestones,
  };
}

export function getWeeklyProgress(state: MetaSave, weekId: string) {
  const weekly = normalizeWeek(state, weekId);

  return {
    completed: weekly.completedDailyIds.length,
    thresholds: WEEKLY_MILESTONES,
    completedDailyIds: weekly.completedDailyIds,
  };
}
