import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { lifetimeMasteryPoints } from '../src/leaderboards/LeaderboardConfig.ts';
import { createLocalLeaderboardPlayerEntry } from '../src/leaderboards/LeaderboardFixtures.ts';

test('every Standard win contributes Mastery points with easy 1, medium 2, hard 3', () => {
  const state = createDefaultMetaSave();
  state.standard.completed.easy = ['101', '102', '103'];
  assert.equal(lifetimeMasteryPoints(state), 3);

  state.standard.completed.medium = ['201', '202'];
  state.standard.completed.hard = ['301'];
  assert.equal(lifetimeMasteryPoints(state), 10);
});

test('an on-time Daily completion contributes 2 Mastery points', () => {
  const state = createDefaultMetaSave();
  state.standard.completed.easy = ['101'];
  state.futurePrestige.onTimeDailyDates = ['2026-09-15', '2026-09-16'];
  assert.equal(lifetimeMasteryPoints(state), 5);
});

test('Daily leaderboard keeps a local player row even before today has a ranked result', () => {
  const state = createDefaultMetaSave();
  const player = createLocalLeaderboardPlayerEntry('daily', state, '2026-09-16');
  assert.ok(player);
  assert.equal(player.publicName, 'Вы');
  assert.deepEqual(player.metric, { kind: 'daily', moves: 0, elapsedMs: 0 });
});

test('leaderboard UI pins an empty Daily player row with dashes when no ranked result exists', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
  assert.match(source, /metric\.kind === 'daily'.*moves <= 0.*elapsedMs <= 0.*\['—', '—'\]/s);
  assert.match(source, /this\.selected === 'daily'.*result\.playerEntry === null.*publicName:\s*'Вы'/s);
});
