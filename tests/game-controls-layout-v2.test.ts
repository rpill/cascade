import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controls = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/game/view/GameControlsView.css', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('gameplay HUD uses the approved two-capsule layout with Home separated', () => {
  assert.match(controls, /game-control-assist-group/);
  assert.match(controls, /game-control-deal-group/);
  assert.match(controls, /game-control-new-deal/);
  assert.match(controls, /game-control-restart/);
  assert.match(controls, /game-control-home/);
  assert.match(controls, /newDealLabel/);
  assert.match(controls, /Новая раздача/);
  assert.match(controls, /assistGroup\.append\(undo, hint\)/);
  assert.match(controls, /dealGroup\.append\(restart, this\.newDealButton\)/);
  assert.match(controls, /controls\.append\(assistGroup, dealGroup, home\)/);
});

test('Undo and Hint have real disabled states driven by gameplay availability', () => {
  assert.match(controls, /setUndoEnabled\(enabled: boolean\): void/);
  assert.match(controls, /this\.undoButton\.disabled = !enabled/);
  assert.match(controls, /this\.undoButton\.disabled = true/);
  assert.match(controls, /this\.hintButton\.disabled = !enabled/);
  assert.match(scene, /setUndoEnabled\(this\.history\.canUndo\)/);
});

test('both capsules and direct New Deal have dedicated visual geometry', () => {
  assert.match(css, /\.game-control-assist-group,\s*[\r\n]+\.game-control-deal-group\s*\{/);
  assert.match(css, /\.game-control-assist-group \.ui-icon-control,\s*[\r\n]+\.game-control-deal-group \.ui-icon-control/);
  assert.match(css, /\.game-control-new-deal\s*\{/);
  assert.match(css, /\.game-control-new-deal-label/);
  assert.match(css, /\.game-control-restart/);
  assert.match(css, /\.game-control-home/);
  assert.match(css, /:disabled/);
});


test('HUD buttons are slightly larger and group spacing protects against accidental taps', () => {
  assert.match(css, /gap:\s*18px/);
  assert.match(css, /--ui-hit-size,\s*50px/);
  assert.match(css, /min-width:\s*168px/);
});


test('compact landscape keeps Home at top-right, moves New Deal left of it, and stacks other actions below on the right', () => {
  assert.match(css, /@media \(max-height: 620px\) and \(orientation: landscape\) \{/);
  assert.match(css, /\.game-control-assist-group,\s*[\r\n]+\.game-control-deal-group \{[\s\S]*position:\s*absolute[\s\S]*inset:\s*0/);
  assert.match(css, /\.game-hud \.game-control-home \{[\s\S]*top:\s*max\(8px, env\(safe-area-inset-top\)\)[\s\S]*right:\s*max\(8px, env\(safe-area-inset-right\)\)/);
  assert.match(css, /\.game-hud \.game-control-new-deal \{[\s\S]*right:\s*calc\(max\(8px, env\(safe-area-inset-right\)\) \+ var\(--ui-hit-size, 50px\) \+ 8px\)/);
  assert.match(css, /\.game-hud \.game-control-undo \{[\s\S]*right:\s*max\(8px, env\(safe-area-inset-right\)\)/);
  assert.match(css, /\.game-hud \.game-control-restart \{[\s\S]*right:\s*max\(8px, env\(safe-area-inset-right\)\)/);
});

test('compact mobile disabled controls stay visible instead of disappearing', () => {
  assert.match(css, /\.game-hud \.game-control-undo:disabled,[\s\S]*opacity:\s*0\.4/);
  assert.match(css, /\.game-hud \.game-control-undo:disabled,[\s\S]*background:[\s\S]*var\(--game-hud-paper\)/);
  assert.match(css, /color-mix\(in srgb, var\(--game-control-ink\) 58%, transparent\)/);
});

test('compact mobile restores standalone button surfaces after desktop capsule rules', () => {
  assert.match(css, /@media \(max-height: 620px\) and \(orientation: landscape\) \{[\s\S]*\.game-control-assist-group,\s*[\r\n]+\s*\.game-control-deal-group \{[\s\S]*position:\s*absolute[\s\S]*inset:\s*0/);
  assert.match(css, /\.game-control-assist-group \.ui-icon-control,\s*[\r\n]+\s*\.game-control-deal-group \.ui-icon-control \{[\s\S]*border:\s*1px solid var\(--game-control-edge\)[\s\S]*border-radius:\s*50%[\s\S]*var\(--game-hud-paper\)/);
  assert.doesNotMatch(css, /@media \(max-height: 620px\) and \(orientation: landscape\) \{[\s\S]*\.game-control-assist-group,\s*[\r\n]+\s*\.game-control-deal-group \{[\s\S]*display:\s*contents/);
});
