export interface RewardDoubleSource {
  readonly seed: string;
  readonly baseCoinsGranted: number;
  readonly firstCompletion: boolean;
}

export interface RewardDoubleOffer {
  readonly key: string;
  readonly bonusCoins: number;
}

export function createRewardDoubleOffer(source: RewardDoubleSource): RewardDoubleOffer | null {
  if (!source.firstCompletion || !Number.isSafeInteger(source.baseCoinsGranted) || source.baseCoinsGranted <= 0) return null;
  if (!/^[1-9]\d{0,9}$/u.test(source.seed)) throw new Error('Standard seed must be a positive integer string.');
  return {
    key: `reward-double:standard:${source.seed}`,
    bonusCoins: source.baseCoinsGranted,
  };
}
