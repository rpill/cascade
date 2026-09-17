import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/components/RulesIllustration.ts', 'utf8');

test('stock rule uses the real game card back instead of a schematic club back', () => {
  assert.match(source, /GAME_APPEARANCE\.cardBack\.key/);
  assert.match(source, /cardBack\(/);
  assert.doesNotMatch(source, /label\('♣',\s*81,\s*160/);
});

test('free-space rule slots use the same 3:4 proportions as the cards', () => {
  assert.match(source, /const cardWidth = \(height: number\) => height \* 0\.75/);
  assert.match(source, /outline\(190, 142, cardWidth\(116\), 116\)/);
  assert.match(source, /outline\(412, 145, cardWidth\(126\), 126\)/);
  assert.doesNotMatch(source, /outline\(190, 142, 82, 166\)/);
});
