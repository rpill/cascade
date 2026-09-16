import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import * as fixtures from '../src/leaderboards/LeaderboardFixtures.ts';

test('dev fixtures use the real local profile for the player row instead of a hard-coded fake player', () => {
  assert.equal(typeof fixtures.createLocalLeaderboardPlayerEntry, 'function');
  const state = createDefaultMetaSave();
  state.standardWinStreak.best = 11;
  state.daily.records['2026-09-16'] = {
    completed: true,
    completedOnTime: true,
    bestMoves: 47,
    bestMovesTimeMs: 321_000,
    bestTimeMs: 300_000,
    attempts: 2,
  };
  state.mastery.rank = 'novice';
  state.standard.completed.easy = ['101', '102'];

  const standardPlayer = fixtures.createLocalLeaderboardPlayerEntry('winnable', state, '2026-09-16');
  const dailyPlayer = fixtures.createLocalLeaderboardPlayerEntry('daily', state, '2026-09-16');
  const streakPlayer = fixtures.createLocalLeaderboardPlayerEntry('streak', state, '2026-09-16');
  const masteryPlayer = fixtures.createLocalLeaderboardPlayerEntry('mastery', state, '2026-09-16');

  assert.deepEqual(standardPlayer?.metric, { kind: 'standard', bestStreak: 11 });
  assert.deepEqual(dailyPlayer?.metric, { kind: 'daily', moves: 47, elapsedMs: 321_000 });
  assert.deepEqual(streakPlayer?.metric, { kind: 'streak', current: 1, best: 1 });
  assert.deepEqual(masteryPlayer?.metric, { kind: 'mastery', rank: 'novice', points: 2 });

  const result = fixtures.createLeaderboardFixtureResult('mastery', '2026-09-16', masteryPlayer);
  assert.equal(result.playerEntry?.publicName, 'Вы');
  assert.deepEqual(result.playerEntry?.metric, { kind: 'mastery', rank: 'novice', points: 2 });
});

test('fixture player is ranked among fake opponents and appears in top entries only when their real result earns it', () => {
  assert.equal(typeof fixtures.createLocalLeaderboardPlayerEntry, 'function');
  const state = createDefaultMetaSave();
  state.standardWinStreak.best = 36;
  const player = fixtures.createLocalLeaderboardPlayerEntry('winnable', state, '2026-09-16');
  const result = fixtures.createLeaderboardFixtureResult('winnable', '2026-09-16', player);
  assert.ok(result.playerEntry);
  assert.ok(result.playerEntry.rank <= 20);
  assert.ok(result.entries.some((entry) => entry.publicName === 'Вы' && entry.rank === result.playerEntry?.rank));
});


test('GameScene supplies the current Daily id when building dev streak fixtures', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(source, /mode === 'daily' \|\| mode === 'streak'/);
  assert.match(source, /createLocalLeaderboardPlayerEntry\(mode, this\.metaState, dailyId\)/);
});
