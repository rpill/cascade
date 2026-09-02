import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

test('render configuration keeps motion subpixel-smooth', () => {
  assert.match(mainSource, /roundPixels:\s*false/);
});

test('board background has no per-dot graphics command loop', () => {
  assert.doesNotMatch(boardSource, /fillCircle\(/);
});
