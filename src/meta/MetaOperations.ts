import type { GameMode } from '../game/model/types.ts';
import { beginDailyAttempt } from './DailyProgress.ts';
import { beginModeAttempt, completeModeAttempt } from './GameStats.ts';
import type { MasteryRank, MetaSave, StandardDifficulty, StandardPartition } from './MetaSave.ts';
import { settleStandardWin } from './standard/StandardWinSettlement.ts';
import { settleDailyWin } from './daily/DailyWinSettlement.ts';

interface AttemptEvent {
  readonly attemptId: string;
  readonly mode: GameMode;
  readonly dailyId?: string;
  readonly weekId?: string;
}

export type CompletionEvent = AttemptEvent & {
  readonly kind: 'complete';
  readonly elapsedMs: number;
  readonly moves?: number;
  readonly trustedDay: string | null;
  readonly trustedWeek: string | null;
  readonly standardSeed?: string;
  readonly standardPartition?: StandardPartition;
  readonly standardDifficulty?: StandardDifficulty;
};

export type MetaOperation =
  | (AttemptEvent & { readonly kind: 'begin'; readonly dailyRankingEligible?: boolean })
  | CompletionEvent
  | { readonly kind: 'daily-hint-used'; readonly dailyId: string }
  | { readonly kind: 'set-standard-difficulty'; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-served'; readonly seed: string; readonly partition: StandardPartition; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-failed'; readonly attemptId: string };

function remember(ids: string[], id: string): string[] { return [...ids, id].slice(-128); }
function attemptCursor(id: string): { key: string; sequence: number } | null {
  const match = /^([a-zA-Z0-9_-]{1,80})~([1-9]\d*)$/.exec(id);
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
  return { key: `attempt-${match[1]}`, sequence: Number(match[2]) };
}

export function hasCompletedAttempt(state: MetaSave, id: string): boolean {
  const cursor = attemptCursor(id);
  return state.progression.completedAttempts.includes(id)
    || (cursor !== null && (state.progression.receipts[cursor.key] ?? 0) >= cursor.sequence);
}

function validDaily(event: AttemptEvent): boolean {
  return typeof event.dailyId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.dailyId)
    && typeof event.weekId === 'string' && /^\d{4}-W\d{2}$/.test(event.weekId);
}

function validStandardCompletion(event: CompletionEvent): event is CompletionEvent & {
  standardSeed: string;
  standardPartition: StandardPartition;
  standardDifficulty: StandardDifficulty;
} {
  return typeof event.standardSeed === 'string'
    && /^(?:[1-9]\d{0,9})$/u.test(event.standardSeed)
    && (event.standardPartition === 'onboarding' || event.standardPartition === 'easy' || event.standardPartition === 'medium' || event.standardPartition === 'hard')
    && (event.standardDifficulty === 'easy' || event.standardDifficulty === 'medium' || event.standardDifficulty === 'hard');
}

export function completeAttempt(
  state: MetaSave,
  event: CompletionEvent,
): { state: MetaSave; rankAdvancedTo: MasteryRank | null } {
  if (!event.attemptId || hasCompletedAttempt(state, event.attemptId)
    || !Number.isFinite(event.elapsedMs) || event.elapsedMs <= 0) return { state, rankAdvancedTo: null };

  let next = state;
  let rankAdvancedTo: MasteryRank | null = null;

  if (event.mode === 'daily') {
    if (!validDaily(event)) return { state, rankAdvancedTo: null };
    const completionDateId = event.trustedDay ?? event.dailyId!;
    const settled = settleDailyWin(next, {
      dailyId: event.dailyId!,
      weekId: event.weekId!,
      completionDateId,
      elapsedMs: event.elapsedMs,
      moves: event.moves,
      attemptId: event.attemptId,
    });
    next = settled.state;
    rankAdvancedTo = settled.rankAdvancedTo;
  } else {
    if (next.stats[event.mode].played <= next.stats[event.mode].wins) next = beginModeAttempt(next, event.mode);
    next = completeModeAttempt(next, event.mode, event.elapsedMs).state;

    if (event.mode === 'winnable') {
      if (!validStandardCompletion(event)) return { state, rankAdvancedTo: null };
      const settled = settleStandardWin(next, {
        seed: event.standardSeed,
        partition: event.standardPartition,
        difficulty: event.standardDifficulty,
      });
      next = settled.state;
      rankAdvancedTo = settled.rankAdvancedTo;
      const current = next.standardWinStreak.current + 1;
      next = {
        ...next,
        standardWinStreak: { current, best: Math.max(next.standardWinStreak.best, current) },
      };
    }
  }

  const cursor = attemptCursor(event.attemptId);
  next = {
    ...next,
    progression: {
      ...next.progression,
      completedAttempts: remember(next.progression.completedAttempts, event.attemptId),
      receipts: cursor ? { ...next.progression.receipts, [cursor.key]: cursor.sequence } : next.progression.receipts,
    },
  };

  return { state: next, rankAdvancedTo };
}

export function applyMetaOperation(state: MetaSave, event: MetaOperation): MetaSave {
  switch (event.kind) {
    case 'set-standard-difficulty':
      return state.standard.selectedDifficulty === event.difficulty
        ? state
        : { ...state, standard: { ...state.standard, selectedDifficulty: event.difficulty } };
    case 'daily-hint-used': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.dailyId)) return state;
      const previous = state.daily.records[event.dailyId] ?? { completed: false, completedOnTime: false, attempts: 0 };
      if (previous.hintUsed === true) return state;
      return {
        ...state,
        daily: {
          ...state.daily,
          records: {
            ...state.daily.records,
            [event.dailyId]: { ...previous, hintUsed: true },
          },
        },
      };
    }
    case 'standard-served': {
      if (!/^[1-9]\d{0,9}$/u.test(event.seed)) return state;
      let numericSeed: bigint;
      try { numericSeed = BigInt(event.seed); } catch { return state; }
      if (numericSeed < 1n || numericSeed > 0xffff_ffffn) return state;
      const recentSeeds = [
        ...state.standard.recentSeeds.filter((seed) => seed !== event.seed),
        event.seed,
      ].slice(-256);
      return { ...state, standard: { ...state.standard, recentSeeds } };
    }
    case 'standard-failed':
      return event.attemptId
        ? { ...state, standardWinStreak: { ...state.standardWinStreak, current: 0 } }
        : state;
    case 'complete': return completeAttempt(state, event).state;
    case 'begin': {
      if (!event.attemptId || state.progression.startedAttempts.includes(event.attemptId) || hasCompletedAttempt(state, event.attemptId)) return state;
      if (event.mode === 'daily' && !validDaily(event)) return state;
      const next = event.mode === 'daily'
        ? beginDailyAttempt(state, event.dailyId!, event.weekId!, {
            attemptId: event.attemptId,
            rankingEligible: event.dailyRankingEligible === true,
          })
        : beginModeAttempt(state, event.mode);
      return {
        ...next,
        progression: {
          ...next.progression,
          startedAttempts: remember(next.progression.startedAttempts, event.attemptId),
        },
      };
    }
  }
}
