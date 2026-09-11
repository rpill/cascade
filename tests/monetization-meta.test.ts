import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, normalizeMetaSave } from '../src/meta/MetaSave.ts';

test('v5 profile migrates to empty monetization state and malformed v6 values normalize', () => {
  const legacy = structuredClone(createDefaultMetaSave()) as unknown as Record<string, unknown>;
  legacy.version = 5;
  delete legacy.monetization;
  const migrated = normalizeMetaSave(legacy);
  assert.deepEqual(migrated.monetization, {
    removeAds: false,
    creditedPurchaseTokens: [],
    rewardedDay: '',
    rewardedCount: 0,
  });

  const malformed = structuredClone(migrated) as unknown as Record<string, unknown>;
  malformed.monetization = {
    removeAds: 'yes',
    creditedPurchaseTokens: ['ok', 'ok', '', 7, 'x'.repeat(513)],
    rewardedDay: '11.09.2026',
    rewardedCount: 99,
  };
  assert.deepEqual(normalizeMetaSave(malformed).monetization, {
    removeAds: false,
    creditedPurchaseTokens: ['ok'],
    rewardedDay: '',
    rewardedCount: 5,
  });
});

test('platform purchase credit and token ledger are atomic and idempotent', () => {
  const initial = createDefaultMetaSave();
  const once = applyMetaOperation(initial, {
    kind: 'credit-platform-purchase',
    productId: 'coins_500',
    purchaseToken: 'token-1',
  });
  assert.equal(once.progression.coins, 500);
  assert.deepEqual(once.monetization.creditedPurchaseTokens, ['token-1']);

  const twice = applyMetaOperation(once, {
    kind: 'credit-platform-purchase',
    productId: 'coins_500',
    purchaseToken: 'token-1',
  });
  assert.equal(twice.progression.coins, 500);
  assert.deepEqual(twice.monetization.creditedPurchaseTokens, ['token-1']);

  const unknown = applyMetaOperation(twice, {
    kind: 'credit-platform-purchase',
    productId: 'mystery',
    purchaseToken: 'token-2',
  });
  assert.equal(unknown, twice);

  const cleared = applyMetaOperation(twice, {
    kind: 'clear-platform-purchase',
    purchaseToken: 'token-1',
  });
  assert.deepEqual(cleared.monetization.creditedPurchaseTokens, []);
});

test('remove-ads is monotonic and rewarded grants stop at five per day', () => {
  const state = createDefaultMetaSave();
  const adFree = applyMetaOperation(state, { kind: 'restore-remove-ads' });
  assert.equal(adFree.monetization.removeAds, true);
  assert.equal(applyMetaOperation(adFree, { kind: 'restore-remove-ads' }), adFree);

  let rewarded = createDefaultMetaSave();
  for (let index = 0; index < 6; index += 1) {
    rewarded = applyMetaOperation(rewarded, { kind: 'rewarded-ad', dayId: '2026-09-11' });
  }
  assert.equal(rewarded.progression.coins, 125);
  assert.equal(rewarded.monetization.rewardedCount, 5);

  rewarded = applyMetaOperation(rewarded, { kind: 'rewarded-ad', dayId: '2026-09-12' });
  assert.equal(rewarded.progression.coins, 150);
  assert.equal(rewarded.monetization.rewardedCount, 1);
  assert.equal(rewarded.monetization.rewardedDay, '2026-09-12');
});
