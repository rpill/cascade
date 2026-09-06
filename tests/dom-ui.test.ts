import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);
const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
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

test('gameplay controls are native screen-space DOM owned outside BoardView', () => {
  assert.doesNotMatch(boardSource, /game-controls|ownedDomElements|createGameButtons/);
  assert.match(controlsSource, /game-controls/);
  assert.match(controlsSource, /canvas\.parentElement/);
  assert.match(controlsSource, /append\(this\.root\)/);
  assert.doesNotMatch(controlsSource, /scene\.add\.dom\(/);
});

test('hybrid app shell is a viewport-sized screen-space DOM surface', () => {
  assert.match(shellSource, /app-shell-dom/);
  assert.match(shellSource, /app-shell-surface/);
  assert.match(shellSource, /canvas\.parentElement/);
  assert.match(shellSource, /append\(this\.root\)/);
  assert.doesNotMatch(shellSource, /scene\.add\.dom\(/);
  assert.doesNotMatch(shellSource, /GAME_WIDTH|GAME_HEIGHT/);
});

test('DOM UI has explicit crisp browser typography and stacking', () => {
  assert.match(stylesSource, /\.game-controls/);
  assert.match(stylesSource, /\.ui-icon-control/);
  assert.match(stylesSource, /\.app-shell-dom/);
  assert.match(stylesSource, /\.main-shell-mode-grid/);
  assert.match(stylesSource, /\.meta-modal-panel/);
  assert.match(stylesSource, /font-smoothing/);
  assert.match(stylesSource, /z-index:\s*100/);
});

test('statistics remains a native no-scroll modal during this migration task', () => {
  assert.match(statisticsSource, /statistics-dom/);
  assert.match(statisticsSource, /meta-modal-panel/);
  assert.match(statisticsSource, /canvas\.parentElement/);
  assert.doesNotMatch(stylesSource, /\.app-shell-surface\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.doesNotMatch(stylesSource, /\.meta-modal-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.match(stylesSource, /html,[^]*body,[^]*#game[^]*overflow:\s*hidden/);
});

test('leaderboard modal still reuses the no-scroll modal shell with truncated names', () => {
  const leaderboardSource = readFileSync(
    new URL('../src/game/view/LeaderboardView.ts', import.meta.url),
    'utf8',
  );
  assert.match(leaderboardSource, /meta-modal-dom/);
  assert.match(leaderboardSource, /meta-modal-panel/);
  assert.match(stylesSource, /\.leaderboard-panel/);
  assert.match(stylesSource, /\.leaderboard-name\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
});
