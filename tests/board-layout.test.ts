import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateLayoutMetrics } from '../src/game/view/LayoutMetrics.ts';
import { getBoardSlots, tableauCardY } from '../src/game/view/layout.ts';

test('long tableau columns compress to remain inside the current viewport', () => {
  const layout = calculateLayoutMetrics(1366, 768);

  assert.ok(
    tableauCardY(layout, 20, 19) + layout.cardHeight
      <= layout.viewportHeight - layout.bottomMargin + 1e-9,
  );
});

test('board slots still omit a waste placeholder for every viewport', () => {
  const slots = getBoardSlots(calculateLayoutMetrics(1920, 1080));

  assert.equal(slots.filter((slot) => slot.kind === 'foundation').length, 4);
  assert.equal(slots.filter((slot) => slot.kind === 'stock').length, 1);
  assert.equal(slots.filter((slot) => slot.kind === 'tableau').length, 7);
  assert.equal(slots.some((slot) => String(slot.kind) === 'waste'), false);
});
