import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const board=readFileSync(new URL('../src/game/view/BoardView.ts',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');

test('BoardView has a dedicated UI pause independent of animation locks',()=>{
  assert.match(board,/private uiPaused = false/);assert.match(board,/setUiPaused\(paused: boolean\): void/);assert.match(board,/handleStockClick\(\): void \{[^]*this\.inputLocked \|\| this\.uiPaused/);assert.match(board,/handleCardPointerDown\(card: Card\): void \{[^]*this\.inputLocked \|\| this\.uiPaused/);
});

test('product Home pauses board input and returning resets pointers before unlock on a later frame',()=>{
  assert.match(scene,/showProductHome\(canCancel: boolean\): void \{[^]*if \(canCancel\) this\.board\?\.setUiPaused\(true\)/);
  assert.match(scene,/closeMainMenu\(\): void \{[^]*this\.input\.resetPointers\(\)[^]*requestAnimationFrame\(\(\) => \{[^]*this\.input\.resetPointers\(\)[^]*this\.board\?\.setUiPaused\(false\)/);
});
