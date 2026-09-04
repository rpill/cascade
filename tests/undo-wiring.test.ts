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

test('player mutations are routed through complete-action history', () => {
  assert.match(sceneSource, /new GameHistory\(/);
  assert.match(sceneSource, /history\.execute\([^]*gameState\.draw\(/);
  assert.match(sceneSource, /history\.execute\([^]*gameState\.move\(/);
  assert.match(sceneSource, /history\.execute\([^]*gameState\.moveToFoundation\(/);
  assert.match(sceneSource, /history\.clear\(\)/);
});

test('undo is exposed through the board and Z shortcut without auto-foundation replay', () => {
  assert.match(sceneSource, /keydown-Z/);
  assert.match(boardSource, /readonly undo:\s*\(\) => boolean/);
  assert.match(boardSource, /ОТМЕНА\s+Z/);
  assert.match(boardSource, /requestUndo\(\)/);
  assert.match(boardSource, /sync\('undo'\)/);
});

test('undo resyncs stock visuals after restoring an exhausted stock', () => {
  const requestUndo = boardSource.match(
    /requestUndo\(\): void \{([^]*?)\n  \}/,
  )?.[1] ?? '';

  assert.match(
    requestUndo,
    /stockVisual\.sync\(this\.game\.stock\.length\)[^]*sync\('undo'\)/,
    'undo must restore the visual stock count before rendering the restored board state',
  );
});
