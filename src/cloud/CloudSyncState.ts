import type { BrowserStorageLike, PlatformLeaderboardSubmissionContext } from '../platform/services.ts';
import { normalizeCloudSnapshot, type CloudSnapshot } from './CloudSnapshot.ts';

export interface PendingProfileOperation {
  readonly kind: 'profile';
  readonly operationId: string;
  readonly expectedRevision: number;
  readonly profile: CloudSnapshot;
}

export interface PendingLeaderboardOperation {
  readonly kind: 'leaderboard';
  readonly operationId: string;
  readonly technicalName: string;
  readonly score: number;
  readonly context?: PlatformLeaderboardSubmissionContext;
}

export interface CloudSyncState {
  readonly version: 1;
  readonly revision: number;
  readonly base: CloudSnapshot | null;
  readonly pendingProfile: PendingProfileOperation | null;
  readonly pendingLeaderboards: readonly PendingLeaderboardOperation[];
  readonly lastSuccessfulSyncAtMs?: number;
  readonly retryAttempt: number;
  readonly nextRetryAtMs?: number;
}

interface MutableStorageLike extends BrowserStorageLike {
  removeItem?(key: string): void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAILY_ID_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUEUE = 64;

function defaultState(): CloudSyncState {
  return { version: 1, revision: 0, base: null, pendingProfile: null, pendingLeaderboards: [], retryAttempt: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function normalizeContext(value: unknown): PlatformLeaderboardSubmissionContext | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
  switch (value.kind) {
    case 'standard':
      return isNonNegativeSafeInteger(value.bestStreak)
        ? { kind: 'standard', bestStreak: value.bestStreak }
        : undefined;
    case 'daily': {
      if (!DAILY_ID_RE.test(String(value.dailyId ?? ''))
        || !isPositiveSafeInteger(value.moves)
        || !isPositiveSafeInteger(value.elapsedMs)
        || typeof value.completedOnTime !== 'boolean') return undefined;
      const attemptId = value.attemptId;
      if (attemptId !== undefined && (typeof attemptId !== 'string' || attemptId.length < 1 || attemptId.length > 100)) return undefined;
      return {
        kind: 'daily',
        dailyId: value.dailyId as string,
        moves: value.moves,
        elapsedMs: value.elapsedMs,
        completedOnTime: value.completedOnTime,
        ...(attemptId === undefined ? {} : { attemptId }),
      };
    }
    case 'streak': {
      if (value.todayId !== undefined && (typeof value.todayId !== 'string' || !DAILY_ID_RE.test(value.todayId))) return undefined;
      return { kind: 'streak', ...(value.todayId === undefined ? {} : { todayId: value.todayId }) };
    }
    case 'mastery':
      return value.profile !== undefined ? { kind: 'mastery', profile: structuredClone(value.profile) } : undefined;
    default:
      return undefined;
  }
}

function normalizePendingProfile(value: unknown): PendingProfileOperation | null {
  if (!isRecord(value) || value.kind !== 'profile' || typeof value.operationId !== 'string' || !UUID_RE.test(value.operationId)
    || !isNonNegativeSafeInteger(value.expectedRevision)) return null;
  const profile = normalizeCloudSnapshot(value.profile);
  if (profile === null) return null;
  return { kind: 'profile', operationId: value.operationId, expectedRevision: value.expectedRevision, profile };
}

function normalizePendingLeaderboard(value: unknown): PendingLeaderboardOperation | null {
  if (!isRecord(value) || value.kind !== 'leaderboard' || typeof value.operationId !== 'string' || !UUID_RE.test(value.operationId)
    || typeof value.technicalName !== 'string' || value.technicalName.length < 1 || value.technicalName.length > 100
    || !Number.isSafeInteger(value.score)) return null;
  if (value.context === undefined) {
    return { kind: 'leaderboard', operationId: value.operationId, technicalName: value.technicalName, score: value.score as number };
  }
  const context = normalizeContext(value.context);
  if (context === undefined) return null;
  return { kind: 'leaderboard', operationId: value.operationId, technicalName: value.technicalName, score: value.score as number, context };
}

function normalizeQueue(value: unknown): PendingLeaderboardOperation[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, PendingLeaderboardOperation>();
  for (const raw of value) {
    const normalized = normalizePendingLeaderboard(raw);
    if (normalized === null) continue;
    if (byId.has(normalized.operationId)) byId.delete(normalized.operationId);
    byId.set(normalized.operationId, normalized);
  }
  return [...byId.values()].slice(-MAX_QUEUE);
}

function normalizeState(value: unknown): CloudSyncState {
  if (!isRecord(value) || value.version !== 1 || !isNonNegativeSafeInteger(value.revision) || !isNonNegativeSafeInteger(value.retryAttempt)) {
    return defaultState();
  }
  let base: CloudSnapshot | null = null;
  if (value.base !== null) {
    base = normalizeCloudSnapshot(value.base);
    if (base === null) return defaultState();
  }
  const pendingProfile = value.pendingProfile === null ? null : normalizePendingProfile(value.pendingProfile);
  if (value.pendingProfile !== null && pendingProfile === null) return defaultState();
  const lastSuccessfulSyncAtMs = value.lastSuccessfulSyncAtMs;
  const nextRetryAtMs = value.nextRetryAtMs;
  if (lastSuccessfulSyncAtMs !== undefined && !isNonNegativeSafeInteger(lastSuccessfulSyncAtMs)) return defaultState();
  if (nextRetryAtMs !== undefined && !isNonNegativeSafeInteger(nextRetryAtMs)) return defaultState();
  return {
    version: 1,
    revision: value.revision,
    base,
    pendingProfile,
    pendingLeaderboards: normalizeQueue(value.pendingLeaderboards),
    retryAttempt: value.retryAttempt,
    ...(lastSuccessfulSyncAtMs === undefined ? {} : { lastSuccessfulSyncAtMs }),
    ...(nextRetryAtMs === undefined ? {} : { nextRetryAtMs }),
  };
}

function resolveStorage(): MutableStorageLike | null {
  try { return (globalThis as { localStorage?: MutableStorageLike }).localStorage ?? null; } catch { return null; }
}

export class CloudSyncStateStore {
  private readonly key: string;
  private readonly storage: MutableStorageLike | null;
  private memory: CloudSyncState = defaultState();

  constructor(provider: string, localIdentityKey: string, storage?: BrowserStorageLike | null) {
    this.key = `cascadeCloudSyncState:v1:${provider}:${encodeURIComponent(localIdentityKey)}`;
    this.storage = (storage === undefined ? resolveStorage() : storage) as MutableStorageLike | null;
  }

  load(): CloudSyncState {
    if (this.storage === null) return structuredClone(this.memory);
    try {
      const serialized = this.storage.getItem(this.key);
      if (serialized === null) return structuredClone(this.memory);
      const normalized = normalizeState(JSON.parse(serialized));
      this.memory = normalized;
      return structuredClone(normalized);
    } catch {
      this.memory = defaultState();
      return structuredClone(this.memory);
    }
  }

  save(state: CloudSyncState): void {
    const normalized = normalizeState(state);
    this.memory = normalized;
    try { this.storage?.setItem(this.key, JSON.stringify(normalized)); } catch { /* memory fallback */ }
  }

  clear(): void {
    this.memory = defaultState();
    try { this.storage?.removeItem?.(this.key); } catch { /* ignore */ }
  }
}
