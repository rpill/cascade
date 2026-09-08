import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getTheme, isThemeId } from '../src/theme/ThemeRegistry.ts';

test('unregistered comparison concepts remain on disk without masquerading as playable themes', () => {
  for (const id of ['navy_study','black_marble','vintage_paper_desk']) {
    assert.equal(isThemeId(id), false);
    assert.equal(getTheme(id).id, 'walnut_study');
    assert.ok(existsSync(new URL(`../public/assets/themes/${id.replaceAll('_','-')}/board-surface.svg`,import.meta.url)));
  }
});
