import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const playSource = readFileSync(
  new URL('../src/game/view/PlayPageView.ts', import.meta.url),
  'utf8',
);

test('GameScene mounts one StatisticsPageView in AppShell contentHost and no longer constructs stats or leaderboard modals', () => {
  assert.match(sceneSource, /StatisticsPageView/);
  assert.match(sceneSource, /private statisticsPage!: StatisticsPageView/);
  assert.match(sceneSource, /new StatisticsPageView\(this\.appShell\.contentHost, \{/);
  assert.doesNotMatch(sceneSource, /new StatisticsView\(/);
  assert.doesNotMatch(sceneSource, /new LeaderboardView\(/);
});

test('statistics destination shows the page and mode changes refresh both stats and leaderboard', () => {
  assert.match(sceneSource, /destination === 'statistics'[\s\S]*statisticsPage\.show/);
  assert.match(sceneSource, /selectStatisticsMode\(mode: StatisticsMode\)/);
  assert.match(sceneSource, /this\.leaderboardMode = mode/);
  assert.match(sceneSource, /this\.statisticsPage\.update/);
  assert.match(sceneSource, /this\.loadLeaderboard\(mode\)/);
});

test('Home leaderboard affordance routes to the Statistics shell page rather than an overlay', () => {
  assert.match(sceneSource, /leaderboard:\s*\(\) => this\.openStatisticsPage\(true\)/);
  assert.match(sceneSource, /openStatisticsPage\(focusLeaderboard = false\)/);
  assert.match(sceneSource, /focusLeaderboard/);
  assert.doesNotMatch(sceneSource, /openLeaderboard\(\)/);
});

test('leaderboard affordance remains usable even when the platform leaderboard is unavailable', () => {
  assert.match(playSource, /updateLeaderboardsAvailable\(available: boolean\)/);
  assert.doesNotMatch(playSource, /this\.leaderboardButton\.disabled = !available/);
  assert.match(playSource, /this\.leaderboardButton\.dataset\.available = String\(available\)/);
});
