import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Summer Veranda is a released purchasable theme with complete assets', () => {
  assert.equal(isThemeId('summer_veranda'), true);

  const theme = getTheme('summer_veranda');
  assert.equal(theme.id, 'summer_veranda');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /summer-veranda\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /summer-veranda\/card-back\.webp$/);

  const product = getThemeProduct('summer_veranda');
  assert.ok(product);
  assert.equal(product.name, 'Летняя веранда');
  assert.equal(product.price, 300);
  assert.match(product.previewUrl, /summer-veranda\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /summer-veranda\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/summer-veranda/board-surface.webp',
    '../public/assets/themes/summer-veranda/card-back.webp',
    '../public/assets/themes/summer-veranda/shop-preview.webp',
    '../public/assets/themes/summer-veranda/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});

test('Summer Veranda has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Летняя веранда': 'Summer Veranda'/);
  assert.match(source, /'Тёплый стол, цитрусы и солнечные тени летнего дня\.': 'Warm wood, citrus and the sunlit shadows of a summer day\.'/);
});

test('Summer Veranda can be purchased and equipped through the normal economy flow', async () => {
  const { createDefaultMetaSave } = await import('../src/meta/MetaSave.ts');
  const { applyMetaOperation } = await import('../src/meta/MetaOperations.ts');
  const state = createDefaultMetaSave();
  state.progression.coins = 300;

  const bought = applyMetaOperation(state, { kind: 'purchase', themeId: 'summer_veranda' });
  assert.equal(bought.progression.coins, 0);
  assert.ok(bought.collection.ownedThemes.includes('summer_veranda'));

  const equipped = applyMetaOperation(bought, { kind: 'equip', themeId: 'summer_veranda' });
  assert.equal(equipped.equipped.theme, 'summer_veranda');
});
