import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/components/UiSurface.ts', 'utf8');

test('artwork corner cutouts use Phaser Vector2 points accepted by Phaser 4 fillPoints', () => {
  assert.match(source, /Phaser\.Math\.Vector2/);
  assert.doesNotMatch(source, /points\.push\(\{ x:/);
  assert.doesNotMatch(source, /\{ x: left, y: top \}/);
});
