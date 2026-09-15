import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coinPill = readFileSync(new URL('../src/ui/components/CoinPill.ts', import.meta.url), 'utf8');
const themeCard = readFileSync(new URL('../src/ui/themes/ThemeCard.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');

test('Trifold product UI uses the shared coin icon instead of text glyph stand-ins', () => {
  assert.match(coinPill, /UI_ICON_KEYS\.coin/);
  assert.match(coinPill, /add\.image/);
  assert.match(home, /new CoinPill/);
  assert.doesNotMatch(coinPill, /●|🪙/);
  assert.doesNotMatch(themeCard, /🪙/);
});
