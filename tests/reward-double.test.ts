import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { createRewardDoubleOffer } from '../src/meta/economy/RewardDouble.ts';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';

test('standard first completion can offer one ad bonus equal to its base coins', () => {
  assert.deepEqual(createRewardDoubleOffer({ seed: '42', baseCoinsGranted: 7, firstCompletion: true }), {
    key: 'reward-double:standard:42',
    bonusCoins: 7,
  });
  assert.equal(createRewardDoubleOffer({ seed: '42', baseCoinsGranted: 7, firstCompletion: false }), null);
  assert.equal(createRewardDoubleOffer({ seed: '42', baseCoinsGranted: 0, firstCompletion: true }), null);
});

test('reward-double meta operation is idempotent and only grants the advertised bonus once', () => {
  const start = createDefaultMetaSave();
  const operation = { kind: 'reward-double' as const, key: 'reward-double:standard:42', bonusCoins: 7 };
  const once = applyMetaOperation(start, operation);
  const twice = applyMetaOperation(once, operation);
  assert.equal(once.progression.coins, start.progression.coins + 7);
  assert.equal(twice.progression.coins, once.progression.coins);
  assert.ok(once.claimedRewardKeys.includes(operation.key));
});
