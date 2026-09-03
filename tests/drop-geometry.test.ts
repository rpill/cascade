import test from 'node:test';
import assert from 'node:assert/strict';

import { isCommittedCardDrop } from '../src/game/view/DropGeometry.ts';

const target = { x: 0, y: 0, width: 108, height: 151 };

function movingCardWithCenter(x: number, y: number) {
  return { x: x - 54, y: y - 75.5, width: 108, height: 151 };
}

test('a centered card is a committed drop', () => {
  assert.equal(
    isCommittedCardDrop(movingCardWithCenter(54, 75.5), target),
    true,
  );
});

test('a shallow edge hover inside the 8px safety margin is rejected', () => {
  const boundaryCenters = [
    [8, 75.5],
    [100, 75.5],
    [54, 8],
    [54, 143],
  ] as const;

  for (const [x, y] of boundaryCenters) {
    assert.equal(isCommittedCardDrop(movingCardWithCenter(x, y), target), false);
  }
});

test('one pixel beyond the 8px safety margin commits the drop', () => {
  const insideCenters = [
    [9, 75.5],
    [99, 75.5],
    [54, 9],
    [54, 142],
  ] as const;

  for (const [x, y] of insideCenters) {
    assert.equal(isCommittedCardDrop(movingCardWithCenter(x, y), target), true);
  }
});

test('invalid rectangles cannot become committed drops', () => {
  assert.equal(
    isCommittedCardDrop({ x: 0, y: 0, width: 0, height: 151 }, target),
    false,
  );
  assert.equal(
    isCommittedCardDrop(
      movingCardWithCenter(54, 75.5),
      { ...target, x: Number.NaN },
    ),
    false,
  );
});
