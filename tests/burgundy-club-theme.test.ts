import test from 'node:test';
import assert from 'node:assert/strict';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../src/theme/ThemeAssets.ts';

test('Burgundy uses one undistorted cover surface and keeps symbols independent', () => {
  const theme = getTheme('burgundy_club');
  assert.equal(theme.id, 'burgundy_club');
  assert.equal(theme.surfaceScale, 'cover');
  assert.notEqual(getSlotFrameAsset(theme).key, getSlotGlyphAsset(theme,'clubs')?.key);
  assert.notEqual(getSlotGlyphAsset(theme,'clubs')?.key, getSlotGlyphAsset(theme,'stock')?.key);
});
