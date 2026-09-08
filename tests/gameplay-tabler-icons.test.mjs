import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/ui/UiIcons.ts', import.meta.url),
  'utf8',
);

test('gameplay HUD uses the approved Tabler outline glyphs', () => {
  assert.match(source, /M9 13l-4 -4l4 -4m-4 4h11a4 4 0 0 1 0 8h-1/);
  assert.match(source, /M20 11a8\.1 8\.1 0 0 0 -15\.5 -2m-\.5 -4v4h4/);
  assert.match(source, /M4 13a8\.1 8\.1 0 0 0 15\.5 2m\.5 4v-4h-4/);
  assert.match(source, /M3\.604 7\.197l7\.138 -3\.109/);
  assert.match(source, /M15 4h1a1 1 0 0 1 1 1v3\.5/);
  assert.match(source, /M5 12l-2 0l9 -9l9 9l-2 0/);
  assert.match(source, /M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6/);
});

test('the four gameplay actions explicitly share the Tabler set marker', () => {
  assert.match(source, /TABLER_GAMEPLAY_ICONS/);
  assert.match(source, /svg\.dataset\.iconSet = 'tabler'/);
});
