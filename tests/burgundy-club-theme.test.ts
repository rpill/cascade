import test from 'node:test';
import assert from 'node:assert/strict';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { getSurfaceSlices } from '../src/game/view/SurfaceSlices.ts';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../src/theme/ThemeAssets.ts';

test('Burgundy preserves its complete authored border and keeps symbols independent', () => {
  const theme = getTheme('burgundy_club');
  assert.equal(theme.id, 'burgundy_club');
  assert.equal(theme.surfaceScale, 'framed');
  if (theme.surfaceScale !== 'framed') throw new Error('Burgundy must preserve its border');
  const source = theme.surfaceCrop!;
  const pieces = getSurfaceSlices(1915,953,source.width,source.height,theme.surfaceSlices);
  assert.equal(pieces[0].sy,0);
  assert.equal(pieces[8].sy+pieces[8].sh,922);
  assert.notEqual(getSlotFrameAsset(theme).key, getSlotGlyphAsset(theme,'clubs')?.key);
  assert.notEqual(getSlotGlyphAsset(theme,'clubs')?.key, getSlotGlyphAsset(theme,'stock')?.key);
});
