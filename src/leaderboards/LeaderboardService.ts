import type {
  PlatformLeaderboardEntry,
  PlatformServices,
} from '../platform/services.ts';
import {
  decodeDailyLeaderboardScore,
  decodeDailyStreakLeaderboardScore,
  decodeMasteryLeaderboardScore,
  encodeDailyLeaderboardScore,
  encodeDailyStreakLeaderboardScore,
  getLeaderboardName,
  type GlobalLeaderboardMode,
} from './LeaderboardConfig.ts';
import { LeaderboardSubmissionQueue } from './LeaderboardSubmissionQueue.ts';

export type LeaderboardMetric =
  | { readonly kind: 'standard'; readonly bestStreak: number }
  | { readonly kind: 'daily'; readonly moves: number; readonly elapsedMs: number }
  | { readonly kind: 'streak'; readonly current: number; readonly best: number }
  | { readonly kind: 'mastery'; readonly rank: NonNullable<ReturnType<typeof decodeMasteryLeaderboardScore>>['rank']; readonly points: number };

export interface LeaderboardRow {
  readonly rank: number;
  readonly publicName: string;
  readonly avatarUrl?: string;
  /** Legacy scalar kept for the retired DOM leaderboard view. */
  readonly value: number;
  readonly metric: LeaderboardMetric;
}

export type LeaderboardLoadResult =
  | {
      readonly status: 'ready';
      readonly entries: readonly LeaderboardRow[];
      readonly playerEntry: LeaderboardRow | null;
      readonly authorized: boolean;
    }
  | {
      readonly status: 'unavailable';
      readonly entries: readonly [];
      readonly playerEntry: null;
      readonly authorized: boolean;
    }
  | {
      readonly status: 'error';
      readonly entries: readonly [];
      readonly playerEntry: null;
      readonly authorized: boolean;
    };

export type LeaderboardSyncResult = 'submitted' | 'unchanged' | 'skipped';

const LEADERBOARD_CACHE_TTL_MS = 60_000;
const LEADERBOARD_ERROR_COOLDOWN_MS = 5_000;

interface CachedLeaderboardLoad {
  readonly expiresAt: number;
  readonly result: LeaderboardLoadResult;
}

function validRank(entry: PlatformLeaderboardEntry): boolean {
  return Number.isInteger(entry.rank) && entry.rank >= 1;
}

function publicName(entry: PlatformLeaderboardEntry): string {
  return entry.publicName.trim();
}


function normalizeStandardRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (!validRank(entry) || !Number.isSafeInteger(entry.score) || entry.score <= 0) return null;
  return {
    rank: entry.rank,
    publicName: publicName(entry),
    avatarUrl: entry.avatarUrl,
    value: entry.score,
    metric: { kind: 'standard', bestStreak: entry.score },
  };
}

function normalizeDailyRow(entry: PlatformLeaderboardEntry, dailyId: string): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  const decoded = decodeDailyLeaderboardScore(entry.score);
  if (decoded === null || decoded.dailyId !== dailyId) return null;
  return {
    rank: entry.rank,
    publicName: publicName(entry),
    avatarUrl: entry.avatarUrl,
    value: decoded.elapsedMs,
    metric: { kind: 'daily', moves: decoded.moves, elapsedMs: decoded.elapsedMs },
  };
}

function normalizeStreakRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  const decoded = decodeDailyStreakLeaderboardScore(entry.score);
  if (decoded === null) return null;
  return {
    rank: entry.rank,
    publicName: publicName(entry),
    avatarUrl: entry.avatarUrl,
    value: decoded.current,
    metric: { kind: 'streak', current: decoded.current, best: decoded.best },
  };
}

function normalizeMasteryRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  const decoded = decodeMasteryLeaderboardScore(entry.score);
  if (decoded === null) return null;
  return {
    rank: entry.rank,
    publicName: publicName(entry),
    avatarUrl: entry.avatarUrl,
    value: entry.score,
    metric: { kind: 'mastery', rank: decoded.rank, points: decoded.points },
  };
}

export class LeaderboardService {
  private readonly platform: PlatformServices;
  private readonly submissions: LeaderboardSubmissionQueue;
  private readonly nowMs: () => number;
  private readonly cache = new Map<string, CachedLeaderboardLoad>();
  private readonly inFlight = new Map<string, Promise<LeaderboardLoadResult>>();
  private readonly cacheVersion: Record<GlobalLeaderboardMode, number> = {
    winnable: 0, daily: 0, streak: 0, mastery: 0,
  };

  constructor(platform: PlatformServices, nowMs: () => number = () => Date.now()) {
    this.platform = platform;
    this.nowMs = nowMs;
    this.submissions = new LeaderboardSubmissionQueue(
      (technicalName, score) => platform.leaderboards.setScore(technicalName, score),
    );
  }

  get available(): boolean { return this.platform.leaderboards.available; }
  get authorized(): boolean { return this.platform.auth.isAuthorized(); }

  async requestAuthorization(): Promise<boolean> {
    const authorized = await this.platform.auth.requestAuthorization();
    if (authorized) this.invalidateAll();
    return authorized;
  }

