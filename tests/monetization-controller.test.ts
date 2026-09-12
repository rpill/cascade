import test from 'node:test';
import assert from 'node:assert/strict';

import type { AnalyticsClient } from '../src/analytics/AnalyticsService.ts';
import { applyMetaOperation, type MetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { MonetizationController, type MonetizationMetaSession } from '../src/monetization/MonetizationController.ts';
import type {
  PlatformAds,
  PlatformPayments,
  PlatformServices,
} from '../src/platform/services.ts';

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
  saveSucceeds = true;

  async dispatchAndFlush(operation: MetaOperation): Promise<boolean> {
    this.state = applyMetaOperation(this.state, operation);
    return this.saveSucceeds;
  }
}

function createAnalyticsRecorder() {
  const events: Array<{ name: string; params: Record<string, unknown> }> = [];
  const goals: Array<{ name: string; params: Record<string, unknown> }> = [];
  const client: AnalyticsClient = {
    event: (name, params = {}) => events.push({ name, params: { ...params } }),
    goal: (name, params = {}) => goals.push({ name, params: { ...params } }),
  };
  return { client, events, goals };
}

test('startup never touches payments and interstitials no longer depend on purchase reconciliation', async () => {
  const paymentCalls: string[] = [];
  let interstitialCalls = 0;
  const platform = createPlatform({
    payments: {
      available: true,
      getPurchases: async () => { paymentCalls.push('getPurchases'); return []; },
      getCatalog: async () => { paymentCalls.push('getCatalog'); return []; },
      purchase: async () => { paymentCalls.push('purchase'); throw new Error('must not be called'); },
      consumePurchase: async () => { paymentCalls.push('consumePurchase'); },
    },
    ads: {
      available: true,
      showInterstitial: async () => { interstitialCalls += 1; return true; },
    },
  });
  const controller = new MonetizationController(platform, new FakeMeta());

  await controller.initialize();
  await controller.beforeFreshStandardDeal();

  assert.deepEqual(paymentCalls, []);
  assert.equal(interstitialCalls, 1);
});

test('rewarded ads grant at most five rewards per trusted day and only on reward result', async () => {
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

test('rewarded availability follows ads availability and meta readiness', () => {
  const meta = new FakeMeta();
  const available = new MonetizationController(createPlatform({
    ads: { available: true },
  }), meta);
  assert.equal(available.state.rewardedAvailable, true);

  const unavailable = new MonetizationController(createPlatform(), meta);
  assert.equal(unavailable.state.rewardedAvailable, false);
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

test('interstitial analytics records request and platform result', async () => {
  const analytics = createAnalyticsRecorder();
  const controller = new MonetizationController(createPlatform({
    ads: { available: true, showInterstitial: async () => false },
  }), new FakeMeta(), analytics.client);

  await controller.initialize();
  await controller.beforeFreshStandardDeal();

  assert.deepEqual(analytics.events.map((item) => item.name), [
    'fullscreen_requested', 'fullscreen_not_shown',
  ]);
});
