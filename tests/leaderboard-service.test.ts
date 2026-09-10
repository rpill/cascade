import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDailyLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function fakePlatform(options: {
  available?: boolean;
  authorized?: boolean;
  authorize?: () => Promise<boolean>;
  getEntries?: PlatformServices['leaderboards']['getEntries'];
  getPlayerEntry?: PlatformServices['leaderboards']['getPlayerEntry'];
  setScore?: PlatformServices['leaderboards']['setScore'];
} = {}): PlatformServices {
  return {
    playerStorage: { load: async () => ({}), save: async () => undefined },
    trustedClock: { nowMs: () => null },
    auth: {
      isAuthorized: () => options.authorized ?? false,
      requestAuthorization: options.authorize ?? (async () => options.authorized ?? false),
      onAccountSelectionClosed: () => () => undefined,
    },
    leaderboards: {
      available: options.available ?? true,
      getEntries: options.getEntries ?? (async () => []),
      getPlayerEntry: options.getPlayerEntry ?? (async () => null),
      setScore: options.setScore ?? (async () => undefined),
    },
    platformPause: { isPaused: () => false, subscribe: () => () => undefined },
    gameplay: { start: () => undefined, stop: () => undefined },
    ready: () => undefined,
  };
}

test('Standard load requests top 10 from win-streak board and normalizes positive streaks', async () => {
  const calls: unknown[] = [];
  const service = new LeaderboardService(fakePlatform({
    getEntries: async (name, options) => {
      calls.push({ name, options });
      return [
        { rank: 1, score: 12, playerId: 'a', publicName: ' Ada ' },
        { rank: 2, score: 7, playerId: 'b', publicName: '' },
        { rank: 3, score: 0, playerId: 'bad', publicName: 'Bad' },
      ];
    },
  }));

  assert.deepEqual(await service.load('winnable'), {
    status: 'ready', authorized: false,
    entries: [
      { rank: 1, value: 12, publicName: 'Ada' },
      { rank: 2, value: 7, publicName: '' },
    ],
    playerEntry: null,
  });
  assert.deepEqual(calls, [{ name: 'standardwinstreak', options: { quantityTop: 10 } }]);
});

test('Daily load decodes only entries for the requested day', async () => {
  const today = '2026-09-10';
  const service = new LeaderboardService(fakePlatform({
    getEntries: async (name) => {
      assert.equal(name, 'dailyfastest');
      return [
        { rank: 1, score: encodeDailyLeaderboardScore(today, 90_000), playerId: 'a', publicName: 'Fast' },
        { rank: 2, score: encodeDailyLeaderboardScore(today, 125_000), playerId: 'b', publicName: 'Slow' },
        { rank: 3, score: encodeDailyLeaderboardScore('2026-09-09', 30_000), playerId: 'old', publicName: 'Old' },
      ];
    },
  }));

  assert.deepEqual(await service.load('daily', today), {
    status: 'ready', authorized: false,
    entries: [
      { rank: 1, value: 90_000, publicName: 'Fast' },
      { rank: 2, value: 125_000, publicName: 'Slow' },
    ],
    playerEntry: null,
  });
});

test('Daily load requires a current daily id', async () => {
  const service = new LeaderboardService(fakePlatform());
  assert.deepEqual(await service.load('daily'), {
    status: 'error', authorized: false, entries: [], playerEntry: null,
  });
});

test('unavailable leaderboard returns unavailable without reading entries', async () => {
  let reads = 0;
  const service = new LeaderboardService(fakePlatform({
    available: false,
    getEntries: async () => { reads += 1; return []; },
    getPlayerEntry: async () => { reads += 1; return null; },
  }));
  assert.deepEqual(await service.load('winnable'), {
    status: 'unavailable', authorized: false, entries: [], playerEntry: null,
  });
  assert.equal(reads, 0);
});

test('authorized Standard load also normalizes personal streak', async () => {
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => [{ rank: 1, score: 15, playerId: 'a', publicName: 'Ada' }],
    getPlayerEntry: async () => ({ rank: 8, score: 5, playerId: 'me', publicName: ' Me ' }),
  }));
  assert.deepEqual(await service.load('winnable'), {
    status: 'ready', authorized: true,
    entries: [{ rank: 1, value: 15, publicName: 'Ada' }],
    playerEntry: { rank: 8, value: 5, publicName: 'Me' },
  });
});

test('authorized Daily load drops a personal entry from another day', async () => {
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => [],
    getPlayerEntry: async () => ({
      rank: 1,
      score: encodeDailyLeaderboardScore('2026-09-09', 60_000),
      playerId: 'me', publicName: 'Me',
    }),
  }));
  const result = await service.load('daily', '2026-09-10');
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.playerEntry, null);
});

