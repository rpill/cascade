import type { RewardSummaryState } from './RewardSummaryView.ts';

export interface VictoryRewardPresentationOptions {
  readonly doubleBonusCoins?: number | null;
  readonly doubled?: boolean;
}

export interface VictoryRewardPresentation {
  readonly baseLabel: string | null;
  readonly baseCoins: number;
  readonly rankCoins: number;
  readonly totalCoins: number;
  readonly doubleFromCoins: number;
  readonly doubleToCoins: number;
  readonly pending: boolean;
  readonly empty: boolean;
}

const RANK_REWARD_LABEL = 'Новый ранг мастерства';

export function buildVictoryRewardPresentation(
  reward: RewardSummaryState | undefined,
  options: VictoryRewardPresentationOptions = {},
): VictoryRewardPresentation {
  if (!reward) {
    return {
      baseLabel: null,
      baseCoins: 0,
      rankCoins: 0,
      totalCoins: 0,
      doubleFromCoins: 0,
      doubleToCoins: 0,
      pending: false,
      empty: true,
    };
  }

  const rankCoins = reward.lines
    .filter((line) => line.label === RANK_REWARD_LABEL)
    .reduce((sum, line) => sum + Math.max(0, line.coins), 0);
  const baseLine = reward.lines.find((line) => line.label !== RANK_REWARD_LABEL) ?? null;
  const originalBaseCoins = Math.max(0, baseLine?.coins ?? 0);
  const doubleBonusCoins = Math.max(0, options.doubleBonusCoins ?? 0);
  const doubled = options.doubled === true && doubleBonusCoins > 0;
  const baseCoins = originalBaseCoins + (doubled ? doubleBonusCoins : 0);

  return {
    baseLabel: baseLine?.label ?? null,
    baseCoins,
    rankCoins,
    totalCoins: Math.max(0, reward.coins),
    doubleFromCoins: originalBaseCoins,
    doubleToCoins: originalBaseCoins + doubleBonusCoins,
    pending: reward.pending === true,
    empty: reward.pending !== true && reward.coins <= 0 && reward.lines.length === 0,
  };
}
