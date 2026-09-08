import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');
const controlsCss = readFileSync(new URL('../src/game/view/GameControlsView.css', import.meta.url), 'utf8');
const iconsSource = readFileSync(new URL('../src/game/view/ui/UiIcons.ts', import.meta.url), 'utf8');
const themeRegistrySource = readFileSync(new URL('../src/theme/ThemeRegistry.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');

test('stock placement hint draws a clear card-drop arrow beneath a ghost card', () => {
  assert.match(boardSource, /const stemWidth =/);
  assert.match(boardSource, /const arrowTipY =/);
  assert.match(boardSource, /graphics\.fillRect\(stemX, stemY, stemWidth, stemHeight\)/);
  assert.match(boardSource, /graphics\.fillTriangle\(/);
});

test('gameplay controls reuse the menu paper material family instead of dark wood', () => {
  assert.match(controlsSource, /HUD_PAPER_TEXTURE = '\.\/assets\/ui\/paper-001-color\.jpg'/);
  assert.match(controlsSource, /--game-hud-paper/);
  assert.match(controlsCss, /var\(--game-hud-paper\)/);
  assert.match(controlsCss, /background-color:\s*#dcc58e/);
  assert.match(controlsCss, /border-radius:\s*50%/);
  assert.match(controlsCss, /color:\s*#35261a/);
  assert.doesNotMatch(controlsCss, /#2b1b12|#352117|#24170f/);
});

test('new deal uses the shared standard Tabler cards glyph', () => {
  assert.match(iconsSource, /TABLER_GAMEPLAY_ICONS/);
  assert.match(iconsSource, /'new-deal':\s*\[/);
  assert.match(iconsSource, /M3\.604 7\.197l7\.138 -3\.109/);
  assert.doesNotMatch(iconsSource, /dataset\.plus = 'true'/);
});

test('gameplay board wood is isolated from the menu wood-detail asset', () => {
  assert.match(themeRegistrySource, /assets\/theme\/walnut-table\.jpg/);
  assert.match(shellSource, /MENU_WOOD_DETAIL = '\.\/assets\/theme\/fine-grained-wood\.jpg'/);
});
