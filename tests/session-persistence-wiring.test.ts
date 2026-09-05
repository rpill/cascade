import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

test('GameScene bootstraps ordinary active saves locally before platform initialization', () => {
  assert.match(sceneSource, /new ActiveGameRepository\(/);
  assert.match(sceneSource, /activeGameRepository\.load\(\)/);
  assert.match(
    sceneSource,
    /activeGameRepository\.load\(\)[^]*tryRestoreOrdinarySession\(\)[^]*initializeMeta\(\)/,
  );
  assert.match(
    sceneSource,
    /flow\.resume\(activeGameSaveToDeal\(save\), save\.uiState\)/,
  );
  assert.match(sceneSource, /save\.mode === 'daily'/);
});

test('restored ordinary boards render the saved snapshot without replaying the initial deal', () => {
  assert.match(boardSource, /showRestoredState\(\): void/);
  assert.match(sceneSource, /startDeal\(deal, \{ restored: save \}\)/);
  assert.match(
    sceneSource,
    /restored[^]*board\.showRestoredState\(\)/,
  );
  assert.match(
    sceneSource,
    /restored[^]*attemptStarted = restored\.attemptStarted/,
  );
  assert.match(
    sceneSource,
    /if \(restored\.attemptStarted\)[^]*attemptTimer\.start\([^,]+, restored\.elapsedMs\)/,
  );
});

test('new ordinary deals checkpoint before the opening animation and settled play checkpoints thereafter', () => {
  assert.match(
    sceneSource,
    /checkpointActiveGame\(gameState\)[^]*board\.playInitialDeal\(\)/,
  );
  assert.match(sceneSource, /createActiveGameSave\(\{/);
  assert.match(sceneSource, /attemptStarted: this\.attemptStarted/);
  assert.match(sceneSource, /elapsedMs: this\.getElapsedForCheckpoint\(\)/);
  assert.match(sceneSource, /onBoardSettled\(gameState\)[^]*checkpointActiveGame\(gameState\)/);
});

test('ordinary checkpoint lifecycle covers pagehide visibility menu state and completed games', () => {
  assert.match(sceneSource, /addEventListener\('pagehide', this\.handlePageHide\)/);
  assert.match(sceneSource, /removeEventListener\('pagehide', this\.handlePageHide\)/);
  assert.match(sceneSource, /handlePageHide[^]*pauseAttemptTimer\(\)[^]*checkpointActiveGame/);
  assert.match(sceneSource, /handleVisibilityChange[^]*pauseAttemptTimer\(\)[^]*checkpointActiveGame[^]*reconcileGameplayActivity\(\)/);
  assert.match(sceneSource, /openMainMenu[^]*reconcileGameplayActivity\(\)[^]*checkpointActiveGame/);
  assert.match(sceneSource, /closeMainMenu[^]*reconcileGameplayActivity\(\)[^]*checkpointActiveGame/);
  assert.doesNotMatch(sceneSource, /resumeAttemptTimerIfPlayable/);
  assert.match(sceneSource, /gameState\.isWon[^]*activeGameRepository\.clear\(\)/);
});

test('BoardView exposes a persistence-neutral settled callback and direct restored-state render', () => {
  assert.match(boardSource, /readonly settled:\s*\(\) => void/);
  assert.match(
    boardSource,
    /requestUndo\(\): void \{[^]*this\.actions\.settled\(\)/,
  );
  const restoredMethod = boardSource.match(
    /showRestoredState\(\): void \{([^]*?)\n  \}/,
  )?.[1] ?? '';
  assert.match(restoredMethod, /stockVisual\.sync\(this\.game\.stock\.length\)/);
  assert.match(restoredMethod, /this\.sync\(null\)/);
  assert.doesNotMatch(restoredMethod, /scheduleAutoFoundationStep|playInitialDeal/);
});
