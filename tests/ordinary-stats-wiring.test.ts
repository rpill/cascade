import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('ordinary attempts mutate persistent stats at the settled playable boundary', () => {
  assert.match(scene, /MetaMutationQueue/);
  assert.match(scene, /beginModeAttempt/);
  assert.match(scene, /completeModeAttempt/);
  assert.match(scene, /private readonly metaMutations = new MetaMutationQueue\(\)/);
  assert.match(scene, /private readonly attemptTimer = new AttemptTimer\(\)/);
  assert.match(scene, /private attemptStarted = false/);
  assert.match(scene, /private attemptFinalized = false/);
  assert.doesNotMatch(scene, /dailyTimer|dailyAttemptStarted/);

  assert.match(
    scene,
    /if \(!this\.attemptStarted\)[^]*attemptTimer\.start\(now\)[^]*beginModeAttempt/,
  );
  assert.match(
    scene,
    /metaMutations\.apply\([^]*beginModeAttempt\(state, mode\)/,
  );
  assert.match(scene, /checkpointActiveGame\(gameState\)/);
});

test('restored started attempts resume timing without incrementing played again', () => {
  assert.match(scene, /attemptStarted = restored\.attemptStarted/);
  assert.match(
    scene,
    /if \(restored\.attemptStarted\)[^]*attemptTimer\.start\([^,]+, restored\.elapsedMs\)/,
  );
  assert.match(
    scene,
    /if \(!this\.attemptStarted\)[^]*beginModeAttempt/,
  );
});

test('ordinary wins finalize once before the unfinished checkpoint is cleared', () => {
  assert.match(scene, /if \(this\.attemptFinalized\)/);
  assert.match(scene, /attemptFinalized = true/);
  assert.match(scene, /attemptTimer\.finish\(performance\.now\(\)\)/);
  assert.match(
    scene,
    /metaMutations\.apply\([^]*completeModeAttempt\(state, mode, elapsedMs\)/,
  );
  assert.match(scene, /lastOrdinaryCompletion/);
  assert.match(
    scene,
    /completeModeAttempt[^]*metaRepository\?\.save\(this\.metaState, true\)[^]*activeGameRepository\.clear\(\)/,
  );
});

test('cloud metadata is settled through the replay queue instead of overwriting runtime events', () => {
  assert.match(scene, /const loaded = await this\.metaRepository\.load\(\)/);
  assert.match(
    scene,
    /this\.metaState = this\.metaMutations\.settleLoadedState\(loaded\)/,
  );
  assert.match(scene, /metaRepository\.save\(this\.metaState\)/);
  assert.doesNotMatch(scene, /this\.metaState = await this\.metaRepository\.load\(\)/);
});

test('one generic attempt timer pauses and resumes for every mode but never after finalization', () => {
  assert.match(
    scene,
    /attemptStarted[^]*!this\.attemptFinalized[^]*flow\.state === 'playing'[^]*document\.visibilityState === 'visible'/,
  );
  assert.match(scene, /openMainMenu[^]*attemptTimer\.pause\(performance\.now\(\)\)/);
  assert.match(scene, /handleVisibilityChange[^]*attemptTimer\.pause\(performance\.now\(\)\)/);
  assert.match(scene, /handlePageHide[^]*attemptTimer\.pause\(performance\.now\(\)\)/);
});

test('Daily keeps DailyProgress rather than ordinary GameStats mutations', () => {
  assert.match(scene, /beginDailyAttempt/);
  assert.match(scene, /completeDailyAttempt/);

  const dailyBranch = scene.match(
    /private onBoardSettled\(gameState: SolitaireGame\): void \{([^]*?)\n  \}/,
  )?.[1] ?? '';
  assert.match(dailyBranch, /beginDailyAttempt/);

  const dailyFinish = scene.match(
    /private finishDailyAttempt\(\): void \{([^]*?)\n  \}/,
  )?.[1] ?? '';
  assert.match(dailyFinish, /completeDailyAttempt/);
  assert.doesNotMatch(dailyFinish, /completeModeAttempt/);
});


test('pre-load ordinary completion snapshot is reconciled with merged cloud statistics', () => {
  assert.match(
    scene,
    /settleLoadedState\(loaded\)[^]*lastOrdinaryCompletion[^]*loaded\.stats\[completion\.mode\][^]*this\.metaState\.stats\[completion\.mode\]/,
  );
});
