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

test('platform exposes the SDK environment language for preference initialization', async () => {
  const sdk = createFakeYsdk();
  sdk.environment = { i18n: { lang: 'en' } };
  const platform = await createYandexPlatformServices(sdk);
  assert.equal(platform.language, 'en');
  assert.equal(createUnavailablePlatformServices(null).language, undefined);
});

class FakeStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type EventListener = () => void;

interface FakeYsdkOptions {
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
  on?: (eventName: string, listener: EventListener) => void;
  off?: (eventName: string, listener: EventListener) => void;
  gameplayStart?: () => void | Promise<void>;
  gameplayStop?: () => void | Promise<void>;
}

function createFakeYsdk(options: FakeYsdkOptions = {}): YandexSdk {
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
    on: options.on,
    off: options.off,
    features: {
      LoadingAPI: { ready: () => undefined },
      GameplayAPI: {
        start: options.gameplayStart ?? (() => undefined),
        stop: options.gameplayStop ?? (() => undefined),
      },
    },
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
    await platform.leaderboards.getEntries('standardbesttime', { quantityTop: 10 }),
    [],
  );
  assert.equal(
    await platform.leaderboards.getPlayerEntry('standardbesttime'),
    null,
  );
  await platform.leaderboards.setScore('standardbesttime', 5000);
});

