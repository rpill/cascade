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

const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);

test('rendering uses a HiDPI backing store while preserving antialiased card textures', () => {
  assert.doesNotMatch(mainSource, /\bresolution\s*:/);
  assert.match(mainSource, /planHiDpiCanvas/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.NONE/);
  assert.doesNotMatch(mainSource, /Phaser\.Scale\.FIT/);
  assert.match(mainSource, /roundPixels:\s*false/);
});

test('startup keeps AUTO renderer and waits for a measured host before applying HiDPI size', () => {
  assert.match(mainSource, /type:\s*Phaser\.AUTO/);
  assert.match(mainSource, /startWhenHostReady/);
  assert.match(mainSource, /devicePixelRatio/);
  assert.match(mainSource, /ResizeObserver/);
  assert.doesNotMatch(mainSource, /Phaser\.CANVAS/);
});

test('boot loads stable raster card textures instead of runtime SVGs', () => {
  assert.match(bootSource, /this\.load\.image\(/);
  assert.match(bootSource, /CARD_ASSET_ROOT = ['"]\.\/assets\/cards['"]/);
  assert.doesNotMatch(bootSource, /this\.load\.svg\(|cards-vector/);
});

test('text-heavy controls live in screen-space DOM outside the camera transform', () => {
  assert.doesNotMatch(mainSource, /createContainer:\s*true/);
  assert.doesNotMatch(boardSource, /scene\.add\.dom\(/);
  assert.doesNotMatch(shellSource, /scene\.add\.dom\(/);
  assert.match(controlsSource, /canvas\.parentElement/);
  assert.match(shellSource, /canvas\.parentElement/);
  assert.doesNotMatch(shellSource, /scene\.add\.text\(/);
});

test('dev and build do not depend on runtime SVG asset generation', () => {
  assert.doesNotMatch(packageSource, /predev|prebuild|sync-card-svg-assets/);
});

test('board background has no per-dot graphics command loop', () => {
  assert.doesNotMatch(boardSource, /fillCircle\(/);
});

test('board geometry comes from the shared viewport layout instead of authored constants', () => {
  assert.match(boardSource, /private layout: ViewportLayout/);
  assert.match(boardSource, /relayout\(layout: ViewportLayout\)/);
  assert.doesNotMatch(boardSource, /utilityDivider/);
  assert.match(boardSource, /this\.layout\.cardWidth/);
  assert.doesNotMatch(
    boardSource,
    /\bCARD_WIDTH\b|\bCARD_HEIGHT\b|\bFOUNDATION_X\b|\bFOUNDATION_Y\b|\bSTOCK_X\b|\bSTOCK_Y\b|\bTABLEAU_X\b|\bTABLEAU_Y\b/,
  );
});
