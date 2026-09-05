export interface PlayerStorage {
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock {
  nowMs(): number | null;
}

export interface PlatformPause {
  isPaused(): boolean;
  subscribe(listener: (paused: boolean) => void): () => void;
}

export interface GameplayMarkup {
  start(): void;
  stop(): void;
}

export interface PlatformAuth {
  isAuthorized(): boolean;
  requestAuthorization(): Promise<boolean>;
  onAccountSelectionClosed(listener: () => void): () => void;
}

export interface PlatformLeaderboardEntry {
  readonly rank: number;
  readonly score: number;
  readonly playerId: string;
  readonly publicName: string;
}

export interface PlatformLeaderboards {
  readonly available: boolean;
  getEntries(
    technicalName: string,
    options: { readonly quantityTop: number },
  ): Promise<PlatformLeaderboardEntry[]>;
  getPlayerEntry(technicalName: string): Promise<PlatformLeaderboardEntry | null>;
  setScore(technicalName: string, score: number): Promise<void>;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly platformPause: PlatformPause;
  readonly gameplay: GameplayMarkup;
  readonly ready: () => void;
}

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PLAYER_DATA_KEY = 'cascadePlayerData';

function cloneData(data: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(data);
}

function isPlayerData(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveBrowserStorage(): BrowserStorageLike | null {
  try {
    return (globalThis as { localStorage?: BrowserStorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function createBrowserPlayerStorage(
  storage: BrowserStorageLike | null = resolveBrowserStorage(),
): PlayerStorage {
  let memoryData: Record<string, unknown> = {};

  return {
    async load(): Promise<unknown> {
      if (storage !== null) {
        try {
          const serialized = storage.getItem(PLAYER_DATA_KEY);

          if (serialized !== null) {
            const parsed = JSON.parse(serialized) as unknown;

            if (isPlayerData(parsed)) {
              memoryData = cloneData(parsed);
              return cloneData(memoryData);
            }
          }
        } catch {
          // Browser persistence can be blocked or corrupted; keep playing from memory.
        }
      }

      return cloneData(memoryData);
    },

    async save(data: Record<string, unknown>): Promise<void> {
      memoryData = cloneData(data);

      if (storage !== null) {
        try {
          storage.setItem(PLAYER_DATA_KEY, JSON.stringify(data));
        } catch {
          // Memory remains the last-resort fallback for this page lifetime.
        }
      }
    },
  };
}

export function createUnavailablePlatformServices(
  storage?: BrowserStorageLike | null,
): PlatformServices {
  const browserStorage = storage === undefined ? resolveBrowserStorage() : storage;

  return {
    playerStorage: createBrowserPlayerStorage(browserStorage),
    trustedClock: { nowMs: () => null },
    auth: {
      isAuthorized: () => false,
      requestAuthorization: async () => false,
      onAccountSelectionClosed: () => () => undefined,
    },
    leaderboards: {
      available: false,
      getEntries: async () => [],
      getPlayerEntry: async () => null,
      setScore: async () => undefined,
    },
    platformPause: {
      isPaused: () => false,
      subscribe: () => () => undefined,
    },
    gameplay: {
      start: () => undefined,
      stop: () => undefined,
    },
    ready: () => undefined,
  };
}
