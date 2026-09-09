import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveThemeId } from '../src/theme/ThemeSelection.ts';

test('production selection ignores preview and does not equip unowned themes', async () => {
  const module = await import('../src/theme/ThemeSelection.ts');
  assert.equal(typeof (module as any).resolveOwnedThemeId, 'function');
  const resolve = (module as any).resolveOwnedThemeId;
  assert.equal(resolve('?theme=navy_study', 'burgundy_club', ['walnut_study'], false), 'walnut_study');
  assert.equal(resolve('?theme=navy_study', 'burgundy_club', ['walnut_study','burgundy_club'], false), 'burgundy_club');
  assert.equal(resolve('?theme=navy_study', null, ['walnut_study'], true), 'navy_study');
});

test('valid preview query overrides a persisted equipped theme', () => {
  assert.equal(
    resolveThemeId('?theme=green_felt_club', 'walnut_study'),
    'green_felt_club',
  );
});

test('invalid preview query falls through to a valid persisted theme', () => {
  assert.equal(
    resolveThemeId('?theme=does_not_exist', 'green_felt_club'),
    'green_felt_club',
  );
});

test('missing or invalid inputs fall back to Walnut without mutation', () => {
  assert.equal(resolveThemeId('', null), 'walnut_study');
  assert.equal(resolveThemeId('?theme=nope', 'nope'), 'walnut_study');
});
