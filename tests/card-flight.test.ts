import test from 'node:test';
import assert from 'node:assert/strict';

import { getCardFlightPoint } from '../src/game/view/CardFlight.ts';

test('card flight starts and ends at the requested coordinates', () => {
  const start = { x: 10, y: 20 };
  const end = { x: 210, y: 120 };

  assert.deepEqual(getCardFlightPoint(start, end, 0), start);
  assert.deepEqual(getCardFlightPoint(start, end, 1), end);
});

test('horizontal card flight rises 18 pixels at its midpoint', () => {
  assert.deepEqual(
    getCardFlightPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5),
    { x: 50, y: -18 },
  );
});

test('vertical card flight bends sideways instead of remaining straight', () => {
  const midpoint = getCardFlightPoint(
    { x: 0, y: 100 },
    { x: 0, y: 0 },
    0.5,
  );

  assert.equal(midpoint.x, -18);
  assert.equal(midpoint.y, 50);
});

test('card flight clamps progress and handles a zero-length route', () => {
  const point = { x: 14, y: 27 };

  assert.deepEqual(getCardFlightPoint(point, point, 0.5), point);
  assert.deepEqual(getCardFlightPoint(point, { x: 30, y: 40 }, -1), point);
  assert.deepEqual(
    getCardFlightPoint(point, { x: 30, y: 40 }, 2),
    { x: 30, y: 40 },
  );
});
