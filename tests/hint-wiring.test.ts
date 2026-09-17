import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENGLISH } from '../src/localization/English.ts';

const controls = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');
const icons = readFileSync(new URL('../src/game/view/ui/UiIcons.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');

 test('gameplay HUD exposes a dedicated hint control before Home', () => {
  assert.match(controls, /readonly hint:\s*\(\) => void/);
  assert.match(controls, /icon:\s*'hint'/);
  assert.match(controls, /label:\s*'Подсказка'/);
  assert.match(icons, /\| 'hint'/);
  const hint = controls.indexOf("icon: 'hint'");
  const home = controls.indexOf("icon: 'home'");
  assert.ok(hint >= 0 && hint < home);
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

test('when there is no move, scene points at Undo only when Undo exists', () => {
  const show = scene.match(/private showHint\(\): void \{[^]*?\n  \}/)?.[0] ?? '';
  assert.match(show, /result === 'none'/);
  assert.match(show, /this\.history\.canUndo/);
  assert.match(show, /emphasizeUndo/);
});


test('hint copy is localized in English', () => {
  assert.equal(ENGLISH['Подсказка'], 'Hint');
});


test('hint control is disabled whenever the board has no available move hints', () => {
  assert.match(controls, /private readonly hintButton: HTMLButtonElement/);
  assert.match(controls, /setHintEnabled\(enabled: boolean\): void/);
  assert.match(controls, /this\.hintButton\.disabled = !enabled/);
  assert.match(board, /hasMoveHints\(\): boolean/);
  assert.match(scene, /setHintEnabled\(this\.board\?\.hasMoveHints\(\) \?\? false\)/);
});
