import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../src/theme/ThemeAssets.ts';

function readPngSize(path: URL): { width: number; height: number } {
  const data = readFileSync(path);
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('Navy Study uses production raster art with independent slot layers', () => {
  const theme = getTheme('navy_study');

  assert.equal(theme.id, 'navy_study');
  assert.equal(theme.name, 'Navy Study');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /navy-study\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /navy-study\/card-back\.png$/);
  assert.equal(theme.cardBack.crop, undefined);
  assert.notEqual(getSlotFrameAsset(theme).key, getSlotGlyphAsset(theme, 'clubs')?.key);
  assert.notEqual(getSlotGlyphAsset(theme, 'clubs')?.key, getSlotGlyphAsset(theme, 'stock')?.key);

  const cardBack = new URL(`../public/${theme.cardBack.url}`, import.meta.url);
  assert.ok(existsSync(cardBack));
  assert.deepEqual(readPngSize(cardBack), { width: 432, height: 604 });
});
