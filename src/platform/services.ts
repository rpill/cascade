export interface PlayerStorage {
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock {
  nowMs(): number | null;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
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
    ready: () => undefined,
  };
}
