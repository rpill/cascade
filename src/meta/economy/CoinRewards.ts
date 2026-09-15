import { MAX_ECONOMY_VALUE, type MetaSave } from '../MetaSave.ts';

export function claimCoinRewardOnce(state: MetaSave, key: string, amount: number): MetaSave {
  if (typeof key !== 'string' || key.length === 0) throw new Error('Reward key must be non-empty.');
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Reward amount must be a non-negative integer.');
  if (state.claimedRewardKeys.includes(key)) return state;
  return {
    ...state,
    progression: { ...state.progression, coins: Math.min(MAX_ECONOMY_VALUE, state.progression.coins + amount) },
    claimedRewardKeys: [...state.claimedRewardKeys, key],
  };
}
