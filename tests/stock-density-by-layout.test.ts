import test from 'node:test';
import assert from 'node:assert/strict';

import { StockVisualState } from '../src/game/view/StockVisualState.ts';

test('stock keeps full desktop thickness but compresses layers in compact landscape', () => {
  const visual = new StockVisualState(24, 28) as StockVisualState & {
    getLayerOffsets?: (profile: 'standard' | 'compact-landscape') => readonly number[];
  };

  assert.equal(typeof visual.getLayerOffsets, 'function', 'StockVisualState.getLayerOffsets must select density by layout profile');

  const getLayerOffsets = visual.getLayerOffsets;
  if (getLayerOffsets === undefined) {
    assert.fail('StockVisualState.getLayerOffsets is unavailable');
  }

  assert.deepEqual(
    getLayerOffsets.call(visual, 'standard'),
    [0, -3, -6, -9, -12, -15, -18, -21, -24, -27, -30],
    'desktop keeps the original visible deck thickness',
  );
  assert.deepEqual(
    getLayerOffsets.call(visual, 'compact-landscape'),
    [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10],
    'mobile landscape compresses the stack enough to stay below the board top',
  );
});
