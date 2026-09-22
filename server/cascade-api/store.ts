export interface VerifiedPlayerIdentity {
  readonly pikabuId: string;
  readonly publicName: string;
  readonly avatarUrl: string;
}

export interface StoredLeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly metric: Readonly<Record<string, number | string>>;
}

export interface StoredLeaderboardPage {
  readonly entries: readonly StoredLeaderboardEntry[];
  readonly playerEntry: StoredLeaderboardEntry | null;
}

export interface DailyResultInput {
  readonly dailyId: string;
  readonly attemptId?: string;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly completedOnTime: boolean;
  readonly completedAt: number;
}

export interface CascadeStore {
  upsertPlayer(identity: VerifiedPlayerIdentity, nowMs: number): Promise<void>;
  readProfile(pikabuId: string): Promise<string | null>;
  writeProfile(pikabuId: string, serialized: string, nowMs: number): Promise<void>;

  submitStandard(pikabuId: string, bestStreak: number, nowMs: number): Promise<void>;
  readStandard(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitDaily(pikabuId: string, result: DailyResultInput): Promise<'published' | 'replay'>;
  readDaily(dailyId: string, limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitDailyStreak(pikabuId: string, current: number, best: number, nowMs: number): Promise<void>;
  readDailyStreak(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitMastery(pikabuId: string, masteryRank: number, masteryPoints: number, nowMs: number): Promise<void>;
  readMastery(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;
}
