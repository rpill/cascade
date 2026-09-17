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

  constructor(platform: PlatformServices) {
    this.platform = platform;
    this.submissions = new LeaderboardSubmissionQueue(
      (technicalName, score) => platform.leaderboards.setScore(technicalName, score),
    );
  }

  get available(): boolean { return this.platform.leaderboards.available; }
  get authorized(): boolean { return this.platform.auth.isAuthorized(); }
  requestAuthorization(): Promise<boolean> { return this.platform.auth.requestAuthorization(); }

  async load(mode: GlobalLeaderboardMode, dailyId?: string): Promise<LeaderboardLoadResult> {
    const authorized = this.authorized;
    if (!this.available) return { status: 'unavailable', authorized, entries: [], playerEntry: null };
    if (mode === 'daily' && dailyId === undefined) return { status: 'error', authorized, entries: [], playerEntry: null };

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

  async syncStandardStreak(localBestStreak: number): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized || !Number.isSafeInteger(localBestStreak) || localBestStreak <= 0) return 'skipped';
    const technicalName = getLeaderboardName('winnable');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null && Number.isSafeInteger(server.score) && server.score >= localBestStreak) return 'unchanged';
      await this.submissions.enqueue(technicalName, localBestStreak);
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
      return 'submitted';
    } catch { return 'skipped'; }
  }
}
