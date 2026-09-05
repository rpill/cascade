import assert from 'node:assert/strict';
import test from 'node:test';
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
    playerStorage: {
      load: async () => ({}),
      save: async () => undefined,
    },
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
    ready: () => undefined,
  };
}

test('load requests top 10 and preserves one-based SDK entry ranks', async () => {
  const calls: unknown[] = [];
  const platform = fakePlatform({
    authorized: false,
    getEntries: async (name, options) => {
      calls.push({ name, options });
      return [
        { rank: 1, score: 2500, playerId: 'a', publicName: 'Ada' },
        { rank: 2, score: 3000, playerId: 'b', publicName: '' },
      ];
    },
  });
  const service = new LeaderboardService(platform);

  assert.deepEqual(await service.load('winnable'), {
    status: 'ready',
    authorized: false,
    entries: [
      { rank: 1, scoreMs: 2500, publicName: 'Ada' },
      { rank: 2, scoreMs: 3000, publicName: 'Игрок' },
    ],
    playerEntry: null,
  });
  assert.deepEqual(calls, [{
    name: 'standardbesttime',
    options: { quantityTop: 10 },
  }]);
});

test('unavailable leaderboard returns unavailable without reading entries', async () => {
  let reads = 0;
  const service = new LeaderboardService(fakePlatform({
    available: false,
    getEntries: async () => {
      reads += 1;
      return [];
    },
    getPlayerEntry: async () => {
      reads += 1;
      return null;
    },
  }));

  assert.deepEqual(await service.load('original'), {
    status: 'unavailable',
    authorized: false,
    entries: [],
    playerEntry: null,
  });
  assert.equal(reads, 0);
});

test('authorized load also requests and normalizes the player entry', async () => {
  const calls: string[] = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async (name) => {
      calls.push(`top:${name}`);
      return [{ rank: 1, score: 2000, playerId: 'a', publicName: 'Ada' }];
    },
    getPlayerEntry: async (name) => {
      calls.push(`player:${name}`);
      return { rank: 10, score: 5500, playerId: 'me', publicName: '  Me  ' };
    },
  }));

  assert.deepEqual(await service.load('original'), {
    status: 'ready',
    authorized: true,
    entries: [{ rank: 1, scoreMs: 2000, publicName: 'Ada' }],
    playerEntry: { rank: 10, scoreMs: 5500, publicName: 'Me' },
  });
  assert.deepEqual(calls, [
    'top:classicbesttime',
    'player:classicbesttime',
  ]);
});

test('load turns public network failure into an error result', async () => {
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => {
      throw new Error('network');
    },
  }));

  assert.deepEqual(await service.load('winnable'), {
    status: 'error',
    authorized: true,
    entries: [],
    playerEntry: null,
  });
});

test('load preserves public top when personal entry lookup fails', async () => {
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getEntries: async () => [
      { rank: 1, score: 2500, playerId: 'a', publicName: 'Ada' },
    ],
    getPlayerEntry: async () => {
      throw new Error('personal lookup failed');
    },
  }));

  assert.deepEqual(await service.load('winnable'), {
    status: 'ready',
    authorized: true,
    entries: [{ rank: 1, scoreMs: 2500, publicName: 'Ada' }],
    playerEntry: null,
  });
});

test('load filters malformed rows and falls back blank public names', async () => {
  const service = new LeaderboardService(fakePlatform({
    getEntries: async () => [
      { rank: 1, score: 2500, playerId: 'a', publicName: '  Ada  ' },
      { rank: 2, score: 3000, playerId: 'b', publicName: '   ' },
      { rank: 0, score: 4000, playerId: 'c', publicName: 'Bad rank' },
      { rank: 1.5, score: 4000, playerId: 'd', publicName: 'Bad rank' },
      { rank: 2, score: -1, playerId: 'e', publicName: 'Bad score' },
      { rank: 3, score: Number.NaN, playerId: 'f', publicName: 'Bad score' },
    ],
  }));

  const result = await service.load('winnable');
  assert.deepEqual(result, {
    status: 'ready',
    authorized: false,
    entries: [
      { rank: 1, scoreMs: 2500, publicName: 'Ada' },
      { rank: 2, scoreMs: 3000, publicName: 'Игрок' },
    ],
    playerEntry: null,
  });
});

test('requestAuthorization delegates to platform auth', async () => {
  let calls = 0;
  const service = new LeaderboardService(fakePlatform({
    authorize: async () => {
      calls += 1;
      return true;
    },
  }));

  assert.equal(service.available, true);
  assert.equal(service.authorized, false);
  assert.equal(await service.requestAuthorization(), true);
  assert.equal(calls, 1);
});

test('syncBest submits when local time is faster than server', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({
      rank: 10,
      score: 8000,
      playerId: 'me',
      publicName: 'Me',
    }),
    setScore: async (name, score) => {
      writes.push([name, score]);
    },
  }));

  assert.equal(await service.syncBest('winnable', 5000), 'submitted');
  assert.deepEqual(writes, [['standardbesttime', 5000]]);
});

test('syncBest keeps a faster server score unchanged', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({
      rank: 4,
      score: 4000,
      playerId: 'me',
      publicName: 'Me',
    }),
    setScore: async (name, score) => {
      writes.push([name, score]);
    },
  }));

  assert.equal(await service.syncBest('winnable', 5000), 'unchanged');
  assert.deepEqual(writes, []);
});

test('syncBest submits when the authorized player has no server entry', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => null,
    setScore: async (name, score) => {
      writes.push([name, score]);
    },
  }));

  assert.equal(await service.syncBest('original', 5000), 'submitted');
  assert.deepEqual(writes, [['classicbesttime', 5000]]);
});

test('syncBest skips unauthorized and invalid local best values without reads or writes', async () => {
  let reads = 0;
  let writes = 0;
  const service = new LeaderboardService(fakePlatform({
    authorized: false,
    getPlayerEntry: async () => {
      reads += 1;
      return null;
    },
    setScore: async () => {
      writes += 1;
    },
  }));

  assert.equal(await service.syncBest('winnable', 5000), 'skipped');
  assert.equal(await service.syncBest('winnable', undefined), 'skipped');
  assert.equal(await service.syncBest('winnable', 0), 'skipped');
  assert.equal(await service.syncBest('winnable', -1), 'skipped');
  assert.equal(await service.syncBest('winnable', Number.POSITIVE_INFINITY), 'skipped');
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('syncBest converts comparison or submission errors into skipped', async () => {
  const compareFailure = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => {
      throw new Error('read failed');
    },
  }));
  assert.equal(await compareFailure.syncBest('winnable', 5000), 'skipped');

  const writeFailure = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => null,
    setScore: async () => {
      throw new Error('write failed');
    },
  }));
  assert.equal(await writeFailure.syncBest('winnable', 5000), 'skipped');
});
