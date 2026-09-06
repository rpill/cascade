import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);
const playSource = readFileSync(
  new URL('../src/game/view/PlayPageView.ts', import.meta.url),
  'utf8',
);
const statisticsSource = readFileSync(
  new URL('../src/game/view/StatisticsView.ts', import.meta.url),
  'utf8',
);
const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('shell makes Statistics a destination while leaderboard remains a secondary Play affordance for now', () => {
  assert.match(shellSource, /'statistics'/);
  assert.match(shellSource, /СТАТИСТИКА/);
  assert.match(playSource, /Таблица лидеров/);
  assert.match(playSource, /actions\.leaderboard\(\)/);
  assert.doesNotMatch(playSource, /Лучшее время:/);
});

test('leaderboard action stays disabled until leaderboard service is available', () => {
  assert.match(playSource, /updateLeaderboardsAvailable\(available: boolean\)/);
  assert.match(playSource, /this\.leaderboardButton\.disabled = !available/);
});

test('scene still owns the existing statistics modal until its shell-page migration task', () => {
  assert.match(sceneSource, /StatisticsView/);
  assert.match(sceneSource, /private statisticsView!: StatisticsView/);
  assert.match(sceneSource, /private statisticsOpen = false/);
  assert.match(sceneSource, /private openStatistics\(\): void/);
  assert.match(sceneSource, /this\.statisticsView\.show\(this\.buildStatisticsViewState\(\)\)/);
});

test('meta refresh updates the new Play page and existing statistics view', () => {
  assert.match(
    sceneSource,
    /refreshMenuMeta\(\): void \{[^]*playPage\.updateDailyState\(this\.buildDailyMenuState\(\)\)[^]*playPage\.updateLeaderboardsAvailable\([^]*statisticsView\.update\(this\.buildStatisticsViewState\(\)\)/,
  );
});

test('Escape closes statistics before returning from the underlying shell', () => {
  assert.match(sceneSource, /if \(this\.statisticsOpen\)[^]*this\.closeStatistics\(\)[^]*return/);
  assert.match(sceneSource, /this\.closeMainMenu\(\)/);
});

test('shell and reusable modal surfaces explicitly forbid scroll containers', () => {
  assert.match(stylesSource, /\.app-shell-surface\s*\{[^}]*overflow\s*:\s*hidden/s);
  assert.doesNotMatch(stylesSource, /\.app-shell-surface\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.match(stylesSource, /\.meta-modal-panel\s*\{[^}]*overflow\s*:\s*hidden/s);
  assert.match(statisticsSource, /meta-modal-panel/);
});
