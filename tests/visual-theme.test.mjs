import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const bootSource = readFileSync(
  new URL('../src/game/scenes/BootScene.ts', import.meta.url),
  'utf8',
);
const boardTextureSource = readFileSync(
  new URL('../src/game/view/BoardTexture.ts', import.meta.url),
  'utf8',
);
const boardViewSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('board surface comes from a preloaded external theme texture instead of a generated dot pattern', () => {
  assert.match(bootSource, /\/assets\/theme\//);
  assert.doesNotMatch(boardTextureSource, /generateTexture\(|fillCircle\(|fillRect\(/);
  assert.match(boardTextureSource, /return\s+BOARD_TEXTURE_KEY/);
  assert.equal(
    existsSync(new URL('../public/assets/theme/fine-grained-wood.jpg', import.meta.url)),
    true,
  );
});

test('historical board pass keeps wood visible under the foundation rail and darkens the surface non-destructively', () => {
  assert.match(boardViewSource, /boardSurface\.setTint\(/);
  assert.doesNotMatch(boardViewSource, /private utilityPanel/);
  assert.doesNotMatch(boardViewSource, /this\.utilityPanel\s*=\s*this\.scene\.add\.rectangle/);
});

test('foundation decoration is drawn as lightweight responsive vectors instead of a solid panel or raster frame', () => {
  assert.match(boardViewSource, /foundationFrameGraphics/);
  assert.match(boardViewSource, /redrawFoundationFrames\(/);
  assert.match(boardViewSource, /strokeRect\(/);
  assert.doesNotMatch(boardViewSource, /FOUNDATION_FRAME_TEXTURE_KEY/);
});

test('gameplay controls use the historical parchment treatment instead of the old flat red buttons', () => {
  const controlRule = stylesSource.match(/\.game-control-button\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(controlRule, /Georgia|Times New Roman/);
  assert.match(controlRule, /clip-path/);
  assert.doesNotMatch(controlRule, /#b8473e|rgba\(184,\s*71,\s*62/);
  assert.match(stylesSource, /--ui-parchment/);
  assert.match(stylesSource, /#game::after/);
});
