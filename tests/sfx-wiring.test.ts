import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boot = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');
const daily = readFileSync(new URL('../src/game/view/DailyCompleteView.ts', import.meta.url), 'utf8');

test('BootScene preloads every variant from every semantic SFX group', () => {
  assert.match(boot, /Object\.values\(SFX_ASSETS\)/);
  assert.match(boot, /asset\.keys/);
  assert.match(boot, /asset\.urls/);
  assert.match(boot, /this\.load\.audio/);
});

test('GameScene owns SFX controller and keeps DOM button feedback separate', () => {
  assert.match(scene, /new SfxController\(this\.sound\)/);
  assert.match(scene, /handleButtonSfx/);
  assert.match(scene, /this\.sfxController\.play\('button'\)/);
});

test('clicking a playable card emits card-touch even before a drag begins', () => {
  assert.match(board, /handleCardPointerDown\(card:[^]*this\.actions\.sound\?\.\('card-touch'\)/);
  const beginDrag = board.match(/private beginDrag\(card:[^]*?\n  }\n\n  private continueDrag/)?.[0] ?? '';
  assert.doesNotMatch(beginDrag, /card-pick|card-touch/);
});

test('initial deal emits one deal cue when each card flight starts, not once for the batch', () => {
  const initialDeal = board.match(/playInitialDeal\(\): void \{[^]*?\n  }\n\n  relayout/)?.[0] ?? '';
  assert.doesNotMatch(initialDeal.split('sequence.forEach')[0] ?? '', /sound\?\.\('deal'\)/);
  assert.match(initialDeal, /delayedCall\([^]*?sound\?\.\('deal'\)[^]*?animateCardTo/);
});

test('stock draw emits deal cue per animated card rather than once per draw action', () => {
  const stockClick = board.match(/private handleStockClick\(\): void \{[^]*?\n  }\n\n  private animateDraw/)?.[0] ?? '';
  assert.doesNotMatch(stockClick, /sound\?\.\('deal'\)|invalid/);
  const animateDraw = board.match(/private animateDraw\(drawn:[^]*?\n  }\n\n  private handleCardPointerDown/)?.[0] ?? '';
  assert.match(animateDraw, /onStartSound:\s*'deal'/);
});

test('every dragged card makes the same physical placement sound when released', () => {
  const endDrag = board.match(/private endDrag\(\): void \{[^]*?\n  \}\n\n  private finishMoveWithAutoFoundation/)?.[0] ?? '';
  assert.match(endDrag, /target !== null[^]*actions\.move[^]*sound\?\.\('card-place'\)/);
  assert.match(endDrag, /this\.actions\.sound\?\.\('card-place'\);\s*this\.sync\(null\)/);
  assert.doesNotMatch(endDrag, /invalid/);
  assert.doesNotMatch(board, /'invalid'/);
});

test('automatic foundation moves use the same physical card landing feedback', () => {
  assert.match(board, /scheduleAutoFoundationStep[^]*landingSounds\.set\(movedCard\.id, 'card-place'\)/);
});

test('Daily completion still plays the victory cue', () => {
  assert.match(daily, /sound\?:\s*\(cue:\s*SfxCue\)/);
  assert.match(daily, /actions\.sound\?\.\('victory'\)/);
});
