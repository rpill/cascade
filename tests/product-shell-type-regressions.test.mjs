import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const leaderboardConfig = readFileSync(new URL('../src/leaderboards/LeaderboardConfig.ts', import.meta.url), 'utf8');
const masteryScene = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');

test('statistics leaderboard predicate only narrows to modes present in StatisticsMode', () => {
  assert.doesNotMatch(leaderboardConfig, /hasGlobalLeaderboard\(mode:\s*StatisticsMode\):\s*mode is GlobalLeaderboardMode/);
  assert.match(leaderboardConfig, /mode is Extract<StatisticsMode,\s*GlobalLeaderboardMode>/);
});

test('mastery layout uses one coherent shared paper panel without stale split-panel fields', () => {
  assert.match(masteryScene, /private panel: PaperPanel/);
  assert.match(masteryScene, /this\.panel\.layout\(bounds\)/);
  assert.doesNotMatch(masteryScene, /leftPanel|rightPanel/);
});
