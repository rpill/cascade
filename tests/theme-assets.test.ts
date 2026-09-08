import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getTheme, getThemes } from '../src/theme/ThemeRegistry.ts';
import { getThemeAssets, getSlotAsset } from '../src/theme/ThemeAssets.ts';

test('every selectable theme loads a complete bundle without texture-key collisions', () => {
  const keys = new Map<string, string>();
  for (const theme of getThemes()) {
    const assets = getThemeAssets(theme);
    assert.equal(assets.length, 8);
    for (const asset of assets) {
      assert.ok(!keys.has(asset.key) || keys.get(asset.key) === asset.url, asset.key);
      keys.set(asset.key, asset.url);
      if (!asset.url.startsWith('data:')) {
        assert.ok(existsSync(new URL(`../public/${asset.url}`, import.meta.url)), asset.url);
      }
    }
    for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const) {
      assert.ok(assets.some(asset => asset.key === getSlotAsset(theme, suit).key));
    }
    assert.ok(assets.some(asset => asset.key === getSlotAsset(theme, 'stock').key));
    assert.ok(assets.some(asset => asset.key === getSlotAsset(theme, 'tableau').key));
  }
});

test('generated slots have distinct suit artwork and image slots keep authored assets', () => {
  const walnut = getTheme();
  const svg = decodeURIComponent(getSlotAsset(walnut, 'hearts').url.split(',')[1]);
  assert.match(svg, /<svg/);
  assert.match(svg, /viewBox="0 0 216 302"/);
  assert.notEqual(getSlotAsset(walnut, 'hearts').url, getSlotAsset(walnut, 'spades').url);
  assert.match(getSlotAsset(getTheme('green_felt_club'), 'clubs').url, /slots\/clubs.png$/);
});
