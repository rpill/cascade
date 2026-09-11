import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../src/theme/ThemeAssets.ts';

function readWebpSize(path: URL): { width: number; height: number } {
  const data = readFileSync(path);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');

  const chunk = data.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const read24LE = (offset: number) => data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
    return { width: read24LE(24) + 1, height: read24LE(27) + 1 };
  }
  if (chunk === 'VP8 ') {
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

test('Navy Study uses production raster art with independent slot layers', () => {
  const theme = getTheme('navy_study');

  assert.equal(theme.id, 'navy_study');
  assert.equal(theme.name, 'Navy Study');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /navy-study\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /navy-study\/card-back\.webp$/);
  assert.equal(theme.cardBack.crop, undefined);
  assert.notEqual(getSlotFrameAsset(theme).key, getSlotGlyphAsset(theme, 'clubs')?.key);
  assert.notEqual(getSlotGlyphAsset(theme, 'clubs')?.key, getSlotGlyphAsset(theme, 'stock')?.key);

  const cardBack = new URL(`../public/${theme.cardBack.url}`, import.meta.url);
  assert.ok(existsSync(cardBack));
  assert.deepEqual(readWebpSize(cardBack), { width: 432, height: 604 });
});
