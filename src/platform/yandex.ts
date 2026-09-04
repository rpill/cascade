import {
  createUnavailablePlatformServices,
  type PlatformLeaderboardEntry,
  type PlatformLeaderboards,
  type PlatformServices,
} from './services.ts';

interface YandexLeaderboardEntry {
  rank: number;
  score: number;
  player: {
    publicName: string;
    uniqueID: string;
  };
}

interface YandexLeaderboards {
  getEntries(
    technicalName: string,
    options: { quantityTop: number },
  ): Promise<{ entries: YandexLeaderboardEntry[] }>;
  getPlayerEntry(technicalName: string): Promise<YandexLeaderboardEntry>;
  setScore(technicalName: string, score: number): Promise<void>;
}

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  isAuthorized(): boolean;
}

export interface YandexSdk {
  getPlayer(): Promise<YandexPlayer>;
  serverTime(): number;
  isAvailableMethod(method: string): Promise<boolean>;
  auth: {
    openAuthDialog(): Promise<void>;
  };
  leaderboards?: YandexLeaderboards;
  EVENTS?: {
    ACCOUNT_SELECTION_DIALOG_CLOSED: string;
  };
  on?: (eventName: string, listener: () => void) => () => void;
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

function toPlatformEntry(entry: YandexLeaderboardEntry): PlatformLeaderboardEntry {
  return {
    rank: entry.rank,
    score: entry.score,
    playerId: entry.player.uniqueID,
    publicName: entry.player.publicName,
  };
}

async function requireMethod(ysdk: YandexSdk, method: string): Promise<void> {
  if (!(await ysdk.isAvailableMethod(method))) {
    throw new Error(`Yandex method is unavailable: ${method}`);
  }
}

function isPlayerNotPresentError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'LEADERBOARD_PLAYER_NOT_PRESENT';
}

function createUnavailableLeaderboards(): PlatformLeaderboards {
  return {
    available: false,
    getEntries: async () => [],
    getPlayerEntry: async () => null,
    setScore: async () => undefined,
  };
}

function createYandexLeaderboards(
  ysdk: YandexSdk,
  leaderboards: YandexLeaderboards | undefined,
): PlatformLeaderboards {
  if (leaderboards === undefined) {
    return createUnavailableLeaderboards();
  }

  return {
    available: true,
    async getEntries(technicalName, options) {
      const response = await leaderboards.getEntries(technicalName, {
        quantityTop: options.quantityTop,
      });
      return response.entries.map(toPlatformEntry);
    },
    async getPlayerEntry(technicalName) {
      await requireMethod(ysdk, 'leaderboards.getPlayerEntry');

      try {
        return toPlatformEntry(await leaderboards.getPlayerEntry(technicalName));
      } catch (error) {
        if (isPlayerNotPresentError(error)) {
          return null;
        }
        throw error;
      }
    },
    async setScore(technicalName, score) {
      if (!Number.isFinite(score) || score < 0) {
        throw new Error('Leaderboard score must be a finite non-negative number.');
      }

      await requireMethod(ysdk, 'leaderboards.setScore');
      await leaderboards.setScore(technicalName, score);
    },
  };
}

export async function createYandexPlatformServices(
  ysdk: YandexSdk,
): Promise<PlatformServices> {
  let player = await ysdk.getPlayer();

  return {
    playerStorage: {
      load: () => player.getData(),
      save: (data, flush = false) => player.setData(data, flush),
    },
    trustedClock: {
      nowMs: () => ysdk.serverTime(),
    },
    auth: {
      isAuthorized: () => player.isAuthorized(),
      requestAuthorization: async () => {
        if (player.isAuthorized()) {
          return true;
        }

        try {
          await ysdk.auth.openAuthDialog();
          player = await ysdk.getPlayer();
          return player.isAuthorized();
        } catch {
          return false;
        }
      },
      onAccountSelectionClosed: (listener) => {
        const eventName = ysdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
        if (eventName === undefined || ysdk.on === undefined) {
          return () => undefined;
        }
        return ysdk.on(eventName, listener);
      },
    },
    leaderboards: createYandexLeaderboards(ysdk, ysdk.leaderboards),
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
