import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AnalyticsService,
  type AnalyticsTransport,
} from '../src/analytics/AnalyticsService.ts';

test('analytics routes conversions to reachGoal and ordinary actions to params events', () => {
  const calls: unknown[] = [];
  const transport: AnalyticsTransport = {
    reachGoal: (name, params) => calls.push(['goal', name, params]),
    event: (name, params) => calls.push(['event', name, params]),
  };
  const analytics = new AnalyticsService(transport);

  analytics.event('shop_open', { source: 'menu', ignored: undefined });
  analytics.goal('game_win', { mode: 'winnable', duration_sec: 91.25 });

  assert.deepEqual(calls, [
    ['event', 'shop_open', { source: 'menu' }],
    ['goal', 'game_win', { mode: 'winnable', duration_sec: 91.25 }],
  ]);
});

test('analytics drops invalid numeric values instead of poisoning Metrica payloads', () => {
  const calls: unknown[] = [];
  const analytics = new AnalyticsService({
    reachGoal: (name, params) => calls.push([name, params]),
    event: () => undefined,
  });

  analytics.goal('iap_success', {
    product_id: 'coins_500',
    order_price: Number.NaN,
    infinity: Number.POSITIVE_INFINITY,
    currency: 'YAN',
    remove_ads: false,
    nothing: null,
  });

  assert.deepEqual(calls, [[
    'iap_success',
    { product_id: 'coins_500', currency: 'YAN', remove_ads: false },
  ]]);
});
