import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { claimCoinRewardOnce } from '../src/meta/economy/CoinRewards.ts';

test('claimCoinRewardOnce cannot duplicate a retry', () => {
  const p1 = claimCoinRewardOnce(createDefaultMetaSave(), 'standard:first:easy:42', 5);
  const p2 = claimCoinRewardOnce(p1, 'standard:first:easy:42', 5);
  assert.equal(p2.progression.coins, 5);
  assert.deepEqual(p2.claimedRewardKeys, ['standard:first:easy:42']);
  assert.equal(p2, p1);
});

test('coin reward rejects invalid amounts and empty keys', () => {
  assert.throws(() => claimCoinRewardOnce(createDefaultMetaSave(), 'x', -1), /amount/i);
  assert.throws(() => claimCoinRewardOnce(createDefaultMetaSave(), '', 5), /key/i);
});
