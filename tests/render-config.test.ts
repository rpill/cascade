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

test('desktop rendering resizes the real canvas to the viewport instead of CSS-scaling a fixed canvas', () => {
  assert.doesNotMatch(mainSource, /\bresolution\s*:/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
  assert.doesNotMatch(mainSource, /Phaser\.Scale\.FIT/);
  assert.doesNotMatch(mainSource, /max:\s*\{/);
  assert.match(mainSource, /roundPixels:\s*false/);
});

test('boot loads stable raster card textures instead of runtime SVGs', () => {
  assert.match(bootSource, /this\.load\.image\(/);
  assert.match(bootSource, /CARD_ASSET_ROOT = ['"]\.\/assets\/cards['"]/);
  assert.doesNotMatch(bootSource, /this\.load\.svg\(|cards-vector/);
});

test('text-heavy controls live in screen-space DOM outside the camera transform', () => {
  assert.doesNotMatch(mainSource, /createContainer:\s*true/);
  assert.doesNotMatch(boardSource, /scene\.add\.dom\(/);
  assert.doesNotMatch(menuSource, /scene\.add\.dom\(/);
  assert.match(boardSource, /canvas\.parentElement/);
  assert.match(menuSource, /canvas\.parentElement/);
  assert.doesNotMatch(menuSource, /scene\.add\.text\(/);
});

test('dev and build do not depend on runtime SVG asset generation', () => {
  assert.doesNotMatch(packageSource, /predev|prebuild|sync-card-svg-assets/);
});

test('board background has no per-dot graphics command loop', () => {
  assert.doesNotMatch(boardSource, /fillCircle\(/);
});

test('board geometry comes from instance layout metrics instead of authored constants', () => {
  assert.match(boardSource, /private layout: LayoutMetrics/);
  assert.match(boardSource, /relayout\(metrics: LayoutMetrics\)/);
  assert.match(boardSource, /this\.layout\.cardWidth/);
  assert.doesNotMatch(
    boardSource,
    /\bCARD_WIDTH\b|\bCARD_HEIGHT\b|\bFOUNDATION_X\b|\bFOUNDATION_Y\b|\bSTOCK_X\b|\bSTOCK_Y\b|\bTABLEAU_X\b|\bTABLEAU_Y\b/,
  );
});
