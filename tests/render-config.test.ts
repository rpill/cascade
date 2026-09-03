import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

const bootSource = readFileSync(
  new URL('../src/game/scenes/BootScene.ts', import.meta.url),
  'utf8',
);

const packageSource = readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8',
);

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

const menuSource = readFileSync(
  new URL('../src/game/view/MainMenuView.ts', import.meta.url),
  'utf8',
);

test('desktop rendering never scales the canvas above its logical size', () => {
  assert.doesNotMatch(mainSource, /\bresolution\s*:/);
  assert.match(mainSource, /autoRound:\s*true/);
  assert.match(mainSource, /max:\s*\{[\s\S]*width:\s*GAME_WIDTH,[\s\S]*height:\s*GAME_HEIGHT/);
  assert.match(mainSource, /roundPixels:\s*false/);
});

test('boot loads stable raster card textures instead of runtime SVGs', () => {
  assert.match(bootSource, /this\.load\.image\(/);
  assert.match(bootSource, /\/assets\/cards\//);
  assert.doesNotMatch(bootSource, /this\.load\.svg\(|cards-vector/);
});

test('board and menu text opt into high-resolution Phaser text textures', () => {
  assert.match(boardSource, /setResolution\(UI_TEXT_RESOLUTION\)/);
  assert.match(menuSource, /setResolution\(UI_TEXT_RESOLUTION\)/);
});

test('dev and build do not depend on runtime SVG asset generation', () => {
  assert.doesNotMatch(packageSource, /predev|prebuild|sync-card-svg-assets/);
});

test('board background has no per-dot graphics command loop', () => {
  assert.doesNotMatch(boardSource, /fillCircle\(/);
});
