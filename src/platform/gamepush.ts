import { GamePushLeaderboards, type GamePushLeaderboardApi } from './GamePushLeaderboards.ts';
import { resolveGamePushConfig, type GamePushPublicConfig } from './GamePushConfig.ts';
import {
  createBrowserPlayerStorage,
  createUnavailablePlatformServices,
  type BrowserStorageLike,
  type PlatformPause,
  type PlatformServices,
  type PlayerStorage,
} from './services.ts';

const GAMEPUSH_PROFILE_FIELD = 'cascadeProfile';
const GAMEPUSH_SDK_SOURCES = [
  'https://gs.eponesh.com/sdk/game-score.js',
  'https://s3.gamepush.com/files/gs/sdk/game-score.js',
  'https://s3-eu.gamepush.com/sdk/game-score.js',
  'https://gamepush.com/sdk/game-score.js',
] as const;
const GAMEPUSH_LOAD_TIMEOUT_MS = 15_000;

export interface GamePushPlayer {
  readonly ready: Promise<unknown>;
  isLoggedIn: boolean;
  readonly id: string | number;
  readonly name: string;
  readonly avatar: string;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  sync(options?: { readonly storage?: 'preferred' | 'cloud' | 'platform' | 'local'; readonly override?: boolean }): Promise<boolean | void>;
  login(): Promise<boolean>;
  on(event: string, listener: (success?: boolean) => void): void;
}

export interface GamePushAds {
  readonly isFullscreenAvailable: boolean;
  showFullscreen(options?: { readonly showCountdownOverlay?: boolean }): Promise<boolean>;
}

export interface GamePushSdk {
  readonly player: GamePushPlayer;
  readonly leaderboard: GamePushLeaderboardApi;
  readonly ads: GamePushAds;
  readonly language?: string;
  readonly serverTime: string;
  readonly isPaused: boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
  gameStart(): Promise<void> | void;
  gameplayStart(): Promise<void> | void;
  gameplayStop(): Promise<void> | void;
}

declare global {
  interface Window {
    onGPInit?: (gp: GamePushSdk) => void | Promise<void>;
  }
}

let sdkPromise: Promise<GamePushSdk> | null = null;
let platformPromise: Promise<PlatformServices> | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveBrowserStorage(): BrowserStorageLike | null {
  try { return (globalThis as { localStorage?: BrowserStorageLike }).localStorage ?? null; }
  catch { return null; }
}

function isAuthorized(gp: GamePushSdk): boolean {
  return gp.player.isLoggedIn === true;
}

function parseServerTime(gp: GamePushSdk): number | null {
  const value = Date.parse(gp.serverTime);
  return Number.isFinite(value) ? value : null;
}

function createGamePushPlayerStorage(
  gp: GamePushSdk,
  storage: BrowserStorageLike | null,
): PlayerStorage {
  const local = createBrowserPlayerStorage(storage);

  const loadCloud = (): Record<string, unknown> => {
    const raw = gp.player.get(GAMEPUSH_PROFILE_FIELD);
    if (raw === undefined || raw === null || raw === '') return {};
    if (typeof raw !== 'string') throw new Error('Invalid GamePush Cascade profile');
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error('Invalid GamePush Cascade profile');
    return parsed;
  };

  const saveCloud = async (data: Record<string, unknown>, strict: boolean): Promise<void> => {
    gp.player.set(GAMEPUSH_PROFILE_FIELD, JSON.stringify(data));
    try {
      const success = await gp.player.sync({ storage: 'cloud' });
      if (strict && success === false) throw new Error('GamePush cloud sync failed');
    } catch (error) {
      if (strict) throw error;
    }
  };

  return {
    async scope() {
      return isAuthorized(gp) ? `gamepush:${String(gp.player.id)}` : 'browser-local';
    },
    async loadStrict() {
      return isAuthorized(gp) ? loadCloud() : local.loadStrict!();
    },
    async saveStrict(data) {
      if (isAuthorized(gp)) await saveCloud(data, true);
      else await local.saveStrict!(data, true);
    },
    async load() {
      if (!isAuthorized(gp)) return local.load();
      try { return loadCloud(); }
      catch { return {}; }
    },
    async save(data) {
      if (!isAuthorized(gp)) {
        await local.save(data, true);
        return;
      }
      await saveCloud(data, false);
    },
  };
}

