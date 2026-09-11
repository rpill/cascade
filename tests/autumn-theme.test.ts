import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Autumn Evening is a released purchasable theme with complete assets', () => {
  assert.equal(isThemeId('autumn_evening'), true);

  const theme = getTheme('autumn_evening');
  assert.equal(theme.id, 'autumn_evening');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /autumn-evening\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /autumn-evening\/card-back\.png$/);

  const product = getThemeProduct('autumn_evening');
  assert.ok(product);
  assert.equal(product.name, 'Осенний вечер');
  assert.equal(product.price, 300);
  assert.match(product.previewUrl, /autumn-evening\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /autumn-evening\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/autumn-evening/board-surface.webp',
    '../public/assets/themes/autumn-evening/card-back.png',
    '../public/assets/themes/autumn-evening/shop-preview.webp',
    '../public/assets/themes/autumn-evening/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});


test('Autumn Evening has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Осенний вечер': 'Autumn Evening'/);
  assert.match(source, /'Тёплое дерево, янтарный свет и осенние листья\.': 'Warm wood, amber light and autumn leaves\.'/);
});


test('Autumn Evening can be purchased and equipped through the normal economy flow', async () => {
  const { createDefaultMetaSave } = await import('../src/meta/MetaSave.ts');
  const { applyMetaOperation } = await import('../src/meta/MetaOperations.ts');
  const state = createDefaultMetaSave();
  state.progression.coins = 300;

  const bought = applyMetaOperation(state, { kind: 'purchase', themeId: 'autumn_evening' });
  assert.equal(bought.progression.coins, 0);
  assert.ok(bought.collection.ownedThemes.includes('autumn_evening'));

  const equipped = applyMetaOperation(bought, { kind: 'equip', themeId: 'autumn_evening' });
  assert.equal(equipped.equipped.theme, 'autumn_evening');
});
