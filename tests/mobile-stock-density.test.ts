import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { StockVisualState } from '../src/game/view/StockVisualState.ts';

test('full stock stays below the compact board top during the initial deal', () => {
  const layout = calculateViewportLayout(844, 390);
  const visual = new StockVisualState(24, 28);
  const offsets = visual.getLayerOffsets(layout.profile);
  const topLayerY = layout.stock.y + (offsets.at(-1) ?? 0);

  assert.equal(layout.profile, 'compact-landscape');
  assert.ok(
    topLayerY >= layout.boardBounds.y,
    `full stock top ${topLayerY} must stay at or below board top ${layout.boardBounds.y}`,
  );
});
