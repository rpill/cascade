import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

test('foundation keeps every collected card placed while the next card flies in', () => {
  assert.match(
    boardSource,
    /this\.game\.foundations\[suit\]\.forEach\(\(card,\s*cardIndex\)/,
  );
  assert.doesNotMatch(
    boardSource,
    /this\.game\.foundations\[suit\]\.at\(-1\)/,
  );
  assert.match(boardSource, /const point = this\.layout\.foundations\[index\]/);
  assert.match(boardSource, /x:\s*point\.x/);
  assert.match(boardSource, /y:\s*point\.y/);
  assert.doesNotMatch(boardSource, /foundationX|foundationY/);
});


test('foundation placeholder outer frame matches the exact card footprint', () => {
  assert.match(
    boardSource,
    /this\.scene\.add\.rectangle\([\s\S]*?this\.layout\.cardWidth,[\s\S]*?this\.layout\.cardHeight,/,
  );
  assert.match(
    boardSource,
    /\.setDisplaySize\(layout\.cardWidth,\s*layout\.cardHeight\)/,
  );
  assert.doesNotMatch(boardSource, /const inset =/);
});
