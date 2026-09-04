import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBrowserPlayerStorage,
  createUnavailablePlatformServices,
} from '../src/platform/services.ts';
import {
  createYandexPlatformServices,
  initializePlatform,
  notifyPlatformReady,
  type YandexSdk,
} from '../src/platform/yandex.ts';

class FakeStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createFakeYsdk(options: {
  authorized?: boolean;
  getPlayer?: () => Promise<{
    getData(keys?: string[]): Promise<Record<string, unknown>>;
    setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
    isAuthorized(): boolean;
  }>;
  openAuthDialog?: () => Promise<void>;
  getEntries?: (
    name: string,
    options: { quantityTop: number },
  ) => Promise<{ entries: Array<{
    rank: number;
    score: number;
    player: { publicName: string; uniqueID: string };
  }> }>;
  getPlayerEntry?: (name: string) => Promise<{
    rank: number;
    score: number;
    player: { publicName: string; uniqueID: string };
  }>;
  getPlayerEntryError?: unknown;
  setScore?: (name: string, score: number) => Promise<void>;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  on?: (eventName: string, listener: () => void) => () => void;
} = {}): YandexSdk {
  const defaultPlayer = {
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => options.authorized ?? false,
  };

  return {
    getPlayer: options.getPlayer ?? (async () => defaultPlayer),
    serverTime: () => 1_788_508_800_000,
    isAvailableMethod: options.isAvailableMethod ?? (async () => true),
    auth: {
      openAuthDialog: options.openAuthDialog ?? (async () => undefined),
    },
    EVENTS: { ACCOUNT_SELECTION_DIALOG_CLOSED: 'ACCOUNT_SELECTION_DIALOG_CLOSED' },
    on: options.on ?? (() => () => undefined),
    leaderboards: {
      getEntries: options.getEntries ?? (async () => ({ entries: [] })),
      getPlayerEntry: options.getPlayerEntry ?? (async () => {
        if (options.getPlayerEntryError !== undefined) {
          throw options.getPlayerEntryError;
        }
        throw Object.assign(new Error('missing'), {
          code: 'LEADERBOARD_PLAYER_NOT_PRESENT',
        });
      }),
      setScore: options.setScore ?? (async () => undefined),
    },
  };
}

test('browser player storage survives adapter recreation', async () => {
  const storage = new FakeStorage();
  await createBrowserPlayerStorage(storage).save({ cascadeMeta: { version: 1 } });

  assert.deepEqual(
    await createBrowserPlayerStorage(storage).load(),
    { cascadeMeta: { version: 1 } },
  );
});

test('unavailable platform falls back safely when browser storage throws', async () => {
  const broken = {
    getItem(): string | null { throw new Error('blocked'); },
    setItem(): void { throw new Error('blocked'); },
  };
  const platform = createUnavailablePlatformServices(broken);

  await platform.playerStorage.save({ value: 7 });
  assert.deepEqual(await platform.playerStorage.load(), { value: 7 });
  assert.equal(platform.trustedClock.nowMs(), null);
});

test('unavailable platform keeps ordinary play possible but has no trusted time', async () => {
  const platform = createUnavailablePlatformServices();

  assert.equal(platform.trustedClock.nowMs(), null);
  assert.deepEqual(await platform.playerStorage.load(), {});
  await platform.playerStorage.save({ any: 'value' });
  assert.deepEqual(await platform.playerStorage.load(), { any: 'value' });
});

test('unavailable platform exposes inert auth and unavailable leaderboards', async () => {
  const platform = createUnavailablePlatformServices(null);

  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(await platform.auth.requestAuthorization(), false);
  let selectionClosed = 0;
  const unsubscribe = platform.auth.onAccountSelectionClosed(() => { selectionClosed += 1; });
  unsubscribe();
  assert.equal(selectionClosed, 0);
  assert.equal(platform.leaderboards.available, false);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 }),
    [],
  );
  assert.equal(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    null,
  );
  await platform.leaderboards.setScore('standard_best_time', 5000);
});

