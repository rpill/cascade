import test from 'node:test';
import assert from 'node:assert/strict';

import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';

const previewIds = [
  'navy_study',
  'black_marble',
  'vintage_paper_desk',
] as const;

test('Burgundy Club uses a cover board and the shared vector slot system', () => {
  assert.equal(isThemeId('burgundy_club'), true);
  const theme = getTheme('burgundy_club');
  assert.equal(theme.slots.kind, 'vector');
  assert.equal(theme.surfaceScale, 'cover');
  assert.match(theme.boardSurface.url, /burgundy-club\/board-surface\.webp$/);
  assert.match(theme.cardBack.url, /burgundy-club\/card-back\.png$/);
});

test('remaining comparison-pack previews stay selectable vector themes', () => {
  for (const id of previewIds) {
    assert.equal(isThemeId(id), true, id);
    const theme = getTheme(id);
    assert.equal(theme.id, id);
    assert.equal(theme.slots.kind, 'vector');
    assert.equal(theme.surfaceScale, 'cover');
    assert.match(theme.boardSurface.url, new RegExp(`/themes/${id.replaceAll('_', '-')}/board-surface\\.(?:webp|png|jpg|svg)$`));
    assert.match(theme.cardBack.url, new RegExp(`/themes/${id.replaceAll('_', '-')}/card-back\\.(?:webp|png|jpg|svg)$`));
  }
});
