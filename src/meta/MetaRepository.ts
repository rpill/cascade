import type { PlayerStorage } from '../platform/services.ts';
import {
  normalizeMetaSave,
  type MetaSaveV1,
} from './MetaSave.ts';

const META_KEY = 'cascadeMeta';

export class MetaRepository {
  private pending: MetaSaveV1 | null = null;
  private writing: Promise<void> = Promise.resolve();
  private readonly storage: PlayerStorage;

  constructor(storage: PlayerStorage) {
    this.storage = storage;
  }

  async load(): Promise<MetaSaveV1> {
    try {
      const raw = await this.storage.load();
      const root = raw !== null && typeof raw === 'object'
        ? raw as Record<string, unknown>
        : {};
      return normalizeMetaSave(root[META_KEY]);
    } catch {
      return normalizeMetaSave(null);
    }
  }

  async save(state: MetaSaveV1, flush = false): Promise<void> {
    this.pending = structuredClone(state);
    this.writing = this.writing.then(async () => {
      const snapshot = this.pending;
      if (snapshot === null) return;

      try {
        await this.storage.save({ [META_KEY]: snapshot }, flush);
        if (this.pending === snapshot) this.pending = null;
      } catch {
        // Keep the newest pending snapshot for retryPending()/the next save boundary.
      }
    });
    await this.writing;
  }

  async retryPending(): Promise<void> {
    const snapshot = this.pending;
    if (snapshot !== null) await this.save(snapshot, true);
  }
}
