import type {
  CascadeStore,
  DailyResultInput,
  StoredLeaderboardEntry,
  StoredLeaderboardPage,
  VerifiedPlayerIdentity,
} from '../cascade-api/store.ts';

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
}

type StandardRow = {
  rank: number;
  pikabu_id: string;
  public_name: string;
  avatar_url: string;
  best_streak: number;
};

type DailyRow = {
  rank: number;
  pikabu_id: string;
  public_name: string;
  avatar_url: string;
  daily_id: string;
  moves: number;
  elapsed_ms: number;
};

type DailyStoredRow = {
  attempt_id: string | null;
  moves: number;
  elapsed_ms: number;
  completed_on_time: number;
};

type DailyStreakRow = {
  rank: number;
  pikabu_id: string;
  public_name: string;
  avatar_url: string;
  current_streak: number;
  best_streak: number;
};

type MasteryRow = {
  rank: number;
  pikabu_id: string;
  public_name: string;
  avatar_url: string;
  mastery_rank: number;
  mastery_points: number;
};

function assertRun(result: { success: boolean }): void {
  if (!result.success) throw new Error('D1 write failed.');
}

function positiveLimit(limit: number): number {
  return Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
}

function asStandardEntry(row: StandardRow): StoredLeaderboardEntry {
  return {
    rank: Number(row.rank),
    playerId: String(row.pikabu_id),
    publicName: String(row.public_name ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    metric: { bestStreak: Number(row.best_streak) },
  };
}

function asDailyEntry(row: DailyRow): StoredLeaderboardEntry {
  return {
    rank: Number(row.rank),
    playerId: String(row.pikabu_id),
    publicName: String(row.public_name ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    metric: {
      dailyId: String(row.daily_id),
      moves: Number(row.moves),
      elapsedMs: Number(row.elapsed_ms),
    },
  };
}

function asDailyStreakEntry(row: DailyStreakRow): StoredLeaderboardEntry {
  return {
    rank: Number(row.rank),
    playerId: String(row.pikabu_id),
    publicName: String(row.public_name ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    metric: { current: Number(row.current_streak), best: Number(row.best_streak) },
  };
}

function asMasteryEntry(row: MasteryRow): StoredLeaderboardEntry {
  return {
    rank: Number(row.rank),
    playerId: String(row.pikabu_id),
    publicName: String(row.public_name ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    metric: { masteryRank: Number(row.mastery_rank), masteryPoints: Number(row.mastery_points) },
  };
}

async function readRankedPage<T>(options: {
  readonly db: D1DatabaseLike;
  readonly topSql: string;
  readonly topBinds: readonly unknown[];
  readonly playerSql: string;
  readonly playerBinds: readonly unknown[];
  readonly playerId?: string;
  readonly map: (row: T) => StoredLeaderboardEntry;
}): Promise<StoredLeaderboardPage> {
  const top = await options.db.prepare(options.topSql).bind(...options.topBinds).all<T>();
  const entries = top.results.map(options.map);
  if (!options.playerId) return { entries, playerEntry: null };
  const player = await options.db.prepare(options.playerSql).bind(...options.playerBinds).first<T>();
  return { entries, playerEntry: player === null ? null : options.map(player) };
}

const STANDARD_RANKED = `WITH ranked AS (
  SELECT s.pikabu_id, p.public_name, p.avatar_url, s.best_streak, s.updated_at,
    ROW_NUMBER() OVER (ORDER BY best_streak DESC, s.updated_at ASC, s.pikabu_id ASC) AS rank
  FROM standard_scores s
  JOIN players p ON p.pikabu_id = s.pikabu_id
)`;

const DAILY_RANKED = `WITH ranked AS (
  SELECT d.pikabu_id, p.public_name, p.avatar_url, d.daily_id, d.moves, d.elapsed_ms, d.completed_at,
    ROW_NUMBER() OVER (ORDER BY moves ASC, elapsed_ms ASC, completed_at ASC, d.pikabu_id ASC) AS rank
  FROM daily_results d
  JOIN players p ON p.pikabu_id = d.pikabu_id
  WHERE d.daily_id = ?
)`;

const DAILY_STREAK_RANKED = `WITH ranked AS (
  SELECT s.pikabu_id, p.public_name, p.avatar_url, s.current_streak, s.best_streak, s.updated_at,
    ROW_NUMBER() OVER (ORDER BY current_streak DESC, best_streak DESC, s.updated_at ASC, s.pikabu_id ASC) AS rank
  FROM daily_streak_scores s
  JOIN players p ON p.pikabu_id = s.pikabu_id
)`;

const MASTERY_RANKED = `WITH ranked AS (
  SELECT m.pikabu_id, p.public_name, p.avatar_url, m.mastery_rank, m.mastery_points, m.updated_at,
    ROW_NUMBER() OVER (ORDER BY mastery_rank DESC, mastery_points DESC, m.updated_at ASC, m.pikabu_id ASC) AS rank
  FROM mastery_scores m
  JOIN players p ON p.pikabu_id = m.pikabu_id
)`;

export class D1CascadeStore implements CascadeStore {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async upsertPlayer(identity: VerifiedPlayerIdentity, nowMs: number): Promise<void> {
    const result = await this.db.prepare(`INSERT INTO players (pikabu_id, public_name, avatar_url, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  public_name = excluded.public_name,
  avatar_url = excluded.avatar_url,
  updated_at = excluded.updated_at`)
      .bind(identity.pikabuId, identity.publicName, identity.avatarUrl, nowMs, nowMs)
      .run();
    assertRun(result);
  }

  async readProfile(pikabuId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT profile_json FROM profiles WHERE pikabu_id = ?')
      .bind(pikabuId)
      .first<{ profile_json: string }>();
    return row === null ? null : String(row.profile_json);
  }

  async writeProfile(pikabuId: string, serialized: string, nowMs: number): Promise<void> {
    const result = await this.db.prepare(`INSERT INTO profiles (pikabu_id, profile_json, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  profile_json = excluded.profile_json,
  updated_at = excluded.updated_at`)
      .bind(pikabuId, serialized, nowMs)
      .run();
    assertRun(result);
  }

  async submitStandard(pikabuId: string, bestStreak: number, nowMs: number): Promise<void> {
    const result = await this.db.prepare(`INSERT INTO standard_scores (pikabu_id, best_streak, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  best_streak = MAX(standard_scores.best_streak, excluded.best_streak),
  updated_at = CASE
    WHEN excluded.best_streak > standard_scores.best_streak THEN excluded.updated_at
    ELSE standard_scores.updated_at
  END`)
      .bind(pikabuId, bestStreak, nowMs)
      .run();
    assertRun(result);
  }

  async readStandard(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage> {
    const capped = positiveLimit(limit);
    return readRankedPage<StandardRow>({
      db: this.db,
      topSql: `${STANDARD_RANKED}\nSELECT * FROM ranked ORDER BY rank ASC LIMIT ?`,
      topBinds: [capped],
      playerSql: `${STANDARD_RANKED}\nSELECT * FROM ranked WHERE pikabu_id = ?`,
      playerBinds: [pikabuId ?? ''],
      playerId: pikabuId,
      map: asStandardEntry,
    });
  }

  async submitDaily(pikabuId: string, result: DailyResultInput): Promise<'published' | 'replay'> {
    const attemptId = result.attemptId ?? null;
    const inserted = await this.db.prepare(`INSERT OR IGNORE INTO daily_results
  (pikabu_id, daily_id, attempt_id, moves, elapsed_ms, completed_on_time, completed_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        pikabuId,
        result.dailyId,
        attemptId,
        result.moves,
        result.elapsedMs,
        result.completedOnTime ? 1 : 0,
        result.completedAt,
      )
      .run();
    assertRun(inserted);
    const winner = await this.db.prepare(`SELECT attempt_id, moves, elapsed_ms, completed_on_time
FROM daily_results WHERE pikabu_id = ? AND daily_id = ?`)
      .bind(pikabuId, result.dailyId)
      .first<DailyStoredRow>();
    if (winner === null) throw new Error('D1 Daily result is missing after insert.');
    const exact = (winner.attempt_id ?? null) === attemptId
      && Number(winner.moves) === result.moves
      && Number(winner.elapsed_ms) === result.elapsedMs
      && Number(winner.completed_on_time) === (result.completedOnTime ? 1 : 0);
    return exact ? 'published' : 'replay';
  }

  async readDaily(dailyId: string, limit: number, pikabuId?: string): Promise<StoredLeaderboardPage> {
    const capped = positiveLimit(limit);
    return readRankedPage<DailyRow>({
      db: this.db,
      topSql: `${DAILY_RANKED}\nSELECT * FROM ranked ORDER BY rank ASC LIMIT ?`,
      topBinds: [dailyId, capped],
      playerSql: `${DAILY_RANKED}\nSELECT * FROM ranked WHERE pikabu_id = ?`,
      playerBinds: [dailyId, pikabuId ?? ''],
      playerId: pikabuId,
      map: asDailyEntry,
    });
  }

  async submitDailyStreak(pikabuId: string, current: number, best: number, nowMs: number): Promise<void> {
    const result = await this.db.prepare(`INSERT INTO daily_streak_scores (pikabu_id, current_streak, best_streak, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  current_streak = excluded.current_streak,
  best_streak = MAX(daily_streak_scores.best_streak, excluded.best_streak),
  updated_at = excluded.updated_at`)
      .bind(pikabuId, current, best, nowMs)
      .run();
    assertRun(result);
  }

  async readDailyStreak(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage> {
    const capped = positiveLimit(limit);
    return readRankedPage<DailyStreakRow>({
      db: this.db,
      topSql: `${DAILY_STREAK_RANKED}\nSELECT * FROM ranked ORDER BY rank ASC LIMIT ?`,
      topBinds: [capped],
      playerSql: `${DAILY_STREAK_RANKED}\nSELECT * FROM ranked WHERE pikabu_id = ?`,
      playerBinds: [pikabuId ?? ''],
      playerId: pikabuId,
      map: asDailyStreakEntry,
    });
  }

  async submitMastery(pikabuId: string, masteryRank: number, masteryPoints: number, nowMs: number): Promise<void> {
    const result = await this.db.prepare(`INSERT INTO mastery_scores (pikabu_id, mastery_rank, mastery_points, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  mastery_rank = MAX(mastery_scores.mastery_rank, excluded.mastery_rank),
  mastery_points = MAX(mastery_scores.mastery_points, excluded.mastery_points),
  updated_at = CASE
    WHEN excluded.mastery_rank > mastery_scores.mastery_rank
      OR excluded.mastery_points > mastery_scores.mastery_points THEN excluded.updated_at
    ELSE mastery_scores.updated_at
  END`)
      .bind(pikabuId, masteryRank, masteryPoints, nowMs)
      .run();
    assertRun(result);
  }

  async readMastery(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage> {
    const capped = positiveLimit(limit);
    return readRankedPage<MasteryRow>({
      db: this.db,
      topSql: `${MASTERY_RANKED}\nSELECT * FROM ranked ORDER BY rank ASC LIMIT ?`,
      topBinds: [capped],
      playerSql: `${MASTERY_RANKED}\nSELECT * FROM ranked WHERE pikabu_id = ?`,
      playerBinds: [pikabuId ?? ''],
      playerId: pikabuId,
      map: asMasteryEntry,
    });
  }
}