test('Yandex adapter reads trusted time and structured player data through one player object', async () => {
  const saved: Array<{ data: Record<string, unknown>; flush: boolean }> = [];
  let getPlayerCalls = 0;
  let readyCalls = 0;
  const player = {
    getData: async () => ({ meta: { version: 1 } }),
    setData: async (data: Record<string, unknown>, flush = false) => {
      saved.push({ data, flush });
    },
    isAuthorized: () => true,
  };
  const ysdk: YandexSdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return player;
    },
    serverTime: () => 1_788_508_800_000,
    isAvailableMethod: async () => true,
    auth: { openAuthDialog: async () => undefined },
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
  };

  const platform = await createYandexPlatformServices(ysdk);

  assert.equal(platform.trustedClock.nowMs(), 1_788_508_800_000);
  assert.deepEqual(await platform.playerStorage.load(), { meta: { version: 1 } });
  await platform.playerStorage.save({ meta: { version: 1 } }, true);
  platform.ready();

  assert.equal(getPlayerCalls, 1);
  assert.deepEqual(saved, [{ data: { meta: { version: 1 } }, flush: true }]);
  assert.equal(readyCalls, 1);
});

test('Yandex auth is explicit and reacquires Player after successful dialog', async () => {
  let authDialogCalls = 0;
  let getPlayerCalls = 0;
  let authorized = false;

  const makePlayer = () => ({
    getData: async () => ({ source: authorized ? 'authorized' : 'guest' }),
    setData: async () => undefined,
    isAuthorized: () => authorized,
  });

  const ysdk = createFakeYsdk({
    getPlayer: async () => {
      getPlayerCalls += 1;
      return makePlayer();
    },
    openAuthDialog: async () => {
      authDialogCalls += 1;
      authorized = true;
    },
  });

  const platform = await createYandexPlatformServices(ysdk);
  assert.equal(platform.auth.isAuthorized(), false);
  assert.deepEqual(await platform.playerStorage.load(), { source: 'guest' });
  assert.equal(authDialogCalls, 0);
  assert.equal(await platform.auth.requestAuthorization(), true);
  assert.equal(platform.auth.isAuthorized(), true);
  assert.deepEqual(await platform.playerStorage.load(), { source: 'authorized' });
  assert.equal(authDialogCalls, 1);
  assert.equal(getPlayerCalls, 2);
});

test('Yandex auth forwards account-selection event and unsubscribe exactly', async () => {
  let registeredEvent = '';
  const registered = { listener: null as (() => void) | null };
  let unsubscribeCalls = 0;
  const unsubscribe = () => { unsubscribeCalls += 1; };
  const ysdk = createFakeYsdk({
    on: (eventName, listener) => {
      registeredEvent = eventName;
      registered.listener = listener;
      return unsubscribe;
    },
  });

  const platform = await createYandexPlatformServices(ysdk);
  let selectionClosed = 0;
  const returnedUnsubscribe = platform.auth.onAccountSelectionClosed(() => {
    selectionClosed += 1;
  });

  assert.equal(registeredEvent, 'ACCOUNT_SELECTION_DIALOG_CLOSED');
  registered.listener?.();
  assert.equal(selectionClosed, 1);
  assert.equal(returnedUnsubscribe, unsubscribe);
  returnedUnsubscribe();
  assert.equal(unsubscribeCalls, 1);
});

test('Yandex adapter uses direct leaderboard APIs and normalizes entries', async () => {
  const calls: string[] = [];
  const ysdk = createFakeYsdk({
    authorized: true,
    getEntries: async (name, options) => {
      calls.push(`entries:${name}:${options.quantityTop}`);
      return {
        entries: [{
          rank: 0,
          score: 3210,
          player: { publicName: 'Ada', uniqueID: 'player-1' },
        }],
      };
    },
    getPlayerEntry: async () => ({
      rank: 4,
      score: 6000,
      player: { publicName: 'Me', uniqueID: 'me' },
    }),
    setScore: async (name, score) => {
      calls.push(`score:${name}:${score}`);
    },
  });

  const platform = await createYandexPlatformServices(ysdk);
  assert.equal(platform.leaderboards.available, true);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 }),
    [{ rank: 0, score: 3210, playerId: 'player-1', publicName: 'Ada' }],
  );
  assert.deepEqual(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    { rank: 4, score: 6000, playerId: 'me', publicName: 'Me' },
  );
  await platform.leaderboards.setScore('standard_best_time', 2500);
  assert.deepEqual(calls, [
    'entries:standard_best_time:10',
    'score:standard_best_time:2500',
  ]);
});

