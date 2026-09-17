import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/ui/scenes/LeaderboardsScene.ts', 'utf8');

test('player-facing leaderboard tabs are Standard, Daily and Mastery only', () => {
  const tabBlock = scene.slice(scene.indexOf('this.tabs = new SegmentedControl'), scene.indexOf('], this.selected'));
  assert.match(tabBlock, /value:\s*'winnable'/);
  assert.match(tabBlock, /value:\s*'daily'/);
  assert.match(tabBlock, /value:\s*'mastery'/);
  assert.doesNotMatch(tabBlock, /value:\s*'streak'/);
  assert.match(scene, /type VisibleLeaderboardMode = Exclude<GlobalLeaderboardMode, 'streak'>/);
});
