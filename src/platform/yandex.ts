import {
  createUnavailablePlatformServices,
  type GameplayMarkup,
  type PlatformLeaderboardEntry,
  type PlatformLeaderboards,
  type PlatformPause,
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

type YandexEventListener = () => void;

interface YandexGameplayApi {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}

interface YandexPlayer {
  getUniqueID?(): string;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  isAuthorized(): boolean;
}

export interface YandexSdk {
  environment?: { i18n?: { lang?: string } };
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
  on?: (eventName: string, listener: YandexEventListener) => void;
  off?: (eventName: string, listener: YandexEventListener) => void;
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
    GameplayAPI?: YandexGameplayApi;
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
const GAME_API_PAUSE = 'game_api_pause';
const GAME_API_RESUME = 'game_api_resume';

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
    rank: entry.rank + 1,
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
      if (!Number.isFinite(score) || score <= 0) {
        throw new Error('Leaderboard score must be a finite positive number.');
      }

      await requireMethod(ysdk, 'leaderboards.setScore');
      await leaderboards.setScore(technicalName, score);
    },
  };
}

function ignoreSdkCall(call: () => void | Promise<void>): void {
  try {
    void Promise.resolve(call()).catch(() => undefined);
  } catch {
    // Optional platform telemetry must never break local gameplay.
  }
}

function createGameplayMarkup(ysdk: YandexSdk): GameplayMarkup {
  return {
    start: () => {
      const start = ysdk.features?.GameplayAPI?.start;
      if (start !== undefined) {
        ignoreSdkCall(() => start.call(ysdk.features!.GameplayAPI));
      }
    },
    stop: () => {
      const stop = ysdk.features?.GameplayAPI?.stop;
      if (stop !== undefined) {
        ignoreSdkCall(() => stop.call(ysdk.features!.GameplayAPI));
      }
    },
  };
}

function createYandexPlatformPause(ysdk: YandexSdk): PlatformPause {
  if (ysdk.on === undefined || ysdk.off === undefined) {
    return {
      isPaused: () => false,
      subscribe: () => () => undefined,
    };
  }

  let paused = false;
  let subscribers = 0;
  let cacheAttached = false;

  const cachePause = () => { paused = true; };
  const cacheResume = () => { paused = false; };

  const attachCache = () => {
    if (cacheAttached) return;
    ysdk.on!(GAME_API_PAUSE, cachePause);
    ysdk.on!(GAME_API_RESUME, cacheResume);
    cacheAttached = true;
  };

  const detachCache = () => {
    if (!cacheAttached) return;
    ysdk.off!(GAME_API_PAUSE, cachePause);
    ysdk.off!(GAME_API_RESUME, cacheResume);
    cacheAttached = false;
  };

  attachCache();

  return {
    isPaused: () => paused,
    subscribe(listener) {
      const onPause = () => {
        if (paused) return;
        paused = true;
        listener(true);
      };
      const onResume = () => {
        if (!paused) return;
        paused = false;
        listener(false);
      };

      ysdk.on!(GAME_API_PAUSE, onPause);
      ysdk.on!(GAME_API_RESUME, onResume);

      if (subscribers === 0) {
        detachCache();
      }
      subscribers += 1;

      let active = true;
      return () => {
        if (!active) return;
        active = false;

        if (subscribers === 1) {
          attachCache();
        }

        ysdk.off!(GAME_API_PAUSE, onPause);
        ysdk.off!(GAME_API_RESUME, onResume);
        subscribers -= 1;
      };
    },
  };
}

export async function createYandexPlatformServices(
  ysdk: YandexSdk,
): Promise<PlatformServices> {
  let playerPromise = ysdk.getPlayer();
  let player: YandexPlayer | null = null;

  const getPlayer = async (): Promise<YandexPlayer> => {
    if (player !== null) {
      return player;
    }
    player = await playerPromise;
    return player;
  };

  const reacquirePlayer = async (): Promise<YandexPlayer> => {
    playerPromise = ysdk.getPlayer();
    player = await playerPromise;
    return player;
  };

  const platformPause = createYandexPlatformPause(ysdk);

  return {
    language: ysdk.environment?.i18n?.lang,
    playerStorage: {
      scope: async () => `yandex-${(await getPlayer()).getUniqueID?.() ?? 'player'}`,
      load: async () => (await getPlayer()).getData(),
      save: async (data, flush = false) =>
        (await getPlayer()).setData(data, flush),
    },
    trustedClock: {
      nowMs: () => ysdk.serverTime(),
    },
    auth: {
      isAuthorized: () => player?.isAuthorized() ?? false,
      requestAuthorization: async () => {
        const currentPlayer = await getPlayer();

        if (currentPlayer.isAuthorized()) {
          return true;
        }

        try {
          await ysdk.auth.openAuthDialog();
          return (await reacquirePlayer()).isAuthorized();
        } catch {
          return false;
        }
      },
      onAccountSelectionClosed: (listener) => {
        const eventName = ysdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
        if (
          eventName === undefined
          || ysdk.on === undefined
          || ysdk.off === undefined
        ) {
          return () => undefined;
        }

        ysdk.on(eventName, listener);

        let active = true;
        return () => {
          if (!active) return;
          active = false;
          ysdk.off!(eventName, listener);
        };
      },
    },
    leaderboards: createYandexLeaderboards(ysdk, ysdk.leaderboards),
    platformPause,
    gameplay: createGameplayMarkup(ysdk),
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
