import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);
const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('BoardView has a dedicated UI pause that blocks stock pointerdown independently of animation locks', () => {
  assert.match(boardSource, /private uiPaused = false/);
  assert.match(boardSource, /setUiPaused\(paused: boolean\): void/);
  assert.match(boardSource, /handleStockClick\(\): void \{[^]*this\.inputLocked \|\| this\.uiPaused/);
  assert.match(boardSource, /handleCardPointerDown\(card: Card\): void \{[^]*this\.inputLocked \|\| this\.uiPaused/);
  assert.match(boardSource, /beginDrag\(card: Card\): void \{[^]*this\.inputLocked \|\| this\.uiPaused/);
});

test('returning from a paused shell resets Phaser pointers before BoardView is unlocked on a later frame', () => {
  assert.match(sceneSource, /showShellPlay\(canCancel: boolean\): void \{[^]*if \(canCancel\) \{[^]*this\.board\?\.setUiPaused\(true\)/);
  assert.match(sceneSource, /closeMainMenu\(\): void \{[^]*this\.input\.resetPointers\(\)[^]*this\.appShell\.hide\(\)[^]*requestAnimationFrame\(\(\) => \{[^]*this\.input\.resetPointers\(\)[^]*this\.board\?\.setUiPaused\(false\)/);
});
