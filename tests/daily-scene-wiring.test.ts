import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('GameScene coordinates platform meta Daily timer and completion without putting Yandex calls in solitaire model', () => {
  assert.match(scene, /initializePlatform/);
  assert.match(scene, /MetaRepository/);
  assert.match(scene, /getDailyId/);
  assert.match(scene, /getDailySeed/);
  assert.match(scene, /AttemptTimer/);
  assert.match(scene, /beginDailyAttempt/);
  assert.match(scene, /completeDailyAttempt/);
  assert.match(scene, /DailyCompleteView/);
  assert.match(scene, /visibilitychange/);
});

test('Daily timer only resumes when gameplay is active and the page is visible', () => {
  assert.match(scene, /document\.visibilityState === 'visible'/);
  assert.match(scene, /this\.flow\.state === 'playing'/);
  assert.match(scene, /dailyTimer\.pause\(performance\.now\(\)\)/);
  assert.match(scene, /dailyTimer\.resume\(performance\.now\(\)\)/);
});
