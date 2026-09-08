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

test('board surface preload and BoardView both use the selected theme asset key', () => {
  assert.match(bootSource, /theme\.boardSurface/);
  assert.match(boardTextureSource, /theme\.boardSurface\.key/);
});
