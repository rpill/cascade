import type { PlayerStorage } from '../platform/services.ts';
import type { RewardSummary } from './Economy.ts';
import {
  applyMetaOperation,
  completeRewardedAttempt,
  type MetaOperation,
} from './MetaOperations.ts';
import {
  MetaJournal,
  type MetaJournalEnvelope,
} from './MetaJournal.ts';
import {
  createDefaultMetaSave,
  MAX_ECONOMY_VALUE,
  normalizeMetaSave,
  type MetaSave,
} from './MetaSave.ts';

const META_KEY = 'cascadeMeta';

export type MetaSessionStatus = 'loading' | 'ready' | 'error';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class MetaSession {
  onChange?: () => void;

  private currentState: MetaSave = createDefaultMetaSave();
  private currentStatus: MetaSessionStatus = 'loading';
  private currentlySaving = false;
  private lastSaveFailed = false;
  private loadInFlight: Promise<boolean> | null = null;
  private flushInFlight: Promise<boolean> | null = null;
  private readonly rewards = new Map<string, RewardSummary>();
  private readonly records = new Map<string, boolean>();
  private readonly storage: PlayerStorage;
  private readonly journal: MetaJournal;

  constructor(storage: PlayerStorage, journal: MetaJournal = new MetaJournal('local')) {
    this.storage = storage;
    this.journal = journal;
  }

  get state(): MetaSave {
    return this.currentState;
  }

  get status(): MetaSessionStatus {
    return this.currentStatus;
  }

  get saving(): boolean {
    return this.currentlySaving;
  }

  get saveError(): boolean {
    return this.lastSaveFailed;
  }

  get durable(): boolean {
    return this.journal.durable;
  }

  getReward(attemptId: string): RewardSummary | undefined {
    const reward = this.rewards.get(attemptId);
    return reward === undefined ? undefined : structuredClone(reward);
  }

  getImprovedBest(attemptId:string): boolean|undefined {
    return this.records.get(attemptId);
  }

  setDevelopmentCoinFloor(coins: number): boolean {
    if (this.currentStatus !== 'ready' || !Number.isSafeInteger(coins) || coins < 0) {
      return false;
    }

    const floor = Math.min(coins, MAX_ECONOMY_VALUE);
    if (this.currentState.progression.coins >= floor) {
      return false;
    }

    this.currentState = {
      ...this.currentState,
      progression: {
        ...this.currentState.progression,
        coins: floor,
      },
    };
    this.notify();
    return true;
  }

  load(): Promise<boolean> {
    if (this.loadInFlight !== null) return this.loadInFlight;

    this.loadInFlight = this.performLoad().finally(() => {
      this.loadInFlight = null;
    });
    return this.loadInFlight;
  }

  dispatch(operation: MetaOperation): boolean {
    if (operation.kind === 'purchase' && this.currentStatus !== 'ready') {
      return false;
    }

    const envelope = this.journal.append(operation);
    if (envelope === null) {
      this.lastSaveFailed = true;
      this.notify();
      return false;
    }

    this.currentState = this.applyEnvelope(this.currentState, envelope);
    this.notify();

    if (this.currentStatus === 'ready') void this.flush();
    return true;
  }

  flush(): Promise<boolean> {
    if (this.currentStatus !== 'ready') return Promise.resolve(false);
    if (this.flushInFlight !== null) return this.flushInFlight;

    this.currentlySaving = true;
    this.notify();
    this.flushInFlight = this.performFlush().finally(() => {
      this.currentlySaving = false;
      this.flushInFlight = null;
      this.notify();
    });
    return this.flushInFlight;
  }

  private async performLoad(): Promise<boolean> {
    this.currentStatus = 'loading';
    this.notify();

    try {
      const raw = await (this.storage.loadStrict?.() ?? this.storage.load());
      const root = isObject(raw) ? raw : {};
      let loaded = normalizeMetaSave(root[META_KEY]);
      const pending = [...this.journal.pending].sort((left, right) =>
        left.sequence - right.sequence);

      for (const envelope of pending) {
        const appliedSequence = loaded.progression.receipts[envelope.stream] ?? 0;
        if (envelope.sequence <= appliedSequence) {
          if (envelope.operation.kind === 'complete') {
            this.rewards.delete(envelope.operation.attemptId);
          }
          continue;
        }
        loaded = this.applyEnvelope(loaded, envelope);
      }

      this.currentState = loaded;
      this.currentStatus = 'ready';
      this.notify();
      if (pending.length > 0) void this.flush();
      return true;
    } catch {
      this.currentStatus = 'error';
      this.notify();
      return false;
    }
  }

  private async performFlush(): Promise<boolean> {
    while (true) {
      const included = this.journal.pending;
      if (included.length === 0) {
        this.setSaveError(false);
        return true;
      }
      const snapshot = structuredClone(this.currentState);

      try {
        await (this.storage.saveStrict?.({ [META_KEY]: snapshot }, true)
          ?? this.storage.save({ [META_KEY]: snapshot }, true));
      } catch {
        this.setSaveError(true);
        return false;
      }

      if (!this.journal.acknowledge(included)) {
        this.setSaveError(true);
        return false;
      }
      this.setSaveError(false);
    }
  }

  private applyEnvelope(state: MetaSave, envelope: MetaJournalEnvelope): MetaSave {
    let next: MetaSave;
    if (envelope.operation.kind === 'complete') {
      const event=envelope.operation;
      const best=event.mode==='daily' ? state.daily.records[event.dailyId ?? '']?.bestTimeMs : state.stats[event.mode].bestTimeMs;
      this.records.set(event.attemptId,best===undefined || event.elapsedMs<best);
      const result = completeRewardedAttempt(state, envelope.operation);
      next = result.state;
      if (result.reward.lines.length > 0 || result.reward.xp > 0 || result.reward.coins > 0) {
        this.rewards.set(envelope.operation.attemptId, result.reward);
      } else {
        this.rewards.delete(envelope.operation.attemptId);
      }
    } else {
      next = applyMetaOperation(state, envelope.operation);
    }

    return {
      ...next,
      progression: {
        ...next.progression,
        receipts: {
          ...next.progression.receipts,
          [envelope.stream]: envelope.sequence,
        },
      },
    };
  }

  private setSaveError(failed: boolean): void {
    if (this.lastSaveFailed === failed) return;
    this.lastSaveFailed = failed;
    this.notify();
  }

  private notify(): void {
    try {
      this.onChange?.();
    } catch {
      // Observers must not interrupt persistence state transitions.
    }
  }
}
