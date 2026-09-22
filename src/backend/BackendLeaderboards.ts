import type {
  BackendIdentityProvider,
  PlatformLeaderboardEntry,
  PlatformLeaderboardReadOptions,
  PlatformLeaderboardSubmissionContext,
  PlatformLeaderboards,
} from '../platform/services.ts';
import {
  encodeDailyLeaderboardScore,
  encodeDailyStreakLeaderboardScore,
} from '../leaderboards/LeaderboardConfig.ts';
import type { CloudSyncStateStore, PendingLeaderboardOperation } from '../cloud/CloudSyncState.ts';
import { BackendClient, BackendHttpError } from './BackendClient.ts';

export const BACKEND_BOARD_BY_TECHNICAL_NAME = {
  standardwinstreak: 'standard',
  dailyfastest: 'daily',
  dailystreak: 'daily-streak',
  cascademastery: 'mastery',
} as const;

type TechnicalName = keyof typeof BACKEND_BOARD_BY_TECHNICAL_NAME;
type BackendBoard = (typeof BACKEND_BOARD_BY_TECHNICAL_NAME)[TechnicalName];

interface BackendMetricRow {
  readonly rank: number;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly metric: Record<string, unknown>;
}

interface BackendReadBody {
  readonly entries: readonly BackendMetricRow[];
  readonly playerEntry: BackendMetricRow | null;
}

export interface BackendLeaderboardsOptions {
  readonly client: BackendClient;
  readonly identity: BackendIdentityProvider;
  readonly stateStoreFactory: (provider: string, localIdentityKey: string) => CloudSyncStateStore;
  readonly nowMs?: () => number;
  readonly nowDateId?: () => string;
}

interface ReadCacheEntry {
  readonly expiresAt: number;
  readonly value: Promise<BackendReadBody>;
}

const READ_REUSE_MS = 2_000;
const MASTERY_SCALE = 1_000_000_000;
const MASTERY_RANKS = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'] as const;

function operationId(): string {
  const api = globalThis.crypto;
  if (typeof api?.randomUUID === 'function') return api.randomUUID();
  if (typeof api?.getRandomValues !== 'function') throw new Error('Secure random UUID generation is unavailable.');
  const bytes = new Uint8Array(16); api.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function asSafePositive(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`Invalid backend leaderboard ${label}.`);
  return value as number;
}

