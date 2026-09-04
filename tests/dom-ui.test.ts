import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);
const menuSource = readFileSync(
  new URL('../src/game/view/MainMenuView.ts', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('board controls are native screen-space DOM buttons instead of camera objects', () => {
  assert.match(boardSource, /game-controls/);
  assert.match(boardSource, /document\.createElement\(['"]button['"]\)/);
  assert.match(boardSource, /canvas\.parentElement/);
  assert.match(boardSource, /append\(controls\)/);
  assert.doesNotMatch(boardSource, /scene\.add\.dom\(/);
  assert.doesNotMatch(boardSource, /private createGameButton\(/);
});

test('main menu is a viewport-sized screen-space DOM overlay', () => {
  assert.match(menuSource, /main-menu-dom/);
  assert.match(menuSource, /document\.createElement/);
  assert.match(menuSource, /canvas\.parentElement/);
  assert.match(menuSource, /append\(this\.root\)/);
  assert.doesNotMatch(menuSource, /scene\.add\.dom\(/);
  assert.doesNotMatch(menuSource, /GAME_WIDTH|GAME_HEIGHT/);
  assert.match(menuSource, /actions\.play\(mode\)/);
  assert.doesNotMatch(menuSource, /main-menu-play|ИГРАТЬ/);
});

test('DOM UI has explicit crisp browser typography and stacking', () => {
  assert.match(stylesSource, /\.game-controls/);
  assert.match(stylesSource, /\.game-control-button/);
  assert.match(stylesSource, /\.main-menu-dom/);
  assert.match(stylesSource, /\.main-menu-stats/);
  assert.match(stylesSource, /font-smoothing/);
  assert.match(stylesSource, /z-index:\s*100/);
});
