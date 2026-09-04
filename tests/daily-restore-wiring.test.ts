import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('Daily checkpoints are deferred until trusted platform identity is available', () => {
  assert.match(scene, /pendingDailyRestore:\s*ActiveGameSaveV1 \| null/);
  assert.match(
    scene,
    /activeGameRepository\.load\(\)[^]*pendingDailyRestore[^]*initializeMeta\(\)/,
  );
  assert.match(
    scene,
    /trustedClock\.nowMs\(\)[^]*this\.dailyContext\s*=\s*\{[^]*tryRestoreDailySession/,
  );
});

test('Daily restore validates id algorithm version and deterministic seed', () => {
  assert.match(scene, /save\.daily[^]*dailyId[^]*context\.dailyId/);
  assert.match(
    scene,
    /save\.daily[^]*algorithmVersion[^]*this\.metaState\.daily\.algorithmVersion/,
  );
  assert.match(scene, /BigInt\(save\.seed\)[^]*context\.seed/);
  assert.match(
    scene,
    /tryRestoreDailySession[^]*activeGameRepository\.clear\(\)/,
  );
  assert.doesNotMatch(scene, /Date\.now\(|new Date\(/);
});

test('validated Daily restore resumes exact saved board and shared timer state without starting another attempt', () => {
  assert.match(
    scene,
    /tryRestoreDailySession[^]*flow\.resume\(activeGameSaveToDeal\(save\), save\.uiState\)/,
  );
  assert.match(
    scene,
    /tryRestoreDailySession[^]*startDeal\(deal, \{ restored: save \}\)/,
  );
  assert.match(scene, /attemptStarted = restored\.attemptStarted/);
  assert.match(
    scene,
    /restored\.attemptStarted[^]*attemptTimer\.start\([^,]+, restored\.elapsedMs\)/,
  );
  assert.match(
    scene,
    /if \(!this\.attemptStarted\)[^]*beginDailyAttempt/,
  );
});

test('Daily active checkpoint includes trusted identity and shared settled attempt state', () => {
  assert.match(
    scene,
    /createActiveGameSave\(\{[^]*daily:[^]*dailyId:[^]*algorithmVersion:/,
  );
  assert.match(scene, /attemptStarted: this\.attemptStarted/);
  assert.match(scene, /elapsedMs: this\.getElapsedForCheckpoint\(\)/);
  assert.match(
    scene,
    /onBoardSettled[^]*beginDailyAttempt[^]*checkpointActiveGame\(gameState\)/,
  );
});

test('Daily checkpoint lifecycle covers menu visibility pagehide and completion through the shared timer', () => {
  assert.match(scene, /openMainMenu[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  assert.match(scene, /handleVisibilityChange[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  assert.match(scene, /handlePageHide[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  assert.match(scene, /finishDailyAttempt[^]*activeGameRepository\.clear\(\)/);
  assert.doesNotMatch(scene, /dailyTimer|dailyAttemptStarted/);
});
