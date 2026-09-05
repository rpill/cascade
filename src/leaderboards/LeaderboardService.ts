import type { OrdinaryGameMode } from '../meta/GameStats.ts';
import type {
  PlatformLeaderboardEntry,
  PlatformServices,
} from '../platform/services.ts';
import { getLeaderboardName } from './LeaderboardConfig.ts';
import { LeaderboardSubmissionQueue } from './LeaderboardSubmissionQueue.ts';

export interface LeaderboardRow {
  readonly rank: number;
  readonly scoreMs: number;
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

export type LeaderboardSyncResult =
  | 'submitted'
  | 'unchanged'
  | 'skipped';

function normalizeRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (
    !Number.isInteger(entry.rank)
    || entry.rank < 1
    || !Number.isFinite(entry.score)
    || entry.score < 0
  ) {
    return null;
  }

  return {
    rank: entry.rank,
    scoreMs: entry.score,
    publicName: entry.publicName.trim() || 'Игрок',
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

  get available(): boolean {
    return this.platform.leaderboards.available;
  }

  get authorized(): boolean {
    return this.platform.auth.isAuthorized();
  }

  requestAuthorization(): Promise<boolean> {
    return this.platform.auth.requestAuthorization();
  }

  async load(mode: OrdinaryGameMode): Promise<LeaderboardLoadResult> {
    const authorized = this.authorized;
    if (!this.available) {
      return {
        status: 'unavailable',
        authorized,
        entries: [],
        playerEntry: null,
      };
    }

    const technicalName = getLeaderboardName(mode);
    let entries: LeaderboardRow[];

    try {
      const rawEntries = await this.platform.leaderboards.getEntries(
        technicalName,
        { quantityTop: 10 },
      );
      entries = rawEntries
        .map(normalizeRow)
        .filter((entry): entry is LeaderboardRow => entry !== null);
    } catch {
      return {
        status: 'error',
        authorized,
        entries: [],
        playerEntry: null,
      };
    }

    if (!authorized) {
      return {
        status: 'ready',
        authorized: false,
        entries,
        playerEntry: null,
      };
    }

    let playerEntry: LeaderboardRow | null = null;
    try {
      const rawPlayerEntry = await this.platform.leaderboards.getPlayerEntry(technicalName);
      playerEntry = rawPlayerEntry === null ? null : normalizeRow(rawPlayerEntry);
    } catch {
      playerEntry = null;
    }

    return {
      status: 'ready',
      authorized: true,
      entries,
      playerEntry,
    };
  }

  async syncBest(
    mode: OrdinaryGameMode,
    localBestMs: number | undefined,
  ): Promise<LeaderboardSyncResult> {
    if (
      !this.available
      || !this.authorized
      || localBestMs === undefined
      || !Number.isFinite(localBestMs)
      || localBestMs <= 0
    ) {
      return 'skipped';
    }

    const technicalName = getLeaderboardName(mode);

    try {
      const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
      if (server !== null && server.score <= localBestMs) {
        return 'unchanged';
      }

      await this.submissions.enqueue(technicalName, localBestMs);
      return 'submitted';
    } catch {
      return 'skipped';
    }
  }
}
