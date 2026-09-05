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

test('runtime resize keeps camera identity and relayouts the board from live viewport geometry', () => {
  assert.match(gameSceneSource, /calculateViewportLayout\(width,\s*height/);
  assert.match(gameSceneSource, /setZoom\(1\)/);
  assert.match(gameSceneSource, /setScroll\(0,\s*0\)/);
  assert.match(gameSceneSource, /this\.board\?\.relayout\(layout\)/);
});

test('initial Phaser canvas waits for a measured positive game-host size', () => {
  assert.match(mainSource, /startWhenHostReady/);
  assert.match(mainSource, /getBoundingClientRect\(\)/);
  assert.match(mainSource, /width,\s*height/);
  assert.doesNotMatch(mainSource, /width:\s*window\.innerWidth/);
  assert.doesNotMatch(mainSource, /height:\s*window\.innerHeight/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
});
