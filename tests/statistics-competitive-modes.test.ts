import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('Leaderboards exposes Standard, Daily and Mastery without a separate streak tab', () => {
  assert.match(view, /value:\s*'winnable'/);
  assert.match(view, /value:\s*'daily'/);
  assert.match(view, /value:\s*'mastery'/);
  assert.doesNotMatch(view, /value:\s*'streak'/);
  assert.match(view, /Лучшая серия/);
});

test('GameScene submits Standard streak, Daily result, Daily streak, and Mastery', () => {
  assert.match(scene, /syncStandardStreak/);
  assert.match(scene, /syncDailyBest/);
  assert.match(scene, /syncDailyStreak/);
  assert.match(scene, /syncMasteryScore/);
  assert.doesNotMatch(scene, /classicbesttime/);
});
