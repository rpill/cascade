import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

test('board TileSprite resizes its output region without scaling the wood texture', () => {
  assert.doesNotMatch(
    boardSource,
    /boardSurface\.setDisplaySize\(layout\.viewportWidth, layout\.viewportHeight\)/,
  );
  assert.match(
    boardSource,
    /boardSurface[\s\S]*?\.setSize\(layout\.viewportWidth, layout\.viewportHeight\)/,
  );
  assert.match(boardSource, /boardSurface[\s\S]*?\.setScale\(1\)/);
});
