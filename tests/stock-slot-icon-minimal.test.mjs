import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/game/view/TableAppearanceView.ts', 'utf8');

test('stock slot uses a locally drawn card-and-down-arrow glyph without theme asset plumbing', () => {
  assert.match(source, /stockGlyph/);
  assert.match(source, /strokeRoundedRect/);
  assert.match(source, /fillTriangle|lineTo/);
  assert.doesNotMatch(source, /getSlotGlyphAsset/);
  assert.doesNotMatch(source, /private theme:/);
  assert.doesNotMatch(source, /STOCK_SYMBOL/);
});
