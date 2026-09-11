import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Spring Morning is a released purchasable theme with complete assets', () => {
  assert.equal(isThemeId('spring_morning'), true);

  const theme = getTheme('spring_morning');
  assert.equal(theme.id, 'spring_morning');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /spring-morning\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /spring-morning\/card-back\.webp$/);

  const product = getThemeProduct('spring_morning');
  assert.ok(product);
  assert.equal(product.name, 'Весеннее утро');
  assert.equal(product.price, 300);
  assert.match(product.previewUrl, /spring-morning\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /spring-morning\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/spring-morning/board-surface.webp',
    '../public/assets/themes/spring-morning/card-back.webp',
    '../public/assets/themes/spring-morning/shop-preview.webp',
    '../public/assets/themes/spring-morning/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});

test('Spring Morning has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Весеннее утро': 'Spring Morning'/);
  assert.match(source, /'Свежая зелень, цветущие ветви и мягкий весенний свет\.': 'Fresh greenery, blooming branches and soft spring light\.'/);
});

test('Spring Morning can be purchased and equipped through the normal economy flow', async () => {
  const { createDefaultMetaSave } = await import('../src/meta/MetaSave.ts');
  const { applyMetaOperation } = await import('../src/meta/MetaOperations.ts');
  const state = createDefaultMetaSave();
  state.progression.coins = 300;

  const bought = applyMetaOperation(state, { kind: 'purchase', themeId: 'spring_morning' });
  assert.equal(bought.progression.coins, 0);
  assert.ok(bought.collection.ownedThemes.includes('spring_morning'));

  const equipped = applyMetaOperation(bought, { kind: 'equip', themeId: 'spring_morning' });
  assert.equal(equipped.equipped.theme, 'spring_morning');
});