test('unavailable platform exposes inert lifecycle services', () => {
  const platform = createUnavailablePlatformServices(null);

  assert.equal(platform.platformPause.isPaused(), false);

  let pauseNotifications = 0;
  const unsubscribe = platform.platformPause.subscribe(() => {
    pauseNotifications += 1;
  });
  unsubscribe();

  platform.gameplay.start();
  platform.gameplay.stop();

  assert.equal(pauseNotifications, 0);
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

test('Yandex auth forwards account-selection event and removes the exact callback', async () => {
  const registered = new Map<string, Set<EventListener>>();
  const removed: Array<{ eventName: string; listener: EventListener }> = [];
  const on = (eventName: string, listener: EventListener) => {
    const set = registered.get(eventName) ?? new Set<EventListener>();
    set.add(listener);
    registered.set(eventName, set);
  };
  const off = (eventName: string, listener: EventListener) => {
    removed.push({ eventName, listener });
    registered.get(eventName)?.delete(listener);
  };
  const ysdk = createFakeYsdk({ on, off });

  const platform = await createYandexPlatformServices(ysdk);
  let selectionClosed = 0;
  const listener = () => { selectionClosed += 1; };
  const unsubscribe = platform.auth.onAccountSelectionClosed(listener);

  assert.ok(registered.get('ACCOUNT_SELECTION_DIALOG_CLOSED')?.has(listener));
  registered.get('ACCOUNT_SELECTION_DIALOG_CLOSED')?.forEach((callback) => callback());
  assert.equal(selectionClosed, 1);

  unsubscribe();
  assert.ok(removed.some((entry) =>
    entry.eventName === 'ACCOUNT_SELECTION_DIALOG_CLOSED'
      && entry.listener === listener));
  assert.equal(registered.get('ACCOUNT_SELECTION_DIALOG_CLOSED')?.has(listener), false);
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
    await platform.leaderboards.getEntries('standardbesttime', { quantityTop: 10 }),
    [{ rank: 1, score: 3210, playerId: 'player-1', publicName: 'Ada' }],
  );
  assert.deepEqual(
    await platform.leaderboards.getPlayerEntry('standardbesttime'),
    { rank: 5, score: 6000, playerId: 'me', publicName: 'Me' },
  );
  await platform.leaderboards.setScore('standardbesttime', 2500);
  assert.deepEqual(calls, [
    'entries:standardbesttime:10',
    'score:standardbesttime:2500',
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

  await platform.leaderboards.getEntries('standardbesttime', { quantityTop: 10 });
  assert.equal(getEntriesCalls, 1);
  assert.deepEqual(checkedMethods, []);

  await platform.leaderboards.getPlayerEntry('standardbesttime');
  await platform.leaderboards.setScore('standardbesttime', 900);
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
    await platform.leaderboards.getPlayerEntry('standardbesttime'),
    null,
  );
});

test('Yandex adapter keeps leaderboard capability inert when namespace is absent', async () => {
  const ysdk = createFakeYsdk({ authorized: true });
  delete ysdk.leaderboards;
  const platform = await createYandexPlatformServices(ysdk);

  assert.equal(platform.leaderboards.available, false);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standardbesttime', { quantityTop: 10 }),
    [],
  );
  assert.equal(await platform.leaderboards.getPlayerEntry('standardbesttime'), null);
  await platform.leaderboards.setScore('standardbesttime', 1000);
});

test('Yandex leaderboard score rejects invalid values before SDK call', async () => {
  let setScoreCalls = 0;
  const platform = await createYandexPlatformServices(createFakeYsdk({
    authorized: true,
    setScore: async () => { setScoreCalls += 1; },
  }));

  await assert.rejects(
    platform.leaderboards.setScore('standardbesttime', Number.NaN),
    /finite positive/,
  );
  await assert.rejects(
    platform.leaderboards.setScore('standardbesttime', 0),
    /finite positive/,
  );
  await assert.rejects(
    platform.leaderboards.setScore('standardbesttime', -1),
    /finite positive/,
  );
  assert.equal(setScoreCalls, 0);
});

test('Yandex pause service caches pause state and emits only logical changes', async () => {
  const listeners = new Map<string, Set<EventListener>>();
  const on = (eventName: string, listener: EventListener) => {
    const set = listeners.get(eventName) ?? new Set<EventListener>();
    set.add(listener);
    listeners.set(eventName, set);
  };
  const off = (eventName: string, listener: EventListener) => {
    listeners.get(eventName)?.delete(listener);
  };
  const emit = (eventName: string) => {
    listeners.get(eventName)?.forEach((listener) => listener());
  };

  const platform = await createYandexPlatformServices(createFakeYsdk({ on, off }));
  const observed: boolean[] = [];
  const unsubscribe = platform.platformPause.subscribe((paused) => {
    observed.push(paused);
  });

  emit('game_api_pause');
  emit('game_api_pause');
  emit('game_api_resume');
  emit('game_api_resume');

  assert.deepEqual(observed, [true, false]);
  assert.equal(platform.platformPause.isPaused(), false);

  unsubscribe();
  const observedAfterUnsubscribe = [...observed];
  emit('game_api_pause');
  assert.deepEqual(observed, observedAfterUnsubscribe);
  assert.equal(platform.platformPause.isPaused(), true);
});

test('Yandex pause unsubscribe removes the exact registered callbacks', async () => {
  const registered = new Map<string, Set<EventListener>>();
  const removed: Array<{ eventName: string; listener: EventListener }> = [];

  const on = (eventName: string, listener: EventListener) => {
    const set = registered.get(eventName) ?? new Set<EventListener>();
    set.add(listener);
    registered.set(eventName, set);
  };

  const off = (eventName: string, listener: EventListener) => {
    removed.push({ eventName, listener });
    registered.get(eventName)?.delete(listener);
  };

  const platform = await createYandexPlatformServices(createFakeYsdk({ on, off }));
  const unsubscribe = platform.platformPause.subscribe(() => undefined);

  const pauseListener = [...(registered.get('game_api_pause') ?? [])][0];
  const resumeListener = [...(registered.get('game_api_resume') ?? [])][0];

  unsubscribe();

  assert.ok(pauseListener !== undefined);
  assert.ok(resumeListener !== undefined);
  assert.ok(
    removed.some((entry) =>
      entry.eventName === 'game_api_pause' && entry.listener === pauseListener),
  );
  assert.ok(
    removed.some((entry) =>
      entry.eventName === 'game_api_resume' && entry.listener === resumeListener),
  );
});

test('Yandex pause state is available before slow Player acquisition finishes', async () => {
  let resolvePlayer!: (player: {
    getData: () => Promise<Record<string, unknown>>;
    setData: () => Promise<void>;
    isAuthorized: () => boolean;
  }) => void;

  const playerPromise = new Promise<{
    getData: () => Promise<Record<string, unknown>>;
    setData: () => Promise<void>;
    isAuthorized: () => boolean;
  }>((resolve) => {
    resolvePlayer = resolve;
  });

  const listeners = new Map<string, Set<EventListener>>();
  const on = (eventName: string, listener: EventListener) => {
    const set = listeners.get(eventName) ?? new Set<EventListener>();
    set.add(listener);
    listeners.set(eventName, set);
  };
  const off = (eventName: string, listener: EventListener) => {
    listeners.get(eventName)?.delete(listener);
  };

  const platformPromise = createYandexPlatformServices(createFakeYsdk({
    getPlayer: () => playerPromise,
    on,
    off,
  }));

  listeners.get('game_api_pause')?.forEach((listener) => listener());

  const outcome = await Promise.race([
    platformPromise.then((platform) => ({ kind: 'platform' as const, platform })),
    new Promise<{ kind: 'timeout' }>((resolve) => {
      setTimeout(() => resolve({ kind: 'timeout' }), 20);
    }),
  ]);

  resolvePlayer({
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => false,
  });

  assert.equal(outcome.kind, 'platform');
  if (outcome.kind !== 'platform') return;

  assert.equal(outcome.platform.platformPause.isPaused(), true);
  assert.deepEqual(await outcome.platform.playerStorage.load(), {});
});

test('Yandex gameplay markup delegates to optional GameplayAPI', async () => {
  const calls: string[] = [];
  const platform = await createYandexPlatformServices(createFakeYsdk({
    gameplayStart: () => { calls.push('start'); },
    gameplayStop: () => { calls.push('stop'); },
  }));

  platform.gameplay.start();
  platform.gameplay.stop();

  assert.deepEqual(calls, ['start', 'stop']);
});

test('Yandex gameplay markup failures are non-fatal', async () => {
  const platform = await createYandexPlatformServices(createFakeYsdk({
    gameplayStart: () => { throw new Error('start failed'); },
    gameplayStop: async () => { throw new Error('stop failed'); },
  }));

  assert.doesNotThrow(() => platform.gameplay.start());
  assert.doesNotThrow(() => platform.gameplay.stop());

  await new Promise((resolve) => setTimeout(resolve, 0));
});

test('Yandex gameplay markup stays inert when GameplayAPI is absent', async () => {
  const ysdk = createFakeYsdk();
  if (ysdk.features !== undefined) {
    delete ysdk.features.GameplayAPI;
  }

  const platform = await createYandexPlatformServices(ysdk);

  assert.doesNotThrow(() => platform.gameplay.start());
  assert.doesNotThrow(() => platform.gameplay.stop());
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
  const { readFile } = await import('node:fs/promises');
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts?: Record<string, string> };
  const launcherSource = await readFile(
    new URL('../scripts/yandex-dev-proxy.mjs', import.meta.url),
    'utf8',
  );

  assert.match(packageJson.scripts?.['yandex:dev'] ?? '', /pnpm build/);
  assert.match(packageJson.scripts?.['yandex:dev'] ?? '', /scripts\/yandex-dev-proxy\.mjs/);
  assert.match(launcherSource, /createProxyLaunch/);
  const { createProxyLaunch } = await import(new URL('../scripts/yandex-dev-proxy-lib.mjs', import.meta.url).href);
  const launch = createProxyLaunch(8080, 'linux');
  assert.ok(launch.args.includes('@yandex-games/sdk-dev-proxy'));
  assert.ok(launch.args.includes('--dev-mode=true'));
  assert.ok(launch.args.includes('--port=8080'));
});
