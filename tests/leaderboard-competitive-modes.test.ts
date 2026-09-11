import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { encodeDailyLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function fakePlatform(options: {
  authorized?: boolean;
  getEntries?: PlatformServices['leaderboards']['getEntries'];
  getPlayerEntry?: PlatformServices['leaderboards']['getPlayerEntry'];
  setScore?: PlatformServices['leaderboards']['setScore'];
} = {}): PlatformServices {
  return {
    playerStorage: { load: async () => ({}), save: async () => undefined },
    trustedClock: { nowMs: () => null },
    auth: {
      isAuthorized: () => options.authorized ?? true,
      requestAuthorization: async () => options.authorized ?? true,
      onAccountSelectionClosed: () => () => undefined,
    },
    leaderboards: {
      available: true,
      getEntries: options.getEntries ?? (async () => []),
      getPlayerEntry: options.getPlayerEntry ?? (async () => null),
      setScore: options.setScore ?? (async () => undefined),
    },
    payments: {
      available: false,
      getCatalog: async () => [],
      purchase: async () => { throw new Error('Payments unavailable'); },
      getPurchases: async () => [],
      consumePurchase: async () => undefined,
    },
    ads: {
      available: false,
      showInterstitial: async () => false,
      showRewarded: async () => false,
    },
    platformPause: { isPaused: () => false, subscribe: () => () => undefined },
    gameplay: { start: () => undefined, stop: () => undefined },
    ready: () => undefined,
  };
}

test('Standard leaderboard loads numeric best win streaks', async () => {
  const service = new LeaderboardService(fakePlatform({
    getEntries: async (name) => {
      assert.equal(name, 'standardwinstreak');
      return [
        { rank: 1, score: 12, playerId: 'a', publicName: 'Ada' },
        { rank: 2, score: 7, playerId: 'b', publicName: 'Bob' },
      ];
    },
    getPlayerEntry: async () => ({ rank: 2, score: 7, playerId: 'b', publicName: 'Bob' }),
  }));

  const result = await service.load('winnable');
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.deepEqual(result.entries, [
    { rank: 1, value: 12, publicName: 'Ada' },
    { rank: 2, value: 7, publicName: 'Bob' },
  ]);
  assert.deepEqual(result.playerEntry, { rank: 2, value: 7, publicName: 'Bob' });
});

test('Daily leaderboard keeps only current-day encoded scores and exposes elapsed milliseconds', async () => {
  const today = '2026-09-10';
  const yesterday = '2026-09-09';
  const service = new LeaderboardService(fakePlatform({
    getEntries: async (name) => {
      assert.equal(name, 'dailyfastest');
      return [
        { rank: 1, score: encodeDailyLeaderboardScore(today, 91_000), playerId: 'a', publicName: 'Ada' },
        { rank: 2, score: encodeDailyLeaderboardScore(today, 130_000), playerId: 'b', publicName: 'Bob' },
        { rank: 3, score: encodeDailyLeaderboardScore(yesterday, 60_000), playerId: 'c', publicName: 'Old' },
      ];
    },
    getPlayerEntry: async () => ({
      rank: 2,
      score: encodeDailyLeaderboardScore(today, 130_000),
      playerId: 'b', publicName: 'Bob',
    }),
  }));

  const result = await service.load('daily', today);
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.deepEqual(result.entries, [
    { rank: 1, value: 91_000, publicName: 'Ada' },
    { rank: 2, value: 130_000, publicName: 'Bob' },
  ]);
  assert.deepEqual(result.playerEntry, { rank: 2, value: 130_000, publicName: 'Bob' });
});

test('Standard sync submits only a larger best streak', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    getPlayerEntry: async () => ({ rank: 1, score: 4, playerId: 'me', publicName: 'Me' }),
    setScore: async (name, score) => { writes.push([name, score]); },
  }));

  assert.equal(await service.syncStandardStreak(5), 'submitted');
  assert.deepEqual(writes, [['standardwinstreak', 5]]);
});

test('Daily sync submits a faster result for today and replaces an older-day entry', async () => {
  const writes: Array<[string, number]> = [];
  const today = '2026-09-10';
  const service = new LeaderboardService(fakePlatform({
    getPlayerEntry: async () => ({
      rank: 1,
      score: encodeDailyLeaderboardScore('2026-09-09', 50_000),
      playerId: 'me', publicName: 'Me',
    }),
    setScore: async (name, score) => { writes.push([name, score]); },
  }));

  assert.equal(await service.syncDailyBest(today, 120_000), 'submitted');
  assert.deepEqual(writes, [['dailyfastest', encodeDailyLeaderboardScore(today, 120_000)]]);
});
