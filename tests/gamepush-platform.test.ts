import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/platform/gamepush.ts');
  } catch {
    return null;
  }
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

function fakeGamePush() {
  const fields = new Map<string, unknown>();
  const listeners = new Map<string, Array<(value?: unknown) => void>>();
  const calls = {
    sync: [] as unknown[],
    gameStart: 0,
    gameplayStart: 0,
    gameplayStop: 0,
    fullscreen: 0,
  };
  const player = {
    ready: Promise.resolve(),
    isLoggedIn: false,
    id: 17,
    name: 'Guest',
    avatar: '',
    get(key: string) { return fields.get(key); },
    set(key: string, value: unknown) { fields.set(key, value); },
    async sync(options?: unknown) { calls.sync.push(options); return true; },
    async login() {
      player.isLoggedIn = true;
      player.name = 'Player';
      for (const listener of listeners.get('login') ?? []) listener(true);
      return true;
    },
    on(event: string, listener: (value?: unknown) => void) {
      const current = listeners.get(event) ?? [];
      current.push(listener);
      listeners.set(event, current);
    },
  };
  return {
    player,
    leaderboard: {
      async fetchScoped() { return { topPlayers: [] }; },
      async fetchPlayerRatingScoped() { return { player: null }; },
      async publishRecord() { return { record: {}, fields: [] }; },
    },
    ads: {
      isFullscreenAvailable: true,
      async showFullscreen() { calls.fullscreen += 1; return true; },
    },
    language: 'ru',
    serverTime: '2026-09-21T08:30:00.000Z',
    isPaused: false,
    on() {},
    async gameStart() { calls.gameStart += 1; },
    async gameplayStart() { calls.gameplayStart += 1; },
    async gameplayStop() { calls.gameplayStop += 1; },
    __fields: fields,
    __calls: calls,
  };
}

test('Pikabu target has a GamePush platform adapter', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  assert.equal(typeof mod.createGamePushPlatformServices, 'function');
  assert.equal(typeof mod.initializeGamePushPlatform, 'function');
});

test('GamePush guest remains local-first and authorization switches profile scope', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const gp = fakeGamePush();
  const platform = mod.createGamePushPlatformServices(gp as never, memoryStorage());

  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(platform.auth.playerStorageScopeChangesOnAuthorization, true);
  assert.equal(await platform.playerStorage.scope?.(), 'browser-local');
  await platform.playerStorage.saveStrict?.({ value: 7 }, true);
  assert.deepEqual(await platform.playerStorage.loadStrict?.(), { value: 7 });
  assert.equal(gp.__calls.sync.length, 0);

  assert.equal(await platform.auth.requestAuthorization(), true);
  assert.equal(await platform.playerStorage.scope?.(), 'gamepush:17');
  await platform.playerStorage.saveStrict?.({ cascadeMeta: { wins: 3 } }, true);
  assert.deepEqual(JSON.parse(String(gp.__fields.get('cascadeProfile'))), { cascadeMeta: { wins: 3 } });
  assert.deepEqual(gp.__calls.sync, [{ storage: 'cloud' }]);
});

test('GamePush platform exposes server time, lifecycle and fullscreen ads', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const gp = fakeGamePush();
  const platform = mod.createGamePushPlatformServices(gp as never, memoryStorage());

  assert.equal(platform.trustedClock.nowMs(), Date.parse('2026-09-21T08:30:00.000Z'));
  platform.ready();
  platform.ready();
  platform.gameplay.start();
  platform.gameplay.stop();
  assert.equal(await platform.ads.showInterstitial(), true);
  await Promise.resolve();
  assert.equal(gp.__calls.gameStart, 1);
  assert.equal(gp.__calls.gameplayStart, 1);
  assert.equal(gp.__calls.gameplayStop, 1);
  assert.equal(gp.__calls.fullscreen, 1);
});

test('GamePush initialization failure falls back to local-only platform services', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const storage = memoryStorage();
  const platform = await mod.createGamePushPlatformFromSdk(undefined, storage);

  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(platform.leaderboards.available, false);
  await platform.playerStorage.save({ local: true }, true);
  assert.deepEqual(await platform.playerStorage.load(), { local: true });
});
