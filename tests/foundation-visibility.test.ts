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
  assert.match(boardSource, /x:\s*this\.layout\.foundationX/);
  assert.match(boardSource, /y:\s*this\.layout\.foundationY\[index\]/);
});
