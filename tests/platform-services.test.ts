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

test('Yandex adapter reads trusted time and structured player data through one player object', async () => {
  const saved: Array<{ data: Record<string, unknown>; flush: boolean }> = [];
  let getPlayerCalls = 0;
  let readyCalls = 0;
  const player = {
    getData: async () => ({ meta: { version: 1 } }),
    setData: async (data: Record<string, unknown>, flush = false) => {
      saved.push({ data, flush });
    },
  };
  const ysdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return player;
    },
    serverTime: () => 1_788_508_800_000,
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


test('platform initialization caches YaGames.init and the player adapter for readiness', async () => {
  let initCalls = 0;
  let getPlayerCalls = 0;
  let readyCalls = 0;
  const player = {
    getData: async () => ({}),
    setData: async () => undefined,
  };
  const ysdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return player;
    },
    serverTime: () => 1_788_508_800_000,
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
  };

  (globalThis as { window: unknown }).window = {
    YaGames: {
      init: async () => {
        initCalls += 1;
        return ysdk;
      },
    },
  };

  const first = initializePlatform();
  const second = initializePlatform();

  assert.equal(first, second);
  await first;
  await notifyPlatformReady();

  assert.equal(initCalls, 1);
  assert.equal(getPlayerCalls, 1);
  assert.equal(readyCalls, 1);
});
