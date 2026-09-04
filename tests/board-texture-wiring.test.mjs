import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootSource = readFileSync(
  new URL('../src/game/scenes/BootScene.ts', import.meta.url),
  'utf8',
);
const boardTextureSource = readFileSync(
  new URL('../src/game/view/BoardTexture.ts', import.meta.url),
  'utf8',
);

test('board surface preload key matches the key requested by BoardView', () => {
  const runtimeKey = boardTextureSource.match(
    /const BOARD_TEXTURE_KEY = ['"]([^'"]+)['"];/,
  )?.[1];
  const preloadKey = bootSource.match(
    /this\.load\.image\(\s*['"]([^'"]+)['"],\s*BOARD_SURFACE_ASSET\s*\)/s,
  )?.[1];

  assert.ok(runtimeKey, 'BoardTexture must define a board texture key');
  assert.ok(preloadKey, 'BootScene must preload the board surface');
  assert.equal(preloadKey, runtimeKey);
});
