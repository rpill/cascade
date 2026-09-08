import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { getThemeAssets, getSlotAsset } from '../src/theme/ThemeAssets.ts';

test('Burgundy Club is a complete authored-image theme bundle', () => {
  const theme = getTheme('burgundy_club');

  assert.equal(theme.id, 'burgundy_club');
  assert.equal(theme.name, 'Burgundy Club');
  assert.equal(theme.surfaceScale, 'cover');
  assert.equal(theme.slots.kind, 'images');
  assert.match(theme.boardSurface.url, /burgundy-club\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /burgundy-club\/card-back\.png$/);

  const assets = getThemeAssets(theme);
  assert.equal(assets.length, 8);
  for (const asset of assets) {
    assert.ok(!asset.url.startsWith('data:'), `${asset.key} should be an authored asset`);
    assert.ok(existsSync(new URL(`../public/${asset.url}`, import.meta.url)), asset.url);
  }

  assert.match(getSlotAsset(theme, 'clubs').url, /burgundy-club\/slots\/clubs\.png$/);
  assert.match(getSlotAsset(theme, 'diamonds').url, /burgundy-club\/slots\/diamonds\.png$/);
  assert.match(getSlotAsset(theme, 'hearts').url, /burgundy-club\/slots\/hearts\.png$/);
  assert.match(getSlotAsset(theme, 'spades').url, /burgundy-club\/slots\/spades\.png$/);
  assert.match(getSlotAsset(theme, 'tableau').url, /burgundy-club\/slots\/tableau-empty\.png$/);
  assert.match(getSlotAsset(theme, 'stock').url, /burgundy-club\/slots\/stock-free-cell\.png$/);
});
