import test from 'node:test';
import assert from 'node:assert/strict';

import { isCommittedCardDrop } from '../src/game/view/DropGeometry.ts';

const target = { x: 0, y: 0, width: 108, height: 151 };

test('a centered card is a committed drop', () => {
  assert.equal(isCommittedCardDrop({ ...target }, target), true);
});

test('about one quarter of the card overlapping is enough to commit', () => {
  assert.equal(
    isCommittedCardDrop({ x: 81, y: 0, width: 108, height: 151 }, target),
    true,
  );
});

test('a shallow edge overlap is rejected', () => {
  assert.equal(
    isCommittedCardDrop({ x: 98, y: 0, width: 108, height: 151 }, target),
    false,
  );
});

test('a corner overlap is rejected even when it reaches well into both axes', () => {
  assert.equal(
    isCommittedCardDrop({ x: 54, y: 113.25, width: 108, height: 151 }, target),
    false,
  );
});

test('invalid rectangles cannot become committed drops', () => {
  assert.equal(
    isCommittedCardDrop({ x: 0, y: 0, width: 0, height: 151 }, target),
    false,
  );
  assert.equal(
    isCommittedCardDrop(
      { ...target },
      { ...target, x: Number.NaN },
    ),
    false,
  );
});
