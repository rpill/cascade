import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getTheme, getThemes } from '../src/theme/ThemeRegistry.ts';
import { getThemeAssets, getSlotFrameAsset, getSlotGlyphAsset, STOCK_EDGE_ASSET } from '../src/theme/ThemeAssets.ts';

test('every selectable theme loads a complete layered bundle without texture collisions', () => {
  const keys = new Map<string, string>();
  for (const theme of getThemes()) {
    const assets = getThemeAssets(theme);
    assert.equal(assets.length, 9);
    for (const asset of assets) {
      assert.ok(!keys.has(asset.key) || keys.get(asset.key) === asset.url, asset.key);
      keys.set(asset.key, asset.url);
      if (!asset.url.startsWith('data:')) {
        assert.ok(existsSync(new URL(`../public/${asset.url}`, import.meta.url)), asset.url);
      }
    }
    for (const role of ['clubs', 'diamonds', 'hearts', 'spades', 'stock'] as const) {
      const glyph = getSlotGlyphAsset(theme, role)!;
      assert.ok(assets.some(asset => asset.key === glyph.key));
      assert.notEqual(glyph.key, getSlotFrameAsset(theme).key);
    }
    assert.equal(getSlotGlyphAsset(theme, 'tableau'), null);
    assert.ok(assets.some(asset => asset.key === STOCK_EDGE_ASSET.key));
  }
});

test('an authored frame replaces only the frame, leaving the stock/tray glyph universal', () => {
  const original = getTheme();
  const custom = {...original, slots: {...original.slots, frame: {key:'custom-frame',url:'./custom.png'}}};
  assert.equal(getSlotFrameAsset(custom).key, 'custom-frame');
  assert.deepEqual(getSlotGlyphAsset(custom, 'stock'), getSlotGlyphAsset(original, 'stock'));
});