function createPlatformPause(gp: GamePushSdk): PlatformPause {
  let paused = gp.isPaused === true;
  const listeners = new Set<(paused: boolean) => void>();
  const update = (next: boolean) => {
    if (paused === next) return;
    paused = next;
    for (const listener of listeners) listener(paused);
  };
  gp.on('pause', () => update(true));
  gp.on('resume', () => update(false));
  return {
    isPaused: () => paused,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export function createGamePushPlatformServices(
  gp: GamePushSdk,
  storage: BrowserStorageLike | null = resolveBrowserStorage(),
): PlatformServices {
  const playerStorage = createGamePushPlayerStorage(gp, storage);
  const platformPause = createPlatformPause(gp);
  const accountListeners = new Set<() => void>();
  let readySent = false;
  let authRequestInFlight = false;

  gp.player.on('login', (success) => {
    if (success !== true || authRequestInFlight) return;
    for (const listener of accountListeners) listener();
  });

  const trustedNow = () => parseServerTime(gp);
  const leaderboards = new GamePushLeaderboards(gp.leaderboard, () => trustedNow() ?? Date.now());

  return {
    language: gp.language,
    playerStorage,
    trustedClock: { nowMs: trustedNow },
    auth: {
      playerStorageScopeChangesOnAuthorization: true,
      isAuthorized: () => isAuthorized(gp),
      async requestAuthorization() {
        if (isAuthorized(gp)) return true;
        authRequestInFlight = true;
        try {
          const success = await gp.player.login();
          return success === true && isAuthorized(gp);
        } catch {
          return false;
        } finally {
          authRequestInFlight = false;
        }
      },
      onAccountSelectionClosed(listener) {
        accountListeners.add(listener);
        return () => { accountListeners.delete(listener); };
      },
    },
    leaderboards,
    ads: {
      get available() { return gp.ads.isFullscreenAvailable === true; },
      async showInterstitial() {
        if (gp.ads.isFullscreenAvailable !== true) return false;
        try { return await gp.ads.showFullscreen(); }
        catch { return false; }
      },
    },
    platformPause,
    gameplay: {
      start: () => { try { void gp.gameplayStart(); } catch { /* best-effort platform markup */ } },
      stop: () => { try { void gp.gameplayStop(); } catch { /* best-effort platform markup */ } },
    },
    ready: () => {
      if (readySent) return;
      readySent = true;
      try { void gp.gameStart(); } catch { /* best-effort platform ready */ }
    },
  };
}

function sdkSuffix(config: GamePushPublicConfig): string {
  return `?projectId=${encodeURIComponent(String(config.projectId))}&publicToken=${encodeURIComponent(config.publicToken)}&callback=onGPInit`;
}

function loadGamePushSdk(config: GamePushPublicConfig = resolveGamePushConfig()): Promise<GamePushSdk> {
  if (sdkPromise !== null) return sdkPromise;
  sdkPromise = new Promise<GamePushSdk>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('GamePush SDK is unavailable outside a browser.'));
      return;
    }

    let settled = false;
    let sourceIndex = 0;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('GamePush SDK initialization timed out.'));
    }, GAMEPUSH_LOAD_TIMEOUT_MS);

    window.onGPInit = async (gp) => {
      if (settled) return;
      try {
        await gp.player.ready;
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(gp);
      } catch (error) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(error);
      }
    };

    const tryNextSource = () => {
      if (settled) return;
      const source = GAMEPUSH_SDK_SOURCES[sourceIndex++];
      if (!source) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(new Error('Failed to load GamePush SDK.'));
        return;
      }
      const script = document.createElement('script');
      script.async = true;
      script.src = `${source}${sdkSuffix(config)}`;
      script.onerror = () => {
        script.remove();
        tryNextSource();
      };
      (document.body ?? document.head).appendChild(script);
    };

    tryNextSource();
  });
  return sdkPromise;
}

export async function createGamePushPlatformFromSdk(
  gp: GamePushSdk | undefined,
  storage?: BrowserStorageLike | null,
): Promise<PlatformServices> {
  if (gp === undefined) return createUnavailablePlatformServices(storage);
  try {
    await gp.player.ready;
    return createGamePushPlatformServices(gp, storage === undefined ? resolveBrowserStorage() : storage);
  } catch {
    return createUnavailablePlatformServices(storage);
  }
}

export function initializeGamePushPlatform(): Promise<PlatformServices> {
  if (platformPromise !== null) return platformPromise;
  platformPromise = (async () => {
    try { return createGamePushPlatformServices(await loadGamePushSdk()); }
    catch { return createUnavailablePlatformServices(); }
  })();
  return platformPromise;
}
