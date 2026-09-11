import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTheme } from '../src/theme/ThemeRegistry.ts';

function readWebpInfo(path: URL): { width: number; height: number; hasAlpha: boolean } {
  const data = readFileSync(path);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');

  const chunk = data.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const read24LE = (offset: number) => data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
    return {
      width: read24LE(24) + 1,
      height: read24LE(27) + 1,
      hasAlpha: (data[20] & 0x10) !== 0,
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
      hasAlpha: false,
    };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

for (const [themeId, folder] of [
  ['navy_study', 'navy-study'],
  ['burgundy_club', 'burgundy-club'],
] as const) {
  test(`${themeId} keeps the approved rounded transparent card-back contour`, () => {
    const theme = getTheme(themeId);
    assert.equal(theme.cardBack.crop, undefined);

    const runtimeBack = new URL(`../public/assets/themes/${folder}/card-back.webp`, import.meta.url);
    assert.deepEqual(readWebpInfo(runtimeBack), { width: 432, height: 604, hasAlpha: true });

    const shopBack = new URL(`../public/assets/themes/${folder}/shop-card-back.webp`, import.meta.url);
    assert.deepEqual(readWebpInfo(shopBack), { width: 165, height: 230, hasAlpha: true });
  });
}
