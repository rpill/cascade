import test from 'node:test';
import assert from 'node:assert/strict';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../src/theme/ThemeAssets.ts';

import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
} from '../src/theme/ThemeRegistry.ts';

test('Walnut Study is the stable default theme', () => {
  assert.equal(DEFAULT_THEME_ID, 'walnut_study');
  assert.equal(getTheme().id, 'walnut_study');
  assert.equal(getTheme('walnut_study').cardBack.key, 'card-back');
  assert.equal(getTheme('walnut_study').boardSurface.key, 'cascade-board-surface');
});

test('Green Felt Club is a complete registry theme', () => {
  const theme = getTheme('green_felt_club');

  assert.equal(theme.id, 'green_felt_club');
  assert.match(theme.boardSurface.url, /green-felt-club\/board-surface\.jpg$/);
  assert.match(theme.cardBack.url, /green-felt-club\/card-back\.webp$/);
  assert.ok(getSlotFrameAsset(theme).url.startsWith('data:image/svg+xml'));
  assert.ok(getSlotGlyphAsset(theme, 'stock')?.url.startsWith('data:image/svg+xml'));
});

test('unknown ids never escape the registry and fall back to Walnut', () => {
  assert.equal(isThemeId('green_felt_club'), true);
  assert.equal(isThemeId('missing_theme'), false);
  assert.equal(getTheme('missing_theme').id, 'walnut_study');
});


test('Burgundy Club is a complete registry theme', () => {
  const theme = getTheme('burgundy_club');

  assert.equal(theme.id, 'burgundy_club');
  assert.match(theme.boardSurface.url, /burgundy-club\/board-surface-refined\.webp$/);
  assert.match(theme.cardBack.url, /burgundy-club\/card-back\.webp$/);
  assert.ok(getSlotFrameAsset(theme).url.startsWith('data:image/svg+xml'));
  assert.ok(getSlotGlyphAsset(theme, 'stock')?.url.startsWith('data:image/svg+xml'));
});

test('opaque slot recess colors stay surface-matched across every theme', async () => {
  const { THEMES } = await import('../src/theme/ThemeRegistry.ts');
  const expected: Record<string, string> = {
    walnut_study: '#5f3a24',
    green_felt_club: '#14523c',
    burgundy_club: '#5b3031',
    autumn_evening: '#63351d',
    winter_living_room: '#5b3a2a',
    spring_morning: '#633b27',
    summer_veranda: '#75472a',
    office: '#343631',
    retro_hotel: '#104c38',
    navy_study: '#173650',
  };

  for (const [id, color] of Object.entries(expected)) {
    assert.equal(THEMES[id as keyof typeof THEMES].slots.palette.recess, color, id);
  }
});
