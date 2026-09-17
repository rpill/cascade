import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const homeVm = readFileSync(new URL('../src/ui/home/HomeViewModel.ts', import.meta.url), 'utf8');
const leaderboard = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');

test('new player-facing shell exposes one Game entry plus Daily, Mastery and Leaders', () => {
  assert.match(home, /scene\.start\('DailyScene'\)/);
  assert.match(home, /scene\.start\('MasteryScene'\)/);
  assert.match(home, /scene\.start\('LeaderboardsScene'\)/);
  assert.doesNotMatch(home, /КЛАССИКА/);
  assert.match(homeVm, /selectedDifficulty/);
});

test('new leaderboard screen exposes Standard, Daily and Mastery without a separate streak tab', () => {
  assert.match(leaderboard, /value:\s*'winnable'/);
  assert.match(leaderboard, /value:\s*'daily'/);
  assert.doesNotMatch(leaderboard, /value:\s*'streak'/);
  assert.match(leaderboard, /value:\s*'mastery'/);
});

test('ordinary gameplay HUD does not expose Classic or Standard mode labels', () => {
  assert.match(controls, /this\.modeLabel\.hidden\s*=\s*mode\s*!==\s*'daily'/);
  assert.doesNotMatch(controls, /winnable:\s*'СТАНДАРТ'|original:\s*'КЛАССИКА'/);
});
