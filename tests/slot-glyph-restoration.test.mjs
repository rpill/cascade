import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/game/view/TableAppearanceView.ts', 'utf8');

test('table appearance uses the existing theme slot glyph assets instead of ad-hoc text symbols', () => {
  assert.match(source, /getSlotGlyphAsset/);
  assert.match(source, /getSlotGlyphAsset\(theme, 'stock'\)/);
  assert.match(source, /SUITS\.map/);
  assert.doesNotMatch(source, /STOCK_SYMBOL|FOUNDATION_SYMBOLS|✦/);
});
