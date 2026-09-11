import test from 'node:test';
import assert from 'node:assert/strict';

import type { AnalyticsClient } from '../src/analytics/AnalyticsService.ts';
import { applyMetaOperation, type MetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { MonetizationController, type MonetizationMetaSession } from '../src/monetization/MonetizationController.ts';
import type {
  PlatformAds,
  PlatformPayments,
  PlatformProduct,
  PlatformServices,
} from '../src/platform/services.ts';

function product(id: string): PlatformProduct {
  return {
    id,
    title: id,
    description: id,
    price: `price-${id}`,
    priceValue: `value-${id}`,
    priceCurrencyCode: 'YAN',
    currencyImageUrl: '/yan.svg',
  };
}

function createPlatform(options: {
  payments?: Partial<PlatformPayments>;
  ads?: Partial<PlatformAds>;
  nowMs?: number | null;
} = {}): PlatformServices {
  const payments: PlatformPayments = {
    available: false,
    getCatalog: async () => [],
    purchase: async () => { throw new Error('purchase unavailable'); },
    getPurchases: async () => [],
    consumePurchase: async () => undefined,
    ...options.payments,
  };
  const ads: PlatformAds = {
    available: false,
    showInterstitial: async () => false,
    showRewarded: async () => false,
    ...options.ads,
  };
  return {
    playerStorage: { load: async () => ({}), save: async () => undefined },
    trustedClock: { nowMs: () => options.nowMs ?? null },
    auth: {
      isAuthorized: () => false,
      requestAuthorization: async () => false,
      onAccountSelectionClosed: () => () => undefined,
    },
    leaderboards: {
      available: false,
      getEntries: async () => [],
      getPlayerEntry: async () => null,
      setScore: async () => undefined,
    },
    payments,
    ads,
    platformPause: { isPaused: () => false, subscribe: () => () => undefined },
    gameplay: { start: () => undefined, stop: () => undefined },
    ready: () => undefined,
  };
}

class FakeMeta implements MonetizationMetaSession {
  state: MetaSave = createDefaultMetaSave();
  status = 'ready' as const;
  readonly calls: string[] = [];
  saveSucceeds = true;

  async dispatchAndFlush(operation: MetaOperation): Promise<boolean> {
    const token = 'purchaseToken' in operation ? operation.purchaseToken : '';
    const label = operation.kind === 'credit-platform-purchase'
      ? `credit:${token}`
      : operation.kind === 'clear-platform-purchase'
        ? `clear:${token}`
        : operation.kind;
    this.calls.push(label);
    this.state = applyMetaOperation(this.state, operation);
    this.calls.push(`flush:${label}`);
    return this.saveSucceeds;
  }
}

test('startup reconciliation saves credit before consuming and then loads catalog', async () => {
  const calls: string[] = [];
  const meta = new FakeMeta();
  meta.dispatchAndFlush = async (operation) => {
    const token = 'purchaseToken' in operation ? operation.purchaseToken : '';
    const label = operation.kind === 'credit-platform-purchase'
      ? `credit:${token}`
      : operation.kind === 'clear-platform-purchase'
        ? `clear:${token}`
        : operation.kind;
    calls.push(label);
    meta.state = applyMetaOperation(meta.state, operation);
    calls.push(`flush:${label}`);
    return true;
  };
  const platform = createPlatform({ payments: {
    available: true,
    getPurchases: async () => {
      calls.push('getPurchases');
      return [{ productId: 'coins_500', purchaseToken: 'token-1' }];
    },
    consumePurchase: async (token) => { calls.push(`consume:${token}`); },
    getCatalog: async () => { calls.push('getCatalog'); return [product('coins_500')]; },
  } });

  const controller = new MonetizationController(platform, meta);
  await controller.initialize();

  assert.deepEqual(calls, [
    'getPurchases',
    'credit:token-1',
    'flush:credit:token-1',
    'consume:token-1',
    'clear:token-1',
    'flush:clear:token-1',
    'getCatalog',
  ]);
  assert.equal(meta.state.progression.coins, 500);
  assert.equal(controller.state.paymentsStatus, 'ready');
});

test('failed consume retries without double credit', async () => {
  let consumeCalls = 0;
  const meta = new FakeMeta();
  const platform = createPlatform({ payments: {
    available: true,
    getPurchases: async () => [{ productId: 'coins_500', purchaseToken: 'token-1' }],
    consumePurchase: async () => {
      consumeCalls += 1;
      if (consumeCalls === 1) throw new Error('offline');
    },
    getCatalog: async () => [product('coins_500')],
  } });
  const controller = new MonetizationController(platform, meta);

  await controller.initialize();
  assert.equal(meta.state.progression.coins, 500);
  assert.deepEqual(meta.state.monetization.creditedPurchaseTokens, ['token-1']);
  assert.equal(controller.state.paymentsStatus, 'error');

  await controller.retryPayments();
  assert.equal(meta.state.progression.coins, 500);
  assert.equal(consumeCalls, 2);
  assert.deepEqual(meta.state.monetization.creditedPurchaseTokens, []);
  assert.equal(controller.state.paymentsStatus, 'ready');
});

test('remove-ads restores without consumption and unknown purchases stay untouched', async () => {
  const consumed: string[] = [];
  const meta = new FakeMeta();
  const platform = createPlatform({ payments: {
    available: true,
    getPurchases: async () => [
      { productId: 'remove_ads', purchaseToken: 'remove-token' },
      { productId: 'mystery_item', purchaseToken: 'mystery-token' },
    ],
    consumePurchase: async (token) => { consumed.push(token); },
    getCatalog: async () => [product('remove_ads')],
  } });

  await new MonetizationController(platform, meta).initialize();
  assert.equal(meta.state.monetization.removeAds, true);
  assert.deepEqual(consumed, []);
});

test('rewarded ads grant at most five rewards per trusted day and only on reward callback result', async () => {
  let rewardedCalls = 0;
  const meta = new FakeMeta();
  const platform = createPlatform({
    nowMs: Date.parse('2026-09-11T12:00:00Z'),
    ads: {
      available: true,
      showRewarded: async () => { rewardedCalls += 1; return true; },
    },
  });
  const controller = new MonetizationController(platform, meta);

  for (let index = 0; index < 6; index += 1) await controller.watchRewarded();
  assert.equal(rewardedCalls, 5);
  assert.equal(meta.state.progression.coins, 125);
  assert.equal(meta.state.monetization.rewardedCount, 5);
  assert.equal(controller.state.rewardedRemaining, 0);

  const noRewardMeta = new FakeMeta();
  const noReward = new MonetizationController(createPlatform({
    nowMs: Date.parse('2026-09-11T12:00:00Z'),
    ads: { available: true, showRewarded: async () => false },
  }), noRewardMeta);
  await noReward.watchRewarded();
  assert.equal(noRewardMeta.state.progression.coins, 0);
});

test('interstitials respect entitlement and purchase-reconciliation safety while rewarded stays voluntary', async () => {
  let interstitialCalls = 0;
  let rewardedCalls = 0;
  const ads = {
    available: true,
    showInterstitial: async () => { interstitialCalls += 1; return false; },
    showRewarded: async () => { rewardedCalls += 1; return true; },
  };

  const unavailableMeta = new FakeMeta();
  const unavailable = new MonetizationController(createPlatform({ ads }), unavailableMeta);
  await unavailable.initialize();
  await unavailable.beforeFreshStandardDeal();
  assert.equal(interstitialCalls, 0);

  const failedMeta = new FakeMeta();
  const failed = new MonetizationController(createPlatform({
    payments: { available: true, getPurchases: async () => { throw new Error('offline'); } },
    ads,
  }), failedMeta);
  await failed.initialize();
  await failed.beforeFreshStandardDeal();
  assert.equal(interstitialCalls, 0);

  const readyMeta = new FakeMeta();
  const ready = new MonetizationController(createPlatform({
    payments: { available: true, getPurchases: async () => [], getCatalog: async () => [] },
    ads,
  }), readyMeta);
  await ready.initialize();
  await ready.beforeFreshStandardDeal();
  assert.equal(interstitialCalls, 1);

  readyMeta.state = applyMetaOperation(readyMeta.state, { kind: 'restore-remove-ads' });
  await ready.beforeFreshStandardDeal();
  assert.equal(interstitialCalls, 1);
  await ready.watchRewarded();
  assert.equal(rewardedCalls, 1);
});


function createAnalyticsRecorder() {
  const events: Array<{ name: string; params: Record<string, unknown> }> = [];
  const goals: Array<{ name: string; params: Record<string, unknown> }> = [];
  const client: AnalyticsClient = {
    event: (name, params = {}) => events.push({ name, params: { ...params } }),
    goal: (name, params = {}) => goals.push({ name, params: { ...params } }),
  };
  return { client, events, goals };
}

test('user-initiated purchase emits click and success only after reconciliation', async () => {
  const analytics = createAnalyticsRecorder();
  const meta = new FakeMeta();
  const paidProduct: PlatformProduct = {
    ...product('coins_500'),
    price: '39 Yan',
    priceValue: '39',
    priceCurrencyCode: 'YAN',
  };
  const platform = createPlatform({ payments: {
    available: true,
    getPurchases: async () => [],
    getCatalog: async () => [paidProduct],
    purchase: async () => ({ productId: 'coins_500', purchaseToken: 'paid-token' }),
    consumePurchase: async () => undefined,
  } });
  const controller = new MonetizationController(platform, meta, analytics.client);

  await controller.initialize();
  await controller.purchase('coins_500');

  assert.deepEqual(analytics.events, [{
    name: 'iap_click',
    params: { product_id: 'coins_500', price_value: '39', portal_currency: 'YAN' },
  }]);
  assert.deepEqual(analytics.goals, [{
    name: 'iap_success',
    params: {
      product_id: 'coins_500',
      price_value: '39',
      portal_currency: 'YAN',
      coins_granted: 500,
      remove_ads: false,
    },
  }]);
});

test('rejected user purchase emits iap_error and never emits success', async () => {
  const analytics = createAnalyticsRecorder();
  const meta = new FakeMeta();
  const platform = createPlatform({ payments: {
    available: true,
    getPurchases: async () => [],
    getCatalog: async () => [product('remove_ads')],
    purchase: async () => { throw new Error('rejected'); },
  } });
  const controller = new MonetizationController(platform, meta, analytics.client);

  await controller.initialize();
  await controller.purchase('remove_ads');

  assert.equal(analytics.events[0]?.name, 'iap_click');
  assert.equal(analytics.events[1]?.name, 'iap_error');
  assert.deepEqual(analytics.goals, []);
});

test('rewarded analytics records intent and conversion only after durable reward grant', async () => {
  const analytics = createAnalyticsRecorder();
  const meta = new FakeMeta();
  const controller = new MonetizationController(createPlatform({
    nowMs: Date.parse('2026-09-11T12:00:00Z'),
    ads: { available: true, showRewarded: async () => true },
  }), meta, analytics.client);

  await controller.watchRewarded();

  assert.deepEqual(analytics.events, [{ name: 'rewarded_click', params: {} }]);
  assert.deepEqual(analytics.goals, [{
    name: 'rewarded_reward',
    params: { coins: 25, remaining_today: 4 },
  }]);
});

test('ad analytics records interstitial request and platform result', async () => {
  const shownAnalytics = createAnalyticsRecorder();
  const shown = new MonetizationController(createPlatform({
    payments: { available: true, getPurchases: async () => [], getCatalog: async () => [] },
    ads: { available: true, showInterstitial: async () => true },
  }), new FakeMeta(), shownAnalytics.client);
  await shown.initialize();
  await shown.beforeFreshStandardDeal();
  assert.deepEqual(shownAnalytics.events.map((item) => item.name), [
    'fullscreen_requested', 'fullscreen_shown',
  ]);

  const skippedAnalytics = createAnalyticsRecorder();
  const skipped = new MonetizationController(createPlatform({
    payments: { available: true, getPurchases: async () => [], getCatalog: async () => [] },
    ads: { available: true, showInterstitial: async () => false },
  }), new FakeMeta(), skippedAnalytics.client);
  await skipped.initialize();
  await skipped.beforeFreshStandardDeal();
  assert.deepEqual(skippedAnalytics.events.map((item) => item.name), [
    'fullscreen_requested', 'fullscreen_not_shown',
  ]);
});
