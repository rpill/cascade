import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/components/ButtonSurface.ts', 'utf8');

test('wide button center is tiled, not horizontally stretched', () => {
  assert.match(source, /GameObjects\.TileSprite/);
  assert.match(source, /add\.tileSprite\(/);
  assert.match(source, /setTileScale\(/);
  assert.doesNotMatch(source, /center\.setPosition\([^\n]+setDisplaySize\(centerWidth/);
});
