import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/components/ButtonSurface.ts', 'utf8');

test('flat buttons do not tile or stretch a center texture', () => {
  assert.doesNotMatch(source, /TileSprite|tileSprite|setTileScale/);
  assert.match(source, /fillRoundedRect/);
});
