import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, normalizeMetaSave, META_SAVE_VERSION } from '../src/meta/MetaSave.ts';
import { REWARDED_COINS, REWARDED_DAILY_LIMIT } from '../src/monetization/Products.ts';

test('old unpublished save schemas reset instead of migrating legacy monetization/IAP fields', () => {
  const legacy = structuredClone(createDefaultMetaSave()) as unknown as Record<string, unknown>;
  legacy.version = META_SAVE_VERSION - 1;
  legacy.progression = { coins: 999999 };
  legacy.monetization = { removeAds: true, creditedPurchaseTokens: ['old'], rewardedDay: '2026-09-10', rewardedCount: 5 };
  assert.deepEqual(normalizeMetaSave(legacy), createDefaultMetaSave());
});

test('rewarded ad grants the configured coins and is capped per trusted day', () => {
  let state = createDefaultMetaSave();
  for (let index = 0; index < REWARDED_DAILY_LIMIT + 2; index += 1) {
    state = applyMetaOperation(state, { kind: 'rewarded-ad', dayId: '2026-09-10' });
  }
  assert.equal(state.progression.coins, REWARDED_COINS * REWARDED_DAILY_LIMIT);
  assert.equal(state.monetization.rewardedDay, '2026-09-10');
  assert.equal(state.monetization.rewardedCount, REWARDED_DAILY_LIMIT);

  state = applyMetaOperation(state, { kind: 'rewarded-ad', dayId: '2026-09-11' });
  assert.equal(state.progression.coins, REWARDED_COINS * (REWARDED_DAILY_LIMIT + 1));
  assert.equal(state.monetization.rewardedDay, '2026-09-11');
  assert.equal(state.monetization.rewardedCount, 1);
});

test('invalid rewarded day never grants currency', () => {
  const state = createDefaultMetaSave();
  assert.equal(applyMetaOperation(state, { kind:'rewarded-ad', dayId:'bad' }), state);
});
