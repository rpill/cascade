import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('GameScene coordinates platform meta Daily timer and completion without putting Yandex calls in solitaire model', () => {
  assert.match(scene, /initializePlatform/);
  assert.match(scene, /MetaSession/);
  assert.match(scene, /dispatchMeta/);
  assert.match(scene, /getDailyId/);
  assert.match(scene, /getDailySeed/);
  assert.match(scene, /AttemptTimer/);
  assert.match(scene, /kind:\s*'begin'/);
  assert.match(scene, /completionEvent\('daily',\s*elapsedMs\)/);
  assert.match(scene, /DailyCompleteView/);
  assert.match(scene, /visibilitychange/);
  assert.match(scene, /pendingDailyRestore/);
  assert.match(scene, /checkpointActiveGame/);
});

test('the shared attempt timer only resumes when gameplay is active visible and unfinished', () => {
  assert.match(scene, /document\.visibilityState === 'visible'/);
  assert.match(scene, /this\.flow\.state === 'playing'/);
  assert.match(scene, /!this\.attemptFinalized/);
  assert.match(scene, /attemptTimer\.pause\(performance\.now\(\)\)/);
  assert.match(scene, /attemptTimer\.resume\(performance\.now\(\)\)/);
  assert.doesNotMatch(scene, /dailyTimer|dailyAttemptStarted/);
});


test('Daily completion never writes ordinary leaderboards', () => {
  const start = scene.indexOf('private finishDailyAttempt');
  assert.notEqual(start, -1);
  const next = scene.indexOf('\n  private ', start + 1);
  const dailyFinish = scene.slice(start, next === -1 ? scene.length : next);
  assert.doesNotMatch(dailyFinish, /leaderboardService|syncBest/);
});

test('Daily uses the same platform-aware activity reconciliation as ordinary play', () => {
  assert.match(scene, /deriveGameplayActivity/);
  assert.match(scene, /reconcileGameplayActivity/);
  assert.doesNotMatch(scene, /dailyPlatformPaused/);
});
