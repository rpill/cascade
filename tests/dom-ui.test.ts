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
const statisticsSource = readFileSync(
  new URL('../src/game/view/StatisticsView.ts', import.meta.url),
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
  assert.match(stylesSource, /\.main-menu-meta-actions/);
  assert.match(stylesSource, /\.meta-modal-panel/);
  assert.match(stylesSource, /font-smoothing/);
  assert.match(stylesSource, /z-index:\s*100/);
});

test('statistics is a native screen-space DOM modal and UI surfaces do not scroll', () => {
  assert.match(statisticsSource, /statistics-dom/);
  assert.match(statisticsSource, /meta-modal-panel/);
  assert.match(statisticsSource, /canvas\.parentElement/);
  assert.doesNotMatch(stylesSource, /\.main-menu-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.doesNotMatch(stylesSource, /\.meta-modal-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.match(stylesSource, /html,[^]*body,[^]*#game[^]*overflow:\s*hidden/);
});

test('leaderboard modal reuses the no-scroll shell with truncated names', () => {
  const leaderboardSource = readFileSync(
    new URL('../src/game/view/LeaderboardView.ts', import.meta.url),
    'utf8',
  );
  assert.match(leaderboardSource, /meta-modal-dom/);
  assert.match(leaderboardSource, /meta-modal-panel/);
  assert.match(stylesSource, /\.leaderboard-panel/);
  assert.match(stylesSource, /\.leaderboard-name\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(stylesSource, /\.leaderboard-[^{]+\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
