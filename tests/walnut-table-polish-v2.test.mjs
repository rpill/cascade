import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const iconsSource = readFileSync(new URL('../src/game/view/ui/UiIcons.ts', import.meta.url), 'utf8');

test('new deal uses the shared standard Tabler cards glyph', () => {
  assert.match(iconsSource, /TABLER_GAMEPLAY_ICONS/);
  assert.match(iconsSource, /'new-deal':\s*\[/);
  assert.match(iconsSource, /M3\.604 7\.197l7\.138 -3\.109/);
  assert.doesNotMatch(iconsSource, /dataset\.plus = 'true'/);
});
