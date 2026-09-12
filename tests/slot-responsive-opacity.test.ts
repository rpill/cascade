import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { getBoardSlots, getSlotFrameAlpha } from '../src/game/view/layout.ts';

function slotOf(kind: 'foundation' | 'stock' | 'tableau', width: number, height: number) {
  const layout = calculateViewportLayout(width, height);
  const slot = getBoardSlots(layout).find((candidate) => candidate.kind === kind);
  assert.ok(slot);
  return { layout, slot };
}

test('desktop slot frames use stronger translucent alpha for readability', () => {
  const foundation = slotOf('foundation', 1920, 1080);
  const stock = slotOf('stock', 1920, 1080);
  const tableau = slotOf('tableau', 1920, 1080);

  assert.equal(foundation.layout.profile, 'standard');
  assert.equal(foundation.slot.alpha, 0.48);
  assert.equal(stock.slot.alpha, 0.48);
  assert.equal(tableau.slot.alpha, 0.30);
  assert.equal(getSlotFrameAlpha(foundation.layout, foundation.slot), 0.48);
  assert.equal(getSlotFrameAlpha(stock.layout, stock.slot), 0.48);
  assert.equal(getSlotFrameAlpha(tableau.layout, tableau.slot), 0.30);
});

test('compact-landscape slot frames are fully opaque', () => {
  for (const kind of ['foundation', 'stock', 'tableau'] as const) {
    const { layout, slot } = slotOf(kind, 844, 390);
    assert.equal(layout.profile, 'compact-landscape');
    assert.equal(getSlotFrameAlpha(layout, slot), 1);
  }
});
