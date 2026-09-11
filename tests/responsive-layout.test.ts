import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gameSceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

const mainSource = readFileSync(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

test('runtime resize preserves logical profile while scaling board geometry into the HiDPI backing store', () => {
  assert.match(gameSceneSource, /const cssZoom = this\.scale\.zoom/);
  assert.match(gameSceneSource, /renderScale:\s*1 \/ safeCssZoom/);
  assert.match(gameSceneSource, /calculateViewportLayout\(viewport\.width,\s*viewport\.height\)/);
  assert.match(gameSceneSource, /scaleViewportLayout/);
  assert.match(gameSceneSource, /setZoom\(1\)/);
  assert.doesNotMatch(gameSceneSource, /setZoom\(viewport\.renderScale\)/);
  assert.match(gameSceneSource, /setScroll\(0,\s*0\)/);
  assert.match(gameSceneSource, /this\.board\?\.relayout\(layout\)/);
});

test('initial Phaser canvas waits for a measured positive game-host size', () => {
  assert.match(mainSource, /startWhenHostReady/);
  assert.match(mainSource, /getBoundingClientRect\(\)/);
  assert.match(mainSource, /width,\s*height/);
  assert.doesNotMatch(mainSource, /width:\s*window\.innerWidth/);
  assert.doesNotMatch(mainSource, /height:\s*window\.innerHeight/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.NONE/);
  assert.match(mainSource, /planHiDpiCanvas/);
});
