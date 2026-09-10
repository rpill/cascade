import type { MetaOperation } from './MetaOperations.ts';

export interface MetaJournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MetaJournalEnvelope {
  readonly stream: string;
  readonly sequence: number;
  readonly operation: MetaOperation;
}

interface PersistedJournal {
  readonly version: 1;
  readonly stream: string;
  readonly nextSequence: number;
  readonly pending: readonly MetaJournalEnvelope[];
}

const JOURNAL_KEY_PREFIX = 'cascadeMetaJournal:';
const STREAM_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

function resolveBrowserStorage(): MetaJournalStorage | null {
  try {
    return (globalThis as { localStorage?: MetaJournalStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMode(value: unknown): value is 'winnable' | 'original' | 'daily' {
  return value === 'winnable' || value === 'original' || value === 'daily';
}

function isStandardTier(value: unknown): value is 'onboarding' | 'easy' | 'medium' | 'hard' {
  return value === 'onboarding' || value === 'easy' || value === 'medium' || value === 'hard';
}

function isPositiveUint32SeedString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/u.test(value)) return false;
  try {
    const seed = BigInt(value);
    return seed >= 1n && seed <= 0xffff_ffffn;
  } catch {
    return false;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isMetaOperation(value: unknown): value is MetaOperation {
  if (!isObject(value) || typeof value.kind !== 'string') return false;

  if (value.kind === 'purchase' || value.kind === 'equip') {
    return typeof value.themeId === 'string' && value.themeId.length > 0;
  }

  if (value.kind === 'standard-served') {
    return isPositiveUint32SeedString(value.seed) && isStandardTier(value.tier);
  }

  if (value.kind === 'standard-failed') {
    return typeof value.attemptId === 'string' && value.attemptId.length > 0;
  }

  if (
    (value.kind !== 'begin' && value.kind !== 'complete')
    || typeof value.attemptId !== 'string'
    || value.attemptId.length === 0
    || !isMode(value.mode)
    || (value.dailyId !== undefined && typeof value.dailyId !== 'string')
    || (value.weekId !== undefined && typeof value.weekId !== 'string')
  ) {
    return false;
  }

  return value.kind === 'begin' || (
    typeof value.elapsedMs === 'number'
    && Number.isFinite(value.elapsedMs)
    && value.elapsedMs > 0
    && isNullableString(value.trustedDay)
    && isNullableString(value.trustedWeek)
  );
}

function parseJournal(serialized: string): PersistedJournal | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isObject(value)
      || value.version !== 1
      || typeof value.stream !== 'string'
      || !STREAM_PATTERN.test(value.stream)
      || !Number.isSafeInteger(value.nextSequence)
      || (value.nextSequence as number) < 1
      || !Array.isArray(value.pending)
    ) {
      return null;
    }

    let previousSequence = 0;
    const pending: MetaJournalEnvelope[] = [];
    for (const candidate of value.pending) {
      if (
        !isObject(candidate)
        || candidate.stream !== value.stream
        || !Number.isSafeInteger(candidate.sequence)
        || (candidate.sequence as number) <= previousSequence
        || (candidate.sequence as number) >= (value.nextSequence as number)
        || !isMetaOperation(candidate.operation)
      ) {
        return null;
      }
      previousSequence = candidate.sequence as number;
      pending.push({
        stream: value.stream,
        sequence: candidate.sequence as number,
        operation: structuredClone(candidate.operation),
      });
    }

    return {
      version: 1,
      stream: value.stream,
      nextSequence: value.nextSequence as number,
      pending,
    };
  } catch {
    return null;
  }
}

function createStream(): string {
  try {
    const id = globalThis.crypto?.randomUUID();
    if (id !== undefined && STREAM_PATTERN.test(id)) return id;
  } catch {
    // Fall through to a browser-compatible identifier.
  }
  return `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export class MetaJournal {
  private readonly key: string;
  private readonly storage: MetaJournalStorage | null;
  private journal: PersistedJournal;
  private storageDurable: boolean;

  constructor(scope: string, storage: MetaJournalStorage | null = resolveBrowserStorage()) {
    this.key = `${JOURNAL_KEY_PREFIX}${encodeURIComponent(scope || 'local')}`;
    this.storage = storage;
    this.storageDurable = storage !== null;

    let restored: PersistedJournal | null = null;
    if (storage !== null) {
      try {
        const serialized = storage.getItem(this.key);
        restored = serialized === null ? null : parseJournal(serialized);
      } catch {
        this.storageDurable = false;
      }
    }

    this.journal = restored ?? {
      version: 1,
      stream: createStream(),
      nextSequence: 1,
      pending: [],
    };
  }

  get stream(): string {
    return this.journal.stream;
  }

  get nextSequence(): number {
    return this.journal.nextSequence;
  }

  get durable(): boolean {
    return this.storageDurable;
  }

  get pending(): readonly MetaJournalEnvelope[] {
    return structuredClone(this.journal.pending);
  }

  append(operation: MetaOperation): MetaJournalEnvelope | null {
    const envelope: MetaJournalEnvelope = {
      stream: this.journal.stream,
      sequence: this.journal.nextSequence,
      operation: structuredClone(operation),
    };
    const next: PersistedJournal = {
      ...this.journal,
      nextSequence: this.journal.nextSequence + 1,
      pending: [...this.journal.pending, envelope],
    };

    if (!this.persist(next)) return null;
    this.journal = next;
    return structuredClone(envelope);
  }

  acknowledge(included: readonly MetaJournalEnvelope[]): boolean {
    const sequences = new Set(
      included
        .filter(({ stream }) => stream === this.journal.stream)
        .map(({ sequence }) => sequence),
    );
    if (sequences.size === 0) return true;

    const next: PersistedJournal = {
      ...this.journal,
      pending: this.journal.pending.filter(({ sequence }) => !sequences.has(sequence)),
    };
    if (!this.persist(next)) return false;
    this.journal = next;
    return true;
  }

  private persist(next: PersistedJournal): boolean {
    if (this.storage === null) return true;

    try {
      this.storage.setItem(this.key, JSON.stringify(next));
      this.storageDurable = true;
      return true;
    } catch {
      this.storageDurable = false;
      return false;
    }
  }
}
