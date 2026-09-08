import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);
const iconsSource = readFileSync(
  new URL('../src/game/view/ui/UiIcons.ts', import.meta.url),
  'utf8',
);
const polishStyles = readFileSync(
  new URL('../src/game/view/GameControlsView.css', import.meta.url),
  'utf8',
);

test('gameplay mode label maps the three real GameMode ids to product labels', () => {
  assert.match(controlsSource, /winnable:\s*['"]STANDARD['"]/);
  assert.match(controlsSource, /original:\s*['"]CLASSIC['"]/);
  assert.match(controlsSource, /daily:\s*['"]DAILY['"]/);
  assert.match(controlsSource, /setMode\(mode:\s*GameMode\)/);
});

test('new-deal uses the shared standard Tabler cards glyph', () => {
  assert.match(iconsSource, /TABLER_GAMEPLAY_ICONS/);
  assert.match(iconsSource, /'new-deal':\s*\[/);
  assert.match(iconsSource, /M3\.604 7\.197l7\.138 -3\.109/);
  assert.doesNotMatch(iconsSource, /dataset\.plus = 'true'/);
});

test('Walnut gameplay skin removes the perimeter frame without changing the 44px shared hit size', () => {
  assert.match(polishStyles, /#game:has\(\.game-hud\)::after\s*\{[^}]*display:\s*none/s);
  assert.match(polishStyles, /width:\s*var\(--ui-hit-size,\s*44px\)/);
  assert.match(polishStyles, /height:\s*var\(--ui-hit-size,\s*44px\)/);
});