  async load(mode: GlobalLeaderboardMode, dailyId?: string): Promise<LeaderboardLoadResult> {
    const authorized = this.authorized;
    if (!this.available) return { status: 'unavailable', authorized, entries: [], playerEntry: null };
    if (mode === 'daily' && dailyId === undefined) return { status: 'error', authorized, entries: [], playerEntry: null };

    const cacheKey = this.loadCacheKey(mode, dailyId, authorized);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > this.nowMs()) return cached.result;
    if (cached !== undefined) this.cache.delete(cacheKey);

    const pending = this.inFlight.get(cacheKey);
    if (pending !== undefined) return pending;

    const loadPromise = this.loadFresh(mode, dailyId, authorized);
    this.inFlight.set(cacheKey, loadPromise);
    try {
      const result = await loadPromise;
      const ttlMs = result.status === 'ready'
        ? LEADERBOARD_CACHE_TTL_MS
        : result.status === 'error'
          ? LEADERBOARD_ERROR_COOLDOWN_MS
          : 0;
      if (ttlMs > 0) this.cache.set(cacheKey, { expiresAt: this.nowMs() + ttlMs, result });
      return result;
    } finally {
      if (this.inFlight.get(cacheKey) === loadPromise) this.inFlight.delete(cacheKey);
    }
  }

  private async loadFresh(mode: GlobalLeaderboardMode, dailyId: string | undefined, authorized: boolean): Promise<LeaderboardLoadResult> {
    const technicalName = getLeaderboardName(mode);
    const normalize = mode === 'winnable'
      ? normalizeStandardRow
      : mode === 'daily'
        ? (entry: PlatformLeaderboardEntry) => normalizeDailyRow(entry, dailyId!)
        : mode === 'streak'
          ? normalizeStreakRow
          : normalizeMasteryRow;

    let entries: LeaderboardRow[];
    try {
      const rawEntries = await this.platform.leaderboards.getEntries(technicalName, { quantityTop: 20 });
      entries = rawEntries.map(normalize).filter((entry): entry is LeaderboardRow => entry !== null);
    } catch {
      return { status: 'error', authorized, entries: [], playerEntry: null };
    }

    if (!authorized) return { status: 'ready', authorized: false, entries, playerEntry: null };

    let playerEntry: LeaderboardRow | null = null;
    try {
      const raw = await this.platform.leaderboards.getPlayerEntry(technicalName);
      playerEntry = raw === null ? null : normalize(raw);
    } catch {
      playerEntry = null;
    }
    return { status: 'ready', authorized: true, entries, playerEntry };
  }

  private loadCacheKey(mode: GlobalLeaderboardMode, dailyId: string | undefined, authorized: boolean): string {
    return `${mode}:${this.cacheVersion[mode]}:${dailyId ?? ''}:${authorized ? 'auth' : 'anon'}`;
  }

  private invalidate(mode: GlobalLeaderboardMode): void {
    this.cacheVersion[mode] += 1;
  }

  private invalidateAll(): void {
    this.invalidate('winnable');
    this.invalidate('daily');
    this.invalidate('streak');
    this.invalidate('mastery');
  }

  async syncStandardStreak(localBestStreak: number): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized || !Number.isSafeInteger(localBestStreak) || localBestStreak <= 0) return 'skipped';
    const technicalName = getLeaderboardName('winnable');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null && Number.isSafeInteger(server.score) && server.score >= localBestStreak) return 'unchanged';
      await this.submissions.enqueue(technicalName, localBestStreak);
      this.invalidate('winnable');
      return 'submitted';
    } catch { return 'skipped'; }
  }

  async syncDailyBest(
    dailyId: string,
    bestMoves: number | undefined,
    bestMovesTimeMs: number | undefined,
  ): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized || bestMoves === undefined || bestMovesTimeMs === undefined) return 'skipped';
    let localScore: number;
    try { localScore = encodeDailyLeaderboardScore(dailyId, bestMoves, bestMovesTimeMs); }
    catch { return 'skipped'; }

    const technicalName = getLeaderboardName('daily');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null) {
        const decoded = decodeDailyLeaderboardScore(server.score);
        if (decoded !== null && decoded.dailyId === dailyId
          && decoded.moves === bestMoves
          && decoded.elapsedMs === Math.round(bestMovesTimeMs)) return 'unchanged';
        if (decoded !== null && decoded.dailyId > dailyId) return 'skipped';
      }
      await this.submissions.enqueue(technicalName, localScore, 'latest');
      this.invalidate('daily');
      return 'submitted';
    } catch { return 'skipped'; }
  }

  async syncDailyStreak(current: number, best: number): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized) return 'skipped';
    let localScore: number;
    try { localScore = encodeDailyStreakLeaderboardScore(current, best); }
    catch { return 'skipped'; }
    const technicalName = getLeaderboardName('streak');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server?.score === localScore) return 'unchanged';
      await this.submissions.enqueue(technicalName, localScore, 'latest');
      this.invalidate('streak');
      return 'submitted';
    } catch { return 'skipped'; }
  }

  async syncMasteryScore(localScore: number): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized || !Number.isSafeInteger(localScore) || localScore <= 0) return 'skipped';
    const technicalName = getLeaderboardName('mastery');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null && Number.isSafeInteger(server.score) && server.score >= localScore) return 'unchanged';
      await this.submissions.enqueue(technicalName, localScore);
      this.invalidate('mastery');
      return 'submitted';
    } catch { return 'skipped'; }
  }
}
