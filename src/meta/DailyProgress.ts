import {
  WEEKLY_MILESTONES,
  type MetaSaveV1,
} from './MetaSave.ts';

export interface DailyCompletionResult {
  readonly state: MetaSaveV1;
  readonly firstCompletion: boolean;
  readonly improvedBest: boolean;
  readonly bestTimeMs: number;
  readonly newlyReachedMilestones: readonly number[];
}

function normalizeWeek(state: MetaSaveV1, weekId: string): MetaSaveV1['weekly'] {
  return state.weekly.weekId === weekId
    ? {
        ...state.weekly,
        completedDailyIds: [...state.weekly.completedDailyIds],
        claimedMilestones: [...state.weekly.claimedMilestones],
      }
    : { weekId, completedDailyIds: [], claimedMilestones: [] };
}

export function beginDailyAttempt(
  state: MetaSaveV1,
  dailyId: string,
  weekId: string,
): MetaSaveV1 {
  const previous = state.daily.records[dailyId] ?? { completed: false, attempts: 0 };

  return {
    ...state,
    daily: {
      ...state.daily,
      records: {
        ...state.daily.records,
        [dailyId]: { ...previous, attempts: previous.attempts + 1 },
      },
    },
    weekly: normalizeWeek(state, weekId),
  };
}

export function completeDailyAttempt(
  state: MetaSaveV1,
  dailyId: string,
  weekId: string,
  elapsedMs: number,
): DailyCompletionResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error('Daily elapsed time must be positive.');
  }

  const weekly = normalizeWeek(state, weekId);
  const previous = state.daily.records[dailyId] ?? { completed: false, attempts: 0 };
  const firstCompletion = !previous.completed;
  const previousBest = previous.bestTimeMs;
  const improvedBest = previousBest === undefined || elapsedMs < previousBest;
  const bestTimeMs = improvedBest ? elapsedMs : previousBest;
  const beforeCount = weekly.completedDailyIds.length;
  const completedDailyIds = firstCompletion
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

export function getWeeklyProgress(state: MetaSaveV1, weekId: string) {
  const weekly = normalizeWeek(state, weekId);

  return {
    completed: weekly.completedDailyIds.length,
    thresholds: WEEKLY_MILESTONES,
    completedDailyIds: weekly.completedDailyIds,
  };
}
