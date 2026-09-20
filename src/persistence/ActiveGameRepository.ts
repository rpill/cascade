import {
  normalizeActiveGameSave,
  type ActiveGameSaveV2,
} from './ActiveGameSave.ts';

export interface ActiveGameStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ACTIVE_GAME_KEY = 'cascadeActiveGame';
const ACTIVE_GAME_UPDATED_AT_KEY = 'cascadeActiveGameUpdatedAtMs';

export interface StoredActiveGameCheckpoint {
  readonly save: ActiveGameSaveV2;
  readonly updatedAtMs: number;
}

function resolveBrowserStorage(): ActiveGameStorageLike | null {
  try {
    const candidate = (globalThis as typeof globalThis & {
      localStorage?: ActiveGameStorageLike;
    }).localStorage;

    return candidate ?? null;
  } catch {
    return null;
  }
}

export class ActiveGameRepository {
  private readonly storage: ActiveGameStorageLike | null;

  constructor(storage?: ActiveGameStorageLike | null) {
    this.storage = storage === undefined ? resolveBrowserStorage() : storage;
  }

  load(): ActiveGameSaveV2 | null {
    if (this.storage === null) {
      return null;
    }

    try {
      const serialized = this.storage.getItem(ACTIVE_GAME_KEY);

      if (serialized === null) {
        return null;
      }

      const normalized = normalizeActiveGameSave(JSON.parse(serialized));

      if (normalized === null) {
        this.removeBestEffort();
      }

      return normalized;
    } catch {
      this.removeBestEffort();
      return null;
    }
  }

  loadCheckpoint(): StoredActiveGameCheckpoint | null {
    const save = this.load();
    if (save === null) return null;
    if (this.storage === null) return { save, updatedAtMs: 0 };

    try {
      const raw = this.storage.getItem(ACTIVE_GAME_UPDATED_AT_KEY);
      if (raw === null) return { save, updatedAtMs: 0 };
      const parsed = Number(raw);
      return {
        save,
        updatedAtMs: Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0,
      };
    } catch {
      return { save, updatedAtMs: 0 };
    }
  }

  save(save: ActiveGameSaveV2, updatedAtMs = Date.now()): void {
    if (this.storage === null) {
      return;
    }

    const normalized = normalizeActiveGameSave(save);

    if (normalized === null) {
      return;
    }

    const timestamp = Number.isFinite(updatedAtMs) && updatedAtMs >= 0
      ? Math.floor(updatedAtMs)
      : Date.now();

    try {
      this.storage.setItem(ACTIVE_GAME_KEY, JSON.stringify(normalized));
      this.storage.setItem(ACTIVE_GAME_UPDATED_AT_KEY, String(timestamp));
    } catch {
      // Active-game persistence is best-effort; gameplay must remain functional.
    }
  }

  clear(): void {
    this.removeBestEffort();
  }

  private removeBestEffort(): void {
    if (this.storage === null) {
      return;
    }

    try {
      this.storage.removeItem(ACTIVE_GAME_KEY);
      this.storage.removeItem(ACTIVE_GAME_UPDATED_AT_KEY);
    } catch {
      // Ignore browser storage failures.
    }
  }
}
