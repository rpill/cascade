import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';
import { getThemeProduct } from '../src/theme/ThemeCatalog.ts';

test('Retro Hotel is a released premium theme with complete assets', () => {
  assert.equal(isThemeId('retro_hotel'), true);

  const theme = getTheme('retro_hotel');
  assert.equal(theme.id, 'retro_hotel');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /retro-hotel\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /retro-hotel\/card-back\.webp$/);

  const product = getThemeProduct('retro_hotel');
  assert.ok(product);
  assert.equal(product.name, 'Ретро-отель');
  assert.equal(product.price, 700);
  assert.match(product.previewUrl, /retro-hotel\/shop-preview\.webp$/);
  assert.match(product.cardBackUrl, /retro-hotel\/shop-card-back\.webp$/);

  for (const path of [
    '../public/assets/themes/retro-hotel/board-surface.webp',
    '../public/assets/themes/retro-hotel/card-back.webp',
    '../public/assets/themes/retro-hotel/shop-preview.webp',
    '../public/assets/themes/retro-hotel/shop-card-back.webp',
  ]) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `${path} must exist`);
  }
});

test('Retro Hotel has English catalog copy', () => {
  const english = new URL('../src/localization/English.ts', import.meta.url);
  const source = readFileSync(english, 'utf8');
  assert.match(source, /'Ретро-отель': 'Retro Hotel'/);
  assert.match(source, /'Изумрудный стол, латунь и винтажные детали старого отеля\.': 'Emerald felt, brass and vintage details from a grand old hotel\.'/);
});
