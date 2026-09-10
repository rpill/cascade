import type {
  PlatformLeaderboardEntry,
  PlatformServices,
} from '../platform/services.ts';
import {
  decodeDailyLeaderboardScore,
  encodeDailyLeaderboardScore,
  getLeaderboardName,
  type GlobalLeaderboardMode,
} from './LeaderboardConfig.ts';
import { LeaderboardSubmissionQueue } from './LeaderboardSubmissionQueue.ts';

export interface LeaderboardRow {
  readonly rank: number;
  readonly value: number;
  readonly publicName: string;
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
  if (
    !validRank(entry)
    || !Number.isSafeInteger(entry.score)
    || entry.score <= 0
  ) return null;

  return { rank: entry.rank, value: entry.score, publicName: publicName(entry) };
}

function normalizeDailyRow(
  entry: PlatformLeaderboardEntry,
  dailyId: string,
): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  const decoded = decodeDailyLeaderboardScore(entry.score);
  if (decoded === null || decoded.dailyId !== dailyId) return null;
  return { rank: entry.rank, value: decoded.elapsedMs, publicName: publicName(entry) };
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

  get available(): boolean {
    return this.platform.leaderboards.available;
  }

  get authorized(): boolean {
    return this.platform.auth.isAuthorized();
  }

  requestAuthorization(): Promise<boolean> {
    return this.platform.auth.requestAuthorization();
  }

  async load(
    mode: GlobalLeaderboardMode,
    dailyId?: string,
  ): Promise<LeaderboardLoadResult> {
    const authorized = this.authorized;
    if (!this.available) {
      return { status: 'unavailable', authorized, entries: [], playerEntry: null };
    }
    if (mode === 'daily' && dailyId === undefined) {
      return { status: 'error', authorized, entries: [], playerEntry: null };
    }

    const technicalName = getLeaderboardName(mode);
    const normalize = mode === 'winnable'
      ? normalizeStandardRow
      : (entry: PlatformLeaderboardEntry) => normalizeDailyRow(entry, dailyId!);
    let entries: LeaderboardRow[];

    try {
      const rawEntries = await this.platform.leaderboards.getEntries(
        technicalName,
        { quantityTop: 10 },
      );
      entries = rawEntries
        .map(normalize)
        .filter((entry): entry is LeaderboardRow => entry !== null);
    } catch {
      return { status: 'error', authorized, entries: [], playerEntry: null };
    }

    if (!authorized) {
      return { status: 'ready', authorized: false, entries, playerEntry: null };
    }

    let playerEntry: LeaderboardRow | null = null;
    try {
      const rawPlayerEntry = await this.platform.leaderboards.getPlayerEntry(technicalName);
      playerEntry = rawPlayerEntry === null ? null : normalize(rawPlayerEntry);
    } catch {
      playerEntry = null;
    }

    return { status: 'ready', authorized: true, entries, playerEntry };
  }

  async syncStandardStreak(localBestStreak: number): Promise<LeaderboardSyncResult> {
    if (
      !this.available
      || !this.authorized
      || !Number.isSafeInteger(localBestStreak)
      || localBestStreak <= 0
    ) return 'skipped';

    const technicalName = getLeaderboardName('winnable');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (
        server !== null
        && Number.isSafeInteger(server.score)
        && server.score >= localBestStreak
      ) return 'unchanged';

      await this.submissions.enqueue(technicalName, localBestStreak);
      return 'submitted';
    } catch {
      return 'skipped';
    }
  }

  async syncDailyBest(
    dailyId: string,
    localBestMs: number | undefined,
  ): Promise<LeaderboardSyncResult> {
    if (!this.available || !this.authorized || localBestMs === undefined) return 'skipped';

    let localScore: number;
    try {
      localScore = encodeDailyLeaderboardScore(dailyId, localBestMs);
    } catch {
      return 'skipped';
    }

    const technicalName = getLeaderboardName('daily');
    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null) {
        const decoded = decodeDailyLeaderboardScore(server.score);
        if (
          decoded !== null
          && decoded.dailyId === dailyId
          && decoded.elapsedMs <= Math.round(localBestMs)
        ) return 'unchanged';
        if (decoded !== null && decoded.dailyId > dailyId) return 'skipped';
      }

      await this.submissions.enqueue(technicalName, localScore);
      return 'submitted';
    } catch {
      return 'skipped';
    }
  }
}
