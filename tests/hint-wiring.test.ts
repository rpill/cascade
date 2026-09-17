import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENGLISH } from '../src/localization/English.ts';

const hud = readFileSync(new URL('../src/ui/game/GameHud.ts', import.meta.url), 'utf8');
const hudViewModel = readFileSync(new URL('../src/ui/game/GameHudViewModel.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');

test('gameplay HUD exposes a dedicated Phaser hint action', () => {
  assert.match(hud, /readonly hint:\s*\(\) => void/);
  assert.match(hud, /UI_ICON_KEYS\.hint/);
  assert.match(hud, /viewModel\.hintLabel/);
});

test('GameScene delegates hint clicks to BoardView without mutating game state', () => {
  assert.match(scene, /hint:\s*\(\) => this\.showHint\(\)/);
  assert.match(scene, /private showHint\(\): void/);
  assert.match(scene, /this\.board\?\.playHint\(\)/);
});

test('BoardView has a non-mutating hint animation that returns cards to their start', () => {
  assert.match(board, /playHint\(\):/);
  assert.match(board, /findMoveHints/);
  assert.match(board, /yoyo:\s*true/);
  assert.match(board, /hold:/);
  assert.match(board, /hintIndex/);
  assert.match(board, /% hints\.length/);
  const playHint = board.match(/playHint\(\):[^]*?\n  }\n\n/)?.[0] ?? '';
  assert.doesNotMatch(playHint, /actions\.move|game\.move|history/);
});


test('cancelling a hint during relayout cannot leave board input locked', () => {
  const stop = board.match(/private stopHintPlayback\(\): void \{[^]*?\n  \}/)?.[0] ?? '';
  assert.match(stop, /hintTween !== null/);
  assert.match(stop, /this\.inputLocked = false/);
});

test('hint copy is localized in English', () => {
  assert.equal(ENGLISH['Подсказка'], 'Hint');
});


test('hint control is disabled whenever the board has no available move hints', () => {
  assert.match(board, /hasMoveHints\(\): boolean/);
  assert.match(scene, /hintEligible:\s*this\.board\?\.hasMoveHints\(\) \?\? false/);
  assert.match(hudViewModel, /hintEnabled:\s*input\.hintEligible/);
  assert.match(hud, /this\.buttons\.hint\.enabled = viewModel\.hintEnabled/);
});