test('load turns public network failure into error and preserves public rows when personal lookup fails', async () => {
  const failure = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => { throw new Error('network'); },
  }));
  assert.equal((await failure.load('winnable')).status, 'error');

  const partial = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => [{ rank: 1, score: 4, playerId: 'a', publicName: 'Ada' }],
    getPlayerEntry: async () => { throw new Error('personal'); },
  }));
  assert.deepEqual(await partial.load('winnable'), {
    status: 'ready', authorized: true,
    entries: [{ rank: 1, value: 4, publicName: 'Ada' }],
    playerEntry: null,
  });
});

test('requestAuthorization delegates to platform auth', async () => {
  let calls = 0;
  const service = new LeaderboardService(fakePlatform({ authorize: async () => { calls += 1; return true; } }));
  assert.equal(await service.requestAuthorization(), true);
  assert.equal(calls, 1);
});

test('syncStandardStreak submits only a larger valid local best', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({ rank: 3, score: 7, playerId: 'me', publicName: 'Me' }),
    setScore: async (name, score) => { writes.push([name, score]); },
  }));
  assert.equal(await service.syncStandardStreak(9), 'submitted');
  assert.deepEqual(writes, [['standardwinstreak', 9]]);
});

test('syncStandardStreak keeps equal or better server streak unchanged', async () => {
  let writes = 0;
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({ rank: 1, score: 9, playerId: 'me', publicName: 'Me' }),
    setScore: async () => { writes += 1; },
  }));
  assert.equal(await service.syncStandardStreak(9), 'unchanged');
  assert.equal(await service.syncStandardStreak(8), 'unchanged');
  assert.equal(writes, 0);
});

test('syncStandardStreak skips unavailable unauthorized invalid and transport failures', async () => {
  const unauthorized = new LeaderboardService(fakePlatform({ authorized: false }));
  assert.equal(await unauthorized.syncStandardStreak(5), 'skipped');
  const authorized = new LeaderboardService(fakePlatform({ authorized: true }));
  assert.equal(await authorized.syncStandardStreak(0), 'skipped');
  assert.equal(await authorized.syncStandardStreak(Number.NaN), 'skipped');
  const broken = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => { throw new Error('network'); },
  }));
  assert.equal(await broken.syncStandardStreak(5), 'skipped');
});

test('syncDailyBest submits encoded today score when server has no entry or an older day', async () => {
  const writes: Array<[string, number]> = [];
  let entry: Awaited<ReturnType<PlatformServices['leaderboards']['getPlayerEntry']>> = null;
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => entry,
    setScore: async (name, score) => { writes.push([name, score]); },
  }));
  assert.equal(await service.syncDailyBest('2026-09-10', 123_456), 'submitted');
  entry = { rank: 1, score: encodeDailyLeaderboardScore('2026-09-09', 30_000), playerId: 'me', publicName: 'Me' };
  assert.equal(await service.syncDailyBest('2026-09-10', 120_000), 'submitted');
  assert.deepEqual(writes, [
    ['dailyfastest', encodeDailyLeaderboardScore('2026-09-10', 123_456)],
    ['dailyfastest', encodeDailyLeaderboardScore('2026-09-10', 120_000)],
  ]);
});

test('syncDailyBest preserves a faster same-day score and rejects future-day overwrite', async () => {
  let serverScore = encodeDailyLeaderboardScore('2026-09-10', 60_000);
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({ rank: 1, score: serverScore, playerId: 'me', publicName: 'Me' }),
  }));
  assert.equal(await service.syncDailyBest('2026-09-10', 90_000), 'unchanged');
  serverScore = encodeDailyLeaderboardScore('2026-09-11', 500_000);
  assert.equal(await service.syncDailyBest('2026-09-10', 50_000), 'skipped');
});

test('syncDailyBest skips invalid, unauthorized and unavailable submissions', async () => {
  assert.equal(await new LeaderboardService(fakePlatform({ authorized: false })).syncDailyBest('2026-09-10', 60_000), 'skipped');
  assert.equal(await new LeaderboardService(fakePlatform({ authorized: true })).syncDailyBest('bad-day', 60_000), 'skipped');
  assert.equal(await new LeaderboardService(fakePlatform({ authorized: true })).syncDailyBest('2026-09-10', 0), 'skipped');
  assert.equal(await new LeaderboardService(fakePlatform({ available: false, authorized: true })).syncDailyBest('2026-09-10', 60_000), 'skipped');
});
