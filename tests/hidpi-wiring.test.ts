import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('game canvas uses manual HiDPI backing store rather than 1x RESIZE mode', () => {
  assert.match(main, /planHiDpiCanvas/);
  assert.match(main, /Phaser\.Scale\.NONE/);
  assert.doesNotMatch(main, /Phaser\.Scale\.RESIZE/);
  assert.match(main, /devicePixelRatio/);
  assert.match(main, /scale\.setZoom/);
  assert.match(main, /scale\.resize/);
  assert.match(main, /ResizeObserver/);
});

test('GameScene keeps camera at 1x and scales the logical board layout into the HiDPI backing store', () => {
  assert.match(scene, /scaleViewportLayout/);
  assert.match(scene, /const cssZoom = this\.scale\.zoom/);
  assert.match(scene, /renderScale: 1 \/ safeCssZoom/);
  assert.match(scene, /\.setSize\(this\.scale\.width, this\.scale\.height\)/);
  assert.match(scene, /\.setZoom\(1\)/);
  assert.doesNotMatch(scene, /\.setZoom\(renderScale\)/);
});


test('desktop canvas cap is applied before Phaser is created and on every resize', () => {
  assert.match(main, /const desktopMaxAspectRatio/);
  const calls = main.match(/planHiDpiCanvas\([^)]*desktopMaxAspectRatio\)/g) ?? [];
  assert.ok(calls.length >= 2, `expected initial and resize aspect-capped plans, got ${calls.length}`);
});
