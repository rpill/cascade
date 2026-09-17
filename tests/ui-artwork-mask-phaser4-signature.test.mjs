import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/components/UiSurface.ts', 'utf8');

test('UiSurface artwork rounding no longer depends on Phaser mask API signatures', () => {
  assert.doesNotMatch(source, /scene\.make\.graphics/);
  assert.doesNotMatch(source, /enableFilters\(\)/);
  assert.doesNotMatch(source, /filters!\.internal\.addMask/);
});
