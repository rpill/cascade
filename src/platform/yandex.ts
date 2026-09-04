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

let platformPromise: Promise<PlatformServices> | null = null;

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
