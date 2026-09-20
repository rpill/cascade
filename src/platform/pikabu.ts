import { BackendClient } from '../backend/BackendClient.ts';
import { resolveBackendUrl } from '../backend/BackendConfig.ts';
import { BackendLeaderboards } from '../backend/BackendLeaderboards.ts';
import { CloudSyncStateStore } from '../cloud/CloudSyncState.ts';
import {
  createBrowserPlayerStorage,
  createUnavailablePlatformServices,
  type BackendIdentityProvider,
  type BrowserStorageLike,
  type PlatformPause,
  type PlatformServices,
} from './services.ts';

const PIKABU_SDK_URL = 'https://games.pikabu.ru/sdk/sdk.js';

export interface PikabuPlayer {
  id: string;
  name: string;
  avatar: string;
  isAuthorized: boolean;
  getSignedData(): Promise<string>;
}

export interface PikabuSdk {
  player: PikabuPlayer;
  auth: { openAuthDialog(): Promise<void> };
  gameStarted(): void | Promise<void>;
  once(event: 'userAuthorized' | string, listener: () => void): void;
}

export interface PikabuSdkGlobal {
  init(): Promise<PikabuSdk>;
}

declare global {
  interface Window { PkbSDK?: PikabuSdkGlobal }
}

let scriptPromise: Promise<void> | null = null;
let platformPromise: Promise<PlatformServices> | null = null;

async function ensurePikabuSdkLoaded(): Promise<void> {
  if (typeof window === 'undefined' || window.PkbSDK !== undefined) return;
  if (typeof document === 'undefined') throw new Error('Pikabu SDK is unavailable outside a browser.');
  if (scriptPromise === null) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PIKABU_SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pikabu Games SDK.'));
      (document.body ?? document.head).appendChild(script);
    });
  }
  await scriptPromise;
}

function createAuthPause(): { pause: PlatformPause; setPaused(value: boolean): void } {
  let paused = false;
  const listeners = new Set<(paused: boolean) => void>();
  return {
    pause: {
      isPaused: () => paused,
      subscribe(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    },
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      for (const listener of listeners) listener(paused);
    },
  };
}

export function createPikabuPlatformServices(
  sdk: PikabuSdk,
  storage?: BrowserStorageLike | null,
  backendUrlOverride?: string | null,
): PlatformServices {
  const playerStorage = createBrowserPlayerStorage(storage);
  const accountListeners = new Set<() => void>();
  const authPause = createAuthPause();
  let readySent = false;

  sdk.once('userAuthorized', () => {
    for (const listener of accountListeners) listener();
  });

  const backendIdentity: BackendIdentityProvider = {
    isAuthorized: () => sdk.player.isAuthorized === true,
    localIdentityKey: () => {
      const id = sdk.player.id?.trim();
      return id ? id : null;
    },
    async getAssertion() {
      if (sdk.player.isAuthorized !== true) return null;
      const value = (await sdk.player.getSignedData()).trim();
      return value ? { provider: 'pikabu', value } : null;
    },
  };

  const backendUrl = backendUrlOverride === undefined ? resolveBackendUrl() : backendUrlOverride;
  const backendLeaderboards = backendUrl
    ? new BackendLeaderboards({
      client: new BackendClient(backendUrl, backendIdentity),
      identity: backendIdentity,
      stateStoreFactory: (provider, key) => new CloudSyncStateStore(provider, key, storage),
    })
    : null;

  return {
    playerStorage,
    trustedClock: { nowMs: () => null },
    auth: {
      playerStorageScopeChangesOnAuthorization: false,
      isAuthorized: () => sdk.player.isAuthorized === true,
      async requestAuthorization() {
        const isAuthorized = () => sdk.player.isAuthorized === true;
        if (isAuthorized()) return true;
        authPause.setPaused(true);
        try { await sdk.auth.openAuthDialog(); }
        catch { return false; }
        finally { authPause.setPaused(false); }
        return isAuthorized();
      },
      onAccountSelectionClosed(listener) {
        accountListeners.add(listener);
        return () => { accountListeners.delete(listener); };
      },
    },
    leaderboards: backendLeaderboards ?? {
      available: false,
      getEntries: async () => [],
      getPlayerEntry: async () => null,
      setScore: async () => undefined,
    },
    ads: { available: false, showInterstitial: async () => false },
    platformPause: authPause.pause,
    gameplay: { start: () => undefined, stop: () => undefined },
    backendIdentity,
    ready: () => {
      if (readySent) return;
      readySent = true;
      try { void sdk.gameStarted(); } catch { /* platform ready is best-effort */ }
    },
  };
}

export async function createPikabuPlatformFromApi(
  api: PikabuSdkGlobal | undefined,
): Promise<PlatformServices> {
  if (api === undefined) return createUnavailablePlatformServices();
  try { return createPikabuPlatformServices(await api.init()); }
  catch { return createUnavailablePlatformServices(); }
}

export function initializePikabuPlatform(): Promise<PlatformServices> {
  if (platformPromise !== null) return platformPromise;
  platformPromise = (async () => {
    try {
      await ensurePikabuSdkLoaded();
      const api = typeof window === 'undefined' ? undefined : window.PkbSDK;
      return await createPikabuPlatformFromApi(api);
    } catch {
      return createUnavailablePlatformServices();
    }
  })();
  return platformPromise;
}
