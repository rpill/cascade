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

test('one generic attempt timer pauses and resumes for every mode through shared reconciliation', () => {
  assert.match(
    scene,
    /deriveGameplayActivity\(\{[^]*attemptStarted: this\.attemptStarted[^]*attemptFinalized: this\.attemptFinalized[^]*flowPlaying: this\.flow\?\.state === 'playing'[^]*documentVisible: document\.visibilityState === 'visible'[^]*platformPaused: this\.platformPaused/,
  );
  assert.match(
    scene,
    /if \(decision\.timerShouldRun\)[^]*attemptTimer\.resume\(performance\.now\(\)\)[^]*pauseAttemptTimer\(\)/,
  );
  assert.match(scene, /openMainMenu[^]*reconcileGameplayActivity\(\)/);
  assert.match(scene, /handleVisibilityChange[^]*pauseAttemptTimer\(\)[^]*reconcileGameplayActivity\(\)/);
  assert.match(scene, /handlePageHide[^]*pauseAttemptTimer\(\)/);
  assert.doesNotMatch(scene, /resumeAttemptTimerIfPlayable/);
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


test('ordinary completion is shown with merged stats and completion actions', () => {
  assert.match(scene, /GameCompleteView/);
  assert.match(scene, /gameCompleteView\.show\(/);
  assert.match(scene, /lastOrdinaryCompletion/);
  assert.match(scene, /elapsedMs: completion\.elapsedMs/);
  assert.match(scene, /bestTimeMs: completion\.result\.stats\.bestTimeMs/);
  assert.match(scene, /wins: completion\.result\.stats\.wins/);
  assert.match(scene, /played: completion\.result\.stats\.played/);
  assert.match(scene, /newGame: \(\) => this\.startNewDeal\(\)/);
  assert.match(scene, /menu: \(\) => this\.openMenuFromGameComplete\(\)/);
  assert.match(scene, /startDeal[^]*gameCompleteView\.hide\(\)/);
  assert.match(scene, /shutdown[^]*gameCompleteView\.destroy\(\)/);
});


test('ordinary best sync is gated by improvedBest and does not gate local completion', () => {
  const start = scene.indexOf('private finishOrdinaryAttempt');
  assert.notEqual(start, -1);
  const next = scene.indexOf('\n  private ', start + 1);
  const ordinary = scene.slice(start, next === -1 ? scene.length : next);

  assert.match(ordinary, /completion\.improvedBest/);
  assert.match(ordinary, /void this\.leaderboardService\?\.syncBest\(mode, bestTimeMs\)/);
  assert.ok(
    ordinary.indexOf('this.metaRepository?.save(this.metaState, true)')
      < ordinary.indexOf('syncBest(mode, bestTimeMs)'),
  );
});

test('ordinary attempt timing uses the shared gameplay activity reconciliation', () => {
  assert.match(scene, /reconcileGameplayActivity/);
  assert.match(scene, /attemptTimer\.pause/);
  assert.match(scene, /attemptTimer\.resume/);
  assert.match(scene, /attemptFinalized/);
});
