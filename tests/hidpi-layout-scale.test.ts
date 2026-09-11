import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateViewportLayout, scaleViewportLayout } from '../src/game/view/ViewportLayout.ts';

test('HiDPI scaling preserves the logical mobile layout profile while scaling board coordinates', () => {
  const logical = calculateViewportLayout(844, 390);
  assert.equal(logical.profile, 'compact-landscape');

  const scaled = scaleViewportLayout(logical, 2);

  assert.equal(scaled.profile, 'compact-landscape');
  assert.equal(scaled.viewportWidth, logical.viewportWidth * 2);
  assert.equal(scaled.viewportHeight, logical.viewportHeight * 2);
  assert.equal(scaled.cardWidth, logical.cardWidth * 2);
  assert.equal(scaled.cardHeight, logical.cardHeight * 2);
  assert.equal(scaled.stock.x, logical.stock.x * 2);
  assert.equal(scaled.stock.y, logical.stock.y * 2);
  assert.deepEqual(scaled.tableauX, logical.tableauX.map((x) => x * 2));
});

test('scaleViewportLayout is identity at render scale 1', () => {
  const logical = calculateViewportLayout(1280, 720);
  assert.deepEqual(scaleViewportLayout(logical, 1), logical);
});
