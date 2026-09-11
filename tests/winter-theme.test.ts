import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Winter Living Room is a released purchasable theme with complete assets', () => {
  assert.equal(isThemeId('winter_living_room'), true);

  const theme = getTheme('winter_living_room');
  assert.equal(theme.id, 'winter_living_room');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /winter-living-room\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /winter-living-room\/card-back\.webp$/);

  const product = getThemeProduct('winter_living_room');
  assert.ok(product);
  assert.equal(product.name, 'Зимняя гостиная');
  assert.equal(product.price, 300);
  assert.match(product.previewUrl, /winter-living-room\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /winter-living-room\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/winter-living-room/board-surface.webp',
    '../public/assets/themes/winter-living-room/card-back.webp',
    '../public/assets/themes/winter-living-room/shop-preview.webp',
    '../public/assets/themes/winter-living-room/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});

test('Winter Living Room has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Зимняя гостиная': 'Winter Living Room'/);
  assert.match(source, /'Тёмное дерево, хвоя и тёплый свет зимнего вечера\.': 'Dark wood, evergreens and the warm light of a winter evening\.'/);
});

test('Winter Living Room can be purchased and equipped through the normal economy flow', async () => {
  const { createDefaultMetaSave } = await import('../src/meta/MetaSave.ts');
  const { applyMetaOperation } = await import('../src/meta/MetaOperations.ts');
  const state = createDefaultMetaSave();
  state.progression.coins = 300;

  const bought = applyMetaOperation(state, { kind: 'purchase', themeId: 'winter_living_room' });
  assert.equal(bought.progression.coins, 0);
  assert.ok(bought.collection.ownedThemes.includes('winter_living_room'));

  const equipped = applyMetaOperation(bought, { kind: 'equip', themeId: 'winter_living_room' });
  assert.equal(equipped.equipped.theme, 'winter_living_room');
});
