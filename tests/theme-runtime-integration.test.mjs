import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootSource = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const boardSource = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../src/theme/ThemeDefinition.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../src/theme/ThemeRegistry.ts', import.meta.url), 'utf8');

test('BootScene preloads the selected theme board, card back, and slot assets', () => {
  assert.match(bootSource, /resolveThemeId\(/);
  assert.match(bootSource, /getTheme\(/);
  assert.match(bootSource, /loadThemeAsset\(theme\.boardSurface\)/);
  assert.match(bootSource, /this\.load\.image\(asset\.key, asset\.url\)/);
  assert.match(bootSource, /loadThemeAsset\(theme\.cardBack\)/);
  assert.match(bootSource, /theme\.slots/);
});

test('GameScene passes the selected theme into BoardView', () => {
  assert.match(sceneSource, /resolveThemeId\(/);
  assert.match(sceneSource, /getTheme\(/);
  assert.match(sceneSource, /new BoardView\([\s\S]*activeTheme/s);
});

test('BoardView uses theme assets for surface, card back, and slot placeholders only', () => {
  assert.match(boardSource, /getBoardTexture\(this\.theme\)/);
  assert.match(boardSource, /theme\.cardBack\.key/);
  assert.match(boardSource, /theme\.slots/);
  assert.doesNotMatch(boardSource, /shellEnvironment|shellAccent|cursor/);
});

test('theme contract contains only gameplay-table cosmetics, not shell or cursor skinning', () => {
  assert.match(themeSource, /boardSurface/);
  assert.match(themeSource, /cardBack/);
  assert.match(themeSource, /slots/);
  assert.doesNotMatch(themeSource, /shellEnvironment|shellDetail|cursor|shellAccent/);
  assert.doesNotMatch(registrySource, /shellEnvironment|shellDetail|cursor|shellAccent/);
});
