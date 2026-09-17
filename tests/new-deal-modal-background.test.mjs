import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/game/NewDealConfirmOverlay.ts', 'utf8');

test('new deal confirmation uses a muted scenic paper background', () => {
  assert.match(source, /CASCADE_UI_ART_KEYS\.homeHero/);
  assert.match(source, /artworkAlpha: 0\.82/);
  assert.match(source, /artworkWashAlpha: 0\.76/);
  assert.match(source, /artworkMode: 'cover'/);
});
