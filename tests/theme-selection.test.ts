import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveThemeId } from '../src/theme/ThemeSelection.ts';

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
