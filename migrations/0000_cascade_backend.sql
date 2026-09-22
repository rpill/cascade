PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  pikabu_id TEXT PRIMARY KEY,
  public_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS standard_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  best_streak INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_results (
  pikabu_id TEXT NOT NULL REFERENCES players(pikabu_id) ON DELETE CASCADE,
  daily_id TEXT NOT NULL,
  attempt_id TEXT,
  moves INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  completed_on_time INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (pikabu_id, daily_id)
);

CREATE TABLE IF NOT EXISTS daily_streak_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  mastery_rank INTEGER NOT NULL,
  mastery_points INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_standard_rank
  ON standard_scores(best_streak DESC, updated_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_daily_rank
  ON daily_results(daily_id, moves ASC, elapsed_ms ASC, completed_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_daily_streak_rank
  ON daily_streak_scores(current_streak DESC, best_streak DESC, updated_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_mastery_rank
  ON mastery_scores(mastery_rank DESC, mastery_points DESC, updated_at ASC, pikabu_id ASC);
