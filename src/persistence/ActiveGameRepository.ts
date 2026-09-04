import {
  normalizeActiveGameSave,
  type ActiveGameSaveV1,
} from './ActiveGameSave.ts';

export interface ActiveGameStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ACTIVE_GAME_KEY = 'cascadeActiveGame';

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

  load(): ActiveGameSaveV1 | null {
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

  save(save: ActiveGameSaveV1): void {
    if (this.storage === null) {
      return;
    }

    const normalized = normalizeActiveGameSave(save);

    if (normalized === null) {
      return;
    }

    try {
      this.storage.setItem(ACTIVE_GAME_KEY, JSON.stringify(normalized));
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
    } catch {
      // Ignore browser storage failures.
    }
  }
}
