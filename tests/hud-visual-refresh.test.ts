import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hudSource = readFileSync(new URL('../src/ui/game/GameHud.ts', import.meta.url), 'utf8');
const tableSource = readFileSync(new URL('../src/game/view/TableAppearanceView.ts', import.meta.url), 'utf8');

test('metrics panel no longer renders the right-side decorative artwork and uses ornate framed jade surface', () => {
  assert.match(hudSource, /this\.metricsArt = scene\.add\.image[\s\S]*setVisible\(false\)/);
  assert.match(hudSource, /this\.metricsSurface\.layout\(bounds, 'jade', true\)/);
  assert.match(hudSource, /color: '#e4c78a', fontFamily: 'Georgia, serif'/);
  assert.doesNotMatch(hudSource, /coverCrop/);
});

test('table slots use slim gold outlines and visible foundation suit glyphs', () => {
  assert.match(tableSource, /FOUNDATION_SYMBOLS = \['♣', '♥', '♦', '♠'\]/);
  assert.doesNotMatch(tableSource, /STOCK_SYMBOL/);
  assert.match(tableSource, /UI_TOKENS\.color\.goldLight/);
  assert.match(tableSource, /foundationIcons/);
});