function asSafeNonNegative(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid backend leaderboard ${label}.`);
  return value as number;
}

function mapMetric(row: BackendMetricRow, board: BackendBoard): PlatformLeaderboardEntry {
  if (!Number.isSafeInteger(row.rank) || row.rank < 0 || typeof row.playerId !== 'string' || typeof row.publicName !== 'string') {
    throw new Error('Invalid backend leaderboard row.');
  }
  let score: number;
  if (board === 'standard') {
    score = asSafePositive(row.metric.bestStreak, 'Standard metric');
  } else if (board === 'daily') {
    if (typeof row.metric.dailyId !== 'string') throw new Error('Invalid backend Daily id.');
    score = encodeDailyLeaderboardScore(
      row.metric.dailyId,
      asSafePositive(row.metric.moves, 'Daily moves'),
      asSafePositive(row.metric.elapsedMs, 'Daily time'),
    );
  } else if (board === 'daily-streak') {
    score = encodeDailyStreakLeaderboardScore(
      asSafeNonNegative(row.metric.current, 'streak current'),
      asSafeNonNegative(row.metric.best, 'streak best'),
    );
  } else {
    if (typeof row.metric.rank !== 'string') throw new Error('Invalid backend Mastery rank.');
    const ordinal = MASTERY_RANKS.indexOf(row.metric.rank as typeof MASTERY_RANKS[number]) + 1;
    const points = asSafeNonNegative(row.metric.points, 'Mastery points');
    if (ordinal <= 0 || points >= MASTERY_SCALE) throw new Error('Invalid backend Mastery metric.');
    score = ordinal * MASTERY_SCALE + points;
  }
  return {
    rank: row.rank,
    score,
    playerId: row.playerId,
    publicName: row.publicName,
    ...(typeof row.avatarUrl === 'string' && row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
  };
}

function boardFor(technicalName: string): BackendBoard {
  const board = BACKEND_BOARD_BY_TECHNICAL_NAME[technicalName as TechnicalName];
  if (board === undefined) throw new Error(`Unsupported backend leaderboard: ${technicalName}`);
  return board;
}

function buildSubmitBody(operation: PendingLeaderboardOperation, nowDateId: string): Record<string, unknown> {
  const context = operation.context;
  if (context === undefined) throw new Error(`Backend leaderboard context is required for ${operation.technicalName}.`);
  const base = { operationId: operation.operationId };
  if (context.kind === 'standard') return { ...base, kind: 'standard', bestStreak: context.bestStreak };
  if (context.kind === 'daily') return {
    ...base,
    kind: 'daily',
    dailyId: context.dailyId,
    moves: context.moves,
    elapsedMs: context.elapsedMs,
    completedOnTime: context.completedOnTime,
    ...(context.attemptId === undefined ? {} : { attemptId: context.attemptId }),
  };
  if (context.kind === 'streak') return { ...base, kind: 'streak', todayId: context.todayId ?? nowDateId };
  return { ...base, kind: 'mastery', profile: context.profile };
}

export class BackendLeaderboards implements PlatformLeaderboards {
  readonly available = true;
  private readonly client: BackendClient;
  private readonly identity: BackendIdentityProvider;
  private readonly stateStoreFactory: BackendLeaderboardsOptions['stateStoreFactory'];
  private readonly nowMs: () => number;
  private readonly nowDateId: () => string;
  private readonly reads = new Map<string, ReadCacheEntry>();

  constructor(options: BackendLeaderboardsOptions) {
    this.client = options.client;
    this.identity = options.identity;
    this.stateStoreFactory = options.stateStoreFactory;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.nowDateId = options.nowDateId ?? (() => new Date().toISOString().slice(0, 10));
  }

  async getEntries(technicalName: string, options: PlatformLeaderboardReadOptions): Promise<PlatformLeaderboardEntry[]> {
    const board = boardFor(technicalName);
    const body = await this.readBoard(board, options.quantityTop, options.scopeKey, false);
    return body.entries.map((row) => mapMetric(row, board));
  }

  async getPlayerEntry(technicalName: string, options: { readonly scopeKey?: string } = {}): Promise<PlatformLeaderboardEntry | null> {
    if (!this.identity.isAuthorized()) return null;
    const board = boardFor(technicalName);
    const body = await this.readBoard(board, 20, options.scopeKey, true);
    return body.playerEntry === null ? null : mapMetric(body.playerEntry, board);
  }

  async setScore(technicalName: string, score: number, context?: PlatformLeaderboardSubmissionContext): Promise<void> {
    if (!Number.isFinite(score) || score <= 0) throw new Error('Leaderboard score must be finite and positive.');
    const store = await this.resolveStateStore();
    if (store === null) throw new Error('Authorized backend identity is required for leaderboard submission.');
    boardFor(technicalName);
    const operation: PendingLeaderboardOperation = {
      kind: 'leaderboard',
      operationId: operationId(),
      technicalName,
      score,
      ...(context === undefined ? {} : { context }),
    };
    const state = store.load();
    store.save({ ...state, pendingLeaderboards: [...state.pendingLeaderboards, operation] });
    await this.submitPending(store, operation);
  }

  async retryPending(): Promise<void> {
    const store = await this.resolveStateStore();
    if (store === null) return;
    for (const operation of [...store.load().pendingLeaderboards]) {
      try { await this.submitPending(store, operation); }
      catch (error) {
        if (error instanceof BackendHttpError && error.status >= 400 && error.status < 500) continue;
        break;
      }
    }
  }

  private async readBoard(board: BackendBoard, limit: number, scopeKey: string | undefined, authorizedRead: boolean): Promise<BackendReadBody> {
    const normalizedLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(100, limit)) : 20;
    const cacheKey = `${board}:${scopeKey ?? ''}:${authorizedRead ? 'auth' : 'guest'}`;
    const cached = this.reads.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > this.nowMs()) return cached.value;
    if (cached !== undefined) this.reads.delete(cacheKey);

    const params = new URLSearchParams({ limit: String(normalizedLimit) });
    if (board === 'daily') {
      if (!scopeKey) throw new Error('Daily backend read requires scopeKey.');
      params.set('scope', scopeKey);
    } else if (board === 'daily-streak') {
      if (!scopeKey) throw new Error('Daily streak backend read requires scopeKey.');
      params.set('today', scopeKey);
    }
    const request = this.client.request<BackendReadBody>(`/v1/leaderboards/${board}?${params.toString()}`, {
      authorized: authorizedRead,
    });
    this.reads.set(cacheKey, { expiresAt: this.nowMs() + READ_REUSE_MS, value: request });
    try { return await request; }
    catch (error) { this.reads.delete(cacheKey); throw error; }
  }

  private async resolveStateStore(): Promise<CloudSyncStateStore | null> {
    if (!this.identity.isAuthorized()) return null;
    const key = this.identity.localIdentityKey();
    if (key === null) return null;
    const assertion = await this.identity.getAssertion();
    if (assertion === null) return null;
    return this.stateStoreFactory(assertion.provider, key);
  }

  private async submitPending(store: CloudSyncStateStore, operation: PendingLeaderboardOperation): Promise<void> {
    const board = boardFor(operation.technicalName);
    try {
      await this.client.request(`/v1/leaderboards/${board}`, {
        method: 'POST',
        body: JSON.stringify(buildSubmitBody(operation, this.nowDateId())),
      });
      this.removePending(store, operation.operationId);
      this.invalidateRead(board);
    } catch (error) {
      if (error instanceof BackendHttpError && error.status >= 400 && error.status < 500) {
        this.removePending(store, operation.operationId);
      }
      throw error;
    }
  }

  private removePending(store: CloudSyncStateStore, id: string): void {
    const state = store.load();
    store.save({ ...state, pendingLeaderboards: state.pendingLeaderboards.filter((entry) => entry.operationId !== id) });
  }

  private invalidateRead(board: BackendBoard): void {
    for (const key of this.reads.keys()) if (key.startsWith(`${board}:`)) this.reads.delete(key);
  }
}
