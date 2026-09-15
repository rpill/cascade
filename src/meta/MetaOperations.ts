import type { GameMode } from '../game/model/types.ts';
import { beginDailyAttempt } from './DailyProgress.ts';
import { beginModeAttempt, completeModeAttempt } from './GameStats.ts';
import { createRewardSummary, equipTheme, purchaseTheme, type RewardLine, type RewardSummary } from './Economy.ts';
import { MAX_ECONOMY_VALUE, type MetaSave, type StandardDifficulty, type StandardPartition } from './MetaSave.ts';
import { REWARDED_COINS, REWARDED_DAILY_LIMIT } from '../monetization/Products.ts';
import { settleStandardWin } from './standard/StandardWinSettlement.ts';
import { settleDailyWin } from './daily/DailyWinSettlement.ts';
import { claimCoinRewardOnce } from './economy/CoinRewards.ts';

interface AttemptEvent {
  readonly attemptId: string;
  readonly mode: GameMode;
  readonly dailyId?: string;
  readonly weekId?: string;
}

export type CompletionEvent = AttemptEvent & {
  readonly kind: 'complete';
  readonly elapsedMs: number;
  readonly trustedDay: string | null;
  readonly trustedWeek: string | null;
  readonly standardSeed?: string;
  readonly standardPartition?: StandardPartition;
  readonly standardDifficulty?: StandardDifficulty;
};

export type MetaOperation =
  | (AttemptEvent & { readonly kind: 'begin' })
  | CompletionEvent
  | { readonly kind: 'purchase'; readonly themeId: string }
  | { readonly kind: 'equip'; readonly themeId: string }
  | { readonly kind: 'set-standard-difficulty'; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-served'; readonly seed: string; readonly partition: StandardPartition; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-failed'; readonly attemptId: string }
  | { readonly kind: 'rewarded-ad'; readonly dayId: string }
  | { readonly kind: 'reward-double'; readonly key: string; readonly bonusCoins: number };

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

function appendRankRewardLine(lines: RewardLine[], beforeCoins: number, afterCoins: number, baseCoins: number, rankAdvanced: boolean): void {
  if (!rankAdvanced) return;
  const rankCoins = Math.max(0, afterCoins - beforeCoins - baseCoins);
  if (rankCoins > 0) lines.push({ label: 'Новый ранг мастерства', coins: rankCoins });
}

export function completeRewardedAttempt(
  state: MetaSave,
  event: CompletionEvent,
): { state: MetaSave; reward: RewardSummary } {
  const empty: RewardSummary = { coins: 0, lines: [] };
  if (!event.attemptId || hasCompletedAttempt(state, event.attemptId)
    || !Number.isFinite(event.elapsedMs) || event.elapsedMs <= 0) return { state, reward: empty };

  const before = state;
  let next = state;
  const lines: RewardLine[] = [];
  let rankAdvancedTo: RewardSummary['rankAdvancedTo'];

  if (event.mode === 'daily') {
    if (!validDaily(event)) return { state, reward: empty };
    const completionDateId = event.trustedDay ?? event.dailyId!;
    const settled = settleDailyWin(next, {
      dailyId: event.dailyId!,
      weekId: event.weekId!,
      completionDateId,
      elapsedMs: event.elapsedMs,
    });
    next = settled.state;
    if (settled.coinsGranted > 0) lines.push({ label: 'Испытание дня', coins: settled.coinsGranted });
    appendRankRewardLine(lines, before.progression.coins, next.progression.coins, settled.coinsGranted, settled.rankAdvancedTo !== null);
    rankAdvancedTo = settled.rankAdvancedTo;
  } else {
    if (next.stats[event.mode].played <= next.stats[event.mode].wins) next = beginModeAttempt(next, event.mode);
    next = completeModeAttempt(next, event.mode, event.elapsedMs).state;

    if (event.mode === 'winnable') {
      if (!validStandardCompletion(event)) return { state, reward: empty };
      const beforeSettlementCoins = next.progression.coins;
      const settled = settleStandardWin(next, {
        seed: event.standardSeed,
        partition: event.standardPartition,
        difficulty: event.standardDifficulty,
      });
      next = settled.state;
      if (settled.baseCoinsGranted > 0) lines.push({ label: 'Победа', coins: settled.baseCoinsGranted });
      appendRankRewardLine(lines, beforeSettlementCoins, next.progression.coins, settled.baseCoinsGranted, settled.rankAdvancedTo !== null);
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

  return { state: next, reward: createRewardSummary(before, next, lines, rankAdvancedTo ?? null) };
}

export function applyMetaOperation(state: MetaSave, event: MetaOperation): MetaSave {
  switch (event.kind) {
    case 'purchase': return purchaseTheme(state, event.themeId);
    case 'equip': return equipTheme(state, event.themeId);
    case 'set-standard-difficulty':
      return state.standard.selectedDifficulty === event.difficulty
        ? state
        : { ...state, standard: { ...state.standard, selectedDifficulty: event.difficulty } };
    case 'reward-double':
      return /^reward-double:standard:[1-9]\d{0,9}$/u.test(event.key)
        ? claimCoinRewardOnce(state, event.key, event.bonusCoins)
        : state;
    case 'rewarded-ad': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.dayId)) return state;
      const sameDay = state.monetization.rewardedDay === event.dayId;
      const currentCount = sameDay ? state.monetization.rewardedCount : 0;
      if (currentCount >= REWARDED_DAILY_LIMIT) return state;
      return {
        ...state,
        progression: {
          ...state.progression,
          coins: Math.min(MAX_ECONOMY_VALUE, state.progression.coins + REWARDED_COINS),
        },
        monetization: {
          ...state.monetization,
          rewardedDay: event.dayId,
          rewardedCount: currentCount + 1,
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
    case 'complete': return completeRewardedAttempt(state, event).state;
    case 'begin': {
      if (!event.attemptId || state.progression.startedAttempts.includes(event.attemptId) || hasCompletedAttempt(state, event.attemptId)) return state;
      if (event.mode === 'daily' && !validDaily(event)) return state;
      const next = event.mode === 'daily'
        ? beginDailyAttempt(state, event.dailyId!, event.weekId!)
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
