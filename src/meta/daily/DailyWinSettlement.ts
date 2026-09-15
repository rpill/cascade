import { completeDailyAttempt } from '../DailyProgress.ts';
import { claimCoinRewardOnce } from '../economy/CoinRewards.ts';
import { recordMasteryEligibleDailyWin } from '../mastery/Mastery.ts';
import type { MasteryRank, MetaSave } from '../MetaSave.ts';

export interface DailyWinInput {
  readonly dailyId: string;
  readonly weekId: string;
  readonly completionDateId: string;
  readonly elapsedMs: number;
}

export interface DailyWinSettlementResult {
  readonly state: MetaSave;
  readonly coinsGranted: number;
  readonly firstCompletion: boolean;
  readonly completedOnTime: boolean;
  readonly improvedBest: boolean;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

function requireDateId(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`${label} must be a date id.`);
}

export function settleDailyWin(state: MetaSave, input: DailyWinInput): DailyWinSettlementResult {
  requireDateId(input.dailyId, 'dailyId');
  requireDateId(input.completionDateId, 'completionDateId');
  if (!/^\d{4}-W\d{2}$/u.test(input.weekId)) throw new Error('weekId must be an ISO week id.');

  const existing = state.daily.records[input.dailyId];
  const result = completeDailyAttempt(state, input.dailyId, input.weekId, input.elapsedMs);
  const firstCompletion = result.firstCompletion;
  const onTimeNow = input.dailyId === input.completionDateId;
  const completedOnTime = existing?.completed === true ? existing.completedOnTime : onTimeNow;

  let next: MetaSave = {
    ...result.state,
    daily: {
      ...result.state.daily,
      records: {
        ...result.state.daily.records,
        [input.dailyId]: {
          ...result.state.daily.records[input.dailyId],
          completedOnTime,
        },
      },
    },
  };

  let coinsGranted = 0;
  if (firstCompletion) {
    const beforeCoins = next.progression.coins;
    next = claimCoinRewardOnce(
      next,
      `daily:first:${input.dailyId}`,
      onTimeNow ? 15 : 5,
    );
    coinsGranted = next.progression.coins - beforeCoins;
  }

  let masteryAdvanced = false;
  let rankAdvancedTo: MasteryRank | null = null;
  if (firstCompletion && onTimeNow) {
    const mastery = recordMasteryEligibleDailyWin(next, input.dailyId);
    next = mastery.state;
    masteryAdvanced = mastery.masteryAdvanced;
    rankAdvancedTo = mastery.rankAdvancedTo;
  }

  return {
    state: next,
    coinsGranted,
    firstCompletion,
    completedOnTime,
    improvedBest: result.improvedBest,
    masteryAdvanced,
    rankAdvancedTo,
  };
}
