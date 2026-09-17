import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appearance = readFileSync('src/game/view/TableAppearanceView.ts', 'utf8');
const layout = readFileSync('src/game/view/ViewportLayout.ts', 'utf8');

test('game table draws only one perimeter frame', () => {
  const block = appearance.slice(appearance.indexOf('this.perimeterFrame.clear()'), appearance.indexOf('this.slots.clear()'));
  assert.equal((block.match(/strokeRoundedRect/g) ?? []).length, 1);
  assert.doesNotMatch(block, /goldLight/);
});

test('top gameplay row keeps adaptive breathing room below the perimeter on every profile', () => {
  assert.match(layout, /compact\s*\? clamp\(14, safeHeight \* 0\.032, 18\)/);
  assert.match(layout, /: clamp\(12, safeHeight \* 0\.018, 22\)/);
  assert.match(layout, /const mainPlayY = boardY \+ mainPlayTopOffset/);
});