test('protected leaderboard methods use availability checks while public entries do not', async () => {
  const checkedMethods: string[] = [];
  let getEntriesCalls = 0;
  const platform = await createYandexPlatformServices(createFakeYsdk({
    authorized: true,
    isAvailableMethod: async (method) => {
      checkedMethods.push(method);
      return true;
    },
    getEntries: async () => {
      getEntriesCalls += 1;
      return { entries: [] };
    },
    getPlayerEntry: async () => ({
      rank: 0,
      score: 1000,
      player: { publicName: 'Me', uniqueID: 'me' },
    }),
  }));

  await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 });
  assert.equal(getEntriesCalls, 1);
  assert.deepEqual(checkedMethods, []);

  await platform.leaderboards.getPlayerEntry('standard_best_time');
  await platform.leaderboards.setScore('standard_best_time', 900);
  assert.deepEqual(checkedMethods, [
    'leaderboards.getPlayerEntry',
    'leaderboards.setScore',
  ]);
});

test('missing leaderboard player entry normalizes to null', async () => {
  const error = Object.assign(new Error('missing'), {
    code: 'LEADERBOARD_PLAYER_NOT_PRESENT',
  });
  const platform = await createYandexPlatformServices(
    createFakeYsdk({ authorized: true, getPlayerEntryError: error }),
  );

  assert.equal(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    null,
  );
});

test('Yandex adapter keeps leaderboard capability inert when namespace is absent', async () => {
  const ysdk = createFakeYsdk({ authorized: true });
  delete ysdk.leaderboards;
  const platform = await createYandexPlatformServices(ysdk);

  assert.equal(platform.leaderboards.available, false);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 }),
    [],
  );
  assert.equal(await platform.leaderboards.getPlayerEntry('standard_best_time'), null);
  await platform.leaderboards.setScore('standard_best_time', 1000);
});

test('Yandex leaderboard score rejects invalid values before SDK call', async () => {
  let setScoreCalls = 0;
  const platform = await createYandexPlatformServices(createFakeYsdk({
    authorized: true,
    setScore: async () => { setScoreCalls += 1; },
  }));

  await assert.rejects(
    platform.leaderboards.setScore('standard_best_time', Number.NaN),
    /finite non-negative/,
  );
  await assert.rejects(
    platform.leaderboards.setScore('standard_best_time', -1),
    /finite non-negative/,
  );
  assert.equal(setScoreCalls, 0);
});

test('platform loads the proxied SDK before YaGames.init and caches initialization', async () => {
  let initCalls = 0;
  let getPlayerCalls = 0;
  let readyCalls = 0;
  let appendedSrc = '';
  const player = {
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => false,
  };
  const ysdk: YandexSdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return player;
    },
    serverTime: () => 1_788_508_800_000,
    isAvailableMethod: async () => true,
    auth: { openAuthDialog: async () => undefined },
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
  };

  const fakeWindow: {
    location: { protocol: string };
    YaGames?: { init(): Promise<typeof ysdk> };
  } = {
    location: { protocol: 'https:' },
  };

  const fakeDocument = {
    createElement: (tag: string) => {
      assert.equal(tag, 'script');
      return {
        src: '',
        async: false,
        onload: null as null | (() => void),
        onerror: null as null | (() => void),
      };
    },
    head: {
      appendChild: (script: { src: string; onload: null | (() => void) }) => {
        appendedSrc = script.src;
        fakeWindow.YaGames = {
          init: async () => {
            initCalls += 1;
            return ysdk;
          },
        };
        script.onload?.();
      },
    },
  };

  (globalThis as { window: unknown }).window = fakeWindow;
  (globalThis as { document: unknown }).document = fakeDocument;

  const first = initializePlatform();
  const second = initializePlatform();

  assert.equal(first, second);
  await first;
  await notifyPlatformReady();

  assert.equal(appendedSrc, '/sdk.js');
  assert.equal(initCalls, 1);
  assert.equal(getPlayerCalls, 1);
  assert.equal(readyCalls, 1);
});

test('package exposes one-command Yandex dev proxy launch', async () => {
  const packageJson = JSON.parse(
    await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ),
  ) as { scripts?: Record<string, string> };

  assert.match(packageJson.scripts?.['yandex:dev'] ?? '', /sdk-dev-proxy/);
  assert.match(packageJson.scripts?.['yandex:dev'] ?? '', /--dev-mode=true/);
  assert.match(packageJson.scripts?.['yandex:dev'] ?? '', /pnpm build/);
});
