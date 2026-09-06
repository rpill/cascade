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
const pageSource = readFileSync(
  new URL('../src/game/view/StatisticsPageView.ts', import.meta.url),
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

test('shell exposes Statistics and Home keeps a secondary leaderboard affordance', () => {
  assert.match(shellSource, /'statistics'/);
  assert.match(shellSource, /СТАТИСТИКА/);
  assert.match(playSource, /Таблица лидеров/);
  assert.match(playSource, /actions\.leaderboard\(\)/);
});

test('leaderboard action stays navigable even when platform leaderboard is unavailable', () => {
  assert.match(playSource, /updateLeaderboardsAvailable\(available: boolean\)/);
  assert.match(playSource, /this\.leaderboardButton\.dataset\.available = String\(available\)/);
  assert.doesNotMatch(playSource, /this\.leaderboardButton\.disabled = !available/);
});

test('scene owns one shell StatisticsPageView instead of separate statistics and leaderboard overlays', () => {
  assert.match(sceneSource, /private statisticsPage!: StatisticsPageView/);
  assert.match(sceneSource, /new StatisticsPageView\(this\.appShell\.contentHost, \{/);
  assert.doesNotMatch(sceneSource, /new StatisticsView\(/);
  assert.doesNotMatch(sceneSource, /new LeaderboardView\(/);
});

test('meta refresh updates Play and the shell statistics page from persisted meta state', () => {
  assert.match(
    sceneSource,
    /refreshMenuMeta\(\): void \{[^]*playPage\.updateDailyState\(this\.buildDailyMenuState\(\)\)[^]*playPage\.updateLeaderboardsAvailable\([^]*statisticsPage\.update\(this\.buildStatisticsPageState\(\)\)/,
  );
});

test('Escape from Statistics returns to Play while back-to-game can close the whole shell', () => {
  assert.match(sceneSource, /if \(this\.statisticsOpen\)[^]*this\.navigateShell\('play'\)[^]*return/);
  assert.match(sceneSource, /private closeMainMenu\(\): void[^]*this\.closeStatisticsPage\(\)[^]*this\.flow\.cancelMenu\(\)/);
});

test('statistics content is a shell page and does not introduce a scrolling modal', () => {
  assert.doesNotMatch(pageSource, /meta-modal|backdrop/);
  assert.match(stylesSource, /\.app-shell-surface\s*\{[^}]*overflow\s*:\s*hidden/s);
  assert.doesNotMatch(stylesSource, /\.main-shell-statistics[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
