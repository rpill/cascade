import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const asset = (name) => new URL(`../public/assets/${name}`, import.meta.url);

test('hybrid Home ships photographed material textures and public-domain ornament SVGs', () => {
  for (const name of [
    'theme/menu-dark-wood.jpg',
    'ui/paper-001-color.jpg',
    'ui/paper-004-color.jpg',
  ]) {
    assert.equal(existsSync(asset(name)), true, `${name} must exist`);
    assert.ok(statSync(asset(name)).size > 32_000, `${name} must be a real texture asset`);
  }

  for (const name of [
    'ui/ornaments/art-nouveau-flourish.svg',
    'ui/ornaments/redmond-corner.svg',
    'ui/ornaments/harpels-flourish.svg',
  ]) {
    assert.equal(existsSync(asset(name)), true, `${name} must exist`);
    assert.match(readFileSync(asset(name), 'utf8'), /<svg/);
  }
});
