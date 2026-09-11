import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Office is a released purchasable theme with complete assets', () => {
  assert.equal(isThemeId('office'), true);

  const theme = getTheme('office');
  assert.equal(theme.id, 'office');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /office\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /office\/card-back\.png$/);

  const product = getThemeProduct('office');
  assert.ok(product);
  assert.equal(product.name, 'Офис');
  assert.equal(product.price, 350);
  assert.match(product.previewUrl, /office\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /office\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/office/board-surface.webp',
    '../public/assets/themes/office/card-back.png',
    '../public/assets/themes/office/shop-preview.webp',
    '../public/assets/themes/office/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});

test('Office has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Офис': 'Office'/);
  assert.match(source, /'Тёмная кожа, латунные детали и аккуратный рабочий стол\.': 'Dark leather, brass details and a tidy workspace\.'/);
});
