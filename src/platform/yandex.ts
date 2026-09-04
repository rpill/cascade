import {
  createUnavailablePlatformServices,
  type PlatformServices,
} from './services.ts';

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface YandexSdk {
  getPlayer(): Promise<YandexPlayer>;
  serverTime(): number;
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
  };
}

interface YandexGamesApi {
  init(): Promise<YandexSdk>;
}

declare global {
  interface Window {
    YaGames?: YandexGamesApi;
  }
}

const YANDEX_SDK_PATH = '/sdk.js';

let platformPromise: Promise<PlatformServices> | null = null;
let sdkScriptPromise: Promise<void> | null = null;

async function ensureYandexSdkLoaded(): Promise<void> {
  if (typeof window === 'undefined' || window.YaGames !== undefined) {
    return;
  }

  // Plain Vite development runs over HTTP and intentionally keeps the
  // platform unavailable. Yandex production and sdk-dev-proxy run over HTTPS.
  if (window.location?.protocol !== 'https:' || typeof document === 'undefined') {
    return;
  }

  if (sdkScriptPromise === null) {
    sdkScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = YANDEX_SDK_PATH;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Yandex Games SDK.'));
      document.head.appendChild(script);
    });
  }

  await sdkScriptPromise;
}

export async function createYandexPlatformServices(
  ysdk: YandexSdk,
): Promise<PlatformServices> {
  const player = await ysdk.getPlayer();

  return {
    playerStorage: {
      load: () => player.getData(),
      save: (data, flush = false) => player.setData(data, flush),
    },
    trustedClock: {
      nowMs: () => ysdk.serverTime(),
    },
    ready: () => ysdk.features?.LoadingAPI?.ready(),
  };
}

export function initializePlatform(): Promise<PlatformServices> {
  if (platformPromise !== null) {
    return platformPromise;
  }

  platformPromise = (async () => {
    try {
      await ensureYandexSdkLoaded();
      const ysdk = typeof window === 'undefined'
        ? undefined
        : await window.YaGames?.init();

      return ysdk === undefined
        ? createUnavailablePlatformServices()
        : createYandexPlatformServices(ysdk);
    } catch {
      return createUnavailablePlatformServices();
    }
  })();

  return platformPromise;
}

export async function notifyPlatformReady(): Promise<void> {
  const platform = await initializePlatform();
  platform.ready();
}
