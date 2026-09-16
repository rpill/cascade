import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/game/view/TableAppearanceView.ts', 'utf8');

test('stock slot has no custom icon or code-drawn glyph', () => {
  assert.doesNotMatch(source, /stockGlyph/);
  assert.doesNotMatch(source, /drawStockGlyph/);
  assert.doesNotMatch(source, /fillTriangle/);
  assert.match(source, /FOUNDATION_SYMBOLS/);
});
