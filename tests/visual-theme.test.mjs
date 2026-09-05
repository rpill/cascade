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
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
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

test('gameplay icon controls reuse the shared parchment language without legacy text-button geometry', () => {
  const controlRule = stylesSource.match(/\.ui-icon-control\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(controlRule, /--ui-hit-size/);
  assert.match(controlRule, /--ui-parchment/);
  assert.match(controlRule, /--ui-ink/);
  assert.doesNotMatch(controlRule, /#b8473e|rgba\(184,\s*71,\s*62/);
  assert.doesNotMatch(stylesSource, /\.game-control-button/);
  assert.match(controlsSource, /game-control-home/);
  assert.match(stylesSource, /#game::after/);
});

test('Home is visually separated from destructive deal actions', () => {
  assert.match(stylesSource, /--ui-home-gap:\s*24px/);
  assert.match(stylesSource, /\.game-control-home\s*\{[\s\S]*margin-left:/);
});


test('gameplay HUD stays inside the decorative board frame', () => {
  assert.match(stylesSource, /--ui-frame-inset:\s*10px/);
  assert.match(stylesSource, /--ui-hud-frame-gap:\s*16px/);
  assert.match(stylesSource, /#game::after\s*\{[\s\S]*inset:\s*var\(--ui-frame-inset\)/);
  const hudRule = stylesSource.match(/\.game-controls\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(hudRule, /var\(--ui-frame-inset\)/);
  assert.match(hudRule, /var\(--ui-hud-frame-gap\)/);
  assert.doesNotMatch(hudRule, /top:\s*max\(8px/);
  assert.doesNotMatch(hudRule, /right:\s*max\(12px/);
});
