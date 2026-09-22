import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('migrations/0000_cascade_backend.sql', 'utf8');

test('D1 schema contains the six Cascade tables and immutable Daily key', () => {
  for (const table of [
    'players', 'profiles', 'standard_scores', 'daily_results',
    'daily_streak_scores', 'mastery_scores',
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'));

  assert.match(sql, /PRIMARY KEY\s*\(pikabu_id,\s*daily_id\)/i);
  assert.match(sql, /REFERENCES\s+players\s*\(pikabu_id\)\s+ON DELETE CASCADE/i);
  assert.match(sql, /daily_id\s*,\s*moves\s+ASC\s*,\s*elapsed_ms\s+ASC\s*,\s*completed_at\s+ASC/i);
});
