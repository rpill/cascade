import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

function extractMethod(source: string, name: string): string {
  const start = source.indexOf(`private ${name}`);
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertOrdered(source: string, first: string, second: string): void {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `missing ${first}`);
  assert.notEqual(secondIndex, -1, `missing ${second}`);
  assert.ok(firstIndex < secondIndex, `${first} must precede ${second}`);
}

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
  const restore = extractMethod(scene, 'tryRestoreDailySession');
  assert.match(
    restore,
    /flow\.resume\(activeGameSaveToDeal\(save\), save\.uiState\)/,
  );
  assert.match(restore, /startDeal\(deal, \{ restored: save \}\)/);

  const startDeal = extractMethod(scene, 'startDeal');
  assert.match(startDeal, /attemptStarted = restored\.attemptStarted/);
  assert.match(
    startDeal,
    /restored\.attemptStarted[^]*attemptTimer\.start\([^,]+, restored\.elapsedMs\)/,
  );
  assert.match(startDeal, /onBoardSettled\(gameState\)[^]*return/);

  const settled = extractMethod(scene, 'onBoardSettled');
  assert.match(
    settled,
    /if \(!this\.attemptStarted\)[^]*dispatchMeta\(\{\s*kind:\s*'begin'/,
  );
});

test('Daily active checkpoint includes trusted identity and shared settled attempt state', () => {
  const checkpoint = extractMethod(scene, 'checkpointActiveGame');
  assert.match(
    checkpoint,
    /createActiveGameSave\(\{[^]*daily:[^]*dailyId:[^]*algorithmVersion:/,
  );
  assert.match(checkpoint, /attemptId:\s*this\.attemptId/);
  assert.match(checkpoint, /attemptStarted: this\.attemptStarted/);
  assert.match(checkpoint, /elapsedMs: this\.getElapsedForCheckpoint\(\)/);

  const settled = extractMethod(scene, 'onBoardSettled');
  assertOrdered(settled, "this.dispatchMeta({kind:'begin'", 'this.checkpointActiveGame(gameState)');
});

test('Daily checkpoint lifecycle covers menu visibility pagehide and completion through the shared timer', () => {
  assert.match(scene, /openMainMenu[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  assert.match(scene, /handleVisibilityChange[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  assert.match(scene, /handlePageHide[^]*attemptTimer\.pause[^]*checkpointActiveGame/);
  const finish = extractMethod(scene, 'finishDailyAttempt');
  assert.match(finish, /const recorded\s*=\s*this\.dispatchMeta\(event\)/);
  assert.match(finish, /if \(recorded\) this\.activeGameRepository\.clear\(\)/);
  assertOrdered(finish, 'this.dispatchMeta(event)', 'this.activeGameRepository.clear()');
  assert.doesNotMatch(scene, /dailyTimer|dailyAttemptStarted/);
});
