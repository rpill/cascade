import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const menuSource = readFileSync(
  new URL('../src/game/view/MainMenuView.ts', import.meta.url),
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

test('main menu keeps statistics and leaderboards as compact secondary actions', () => {
  assert.match(menuSource, /СТАТИСТИКА/);
  assert.match(menuSource, /ТАБЛИЦА ЛИДЕРОВ/);
  assert.match(menuSource, /readonly statistics:\s*\(\) => void/);
  assert.match(menuSource, /actions\.statistics\(\)/);
  assert.match(menuSource, /actions\.leaderboard\(\)/);
  assert.match(menuSource, /main-menu-meta-actions/);
  assert.doesNotMatch(menuSource, /Лучшее время:/);
  assert.doesNotMatch(menuSource, /main-menu-stat-mode/);
  assert.doesNotMatch(menuSource, /statSummaries|statBests/);
});

test('leaderboard action stays disabled until leaderboard service is available', () => {
  assert.match(menuSource, /updateLeaderboardsAvailable\(available: boolean\)/);
  assert.match(menuSource, /disabled = !available/);
  assert.match(menuSource, /classList\.toggle\(['"]is-disabled['"], !available\)/);
});

test('scene owns a separate statistics modal backed by MetaSave V2 stats', () => {
  assert.match(sceneSource, /StatisticsView/);
  assert.match(sceneSource, /private statisticsView!: StatisticsView/);
  assert.match(sceneSource, /private statisticsOpen = false/);
  assert.match(sceneSource, /statistics: \(\) => this\.openStatistics\(\)/);
  assert.match(sceneSource, /private buildStatisticsViewState\(\): StatisticsViewState/);
  assert.match(sceneSource, /const \{ winnable, original \} = this\.metaState\.stats/);
  assert.match(sceneSource, /private openStatistics\(\): void/);
  assert.match(sceneSource, /this\.statisticsView\.show\(this\.buildStatisticsViewState\(\)\)/);
  assert.match(sceneSource, /private closeStatistics\(\): void/);
  assert.match(sceneSource, /this\.statisticsView\.hide\(\)/);
});

test('meta refresh keeps the statistics modal current without putting stats back into the menu', () => {
  assert.match(
    sceneSource,
    /refreshMenuMeta\(\): void \{[^]*updateDailyState\(this\.buildDailyMenuState\(\)\)[^]*updateLeaderboardsAvailable\([^]*statisticsView\.update\(this\.buildStatisticsViewState\(\)\)/,
  );
  assert.doesNotMatch(sceneSource, /updateOrdinaryState\(/);
});

test('Escape closes statistics before it can cancel the underlying menu', () => {
  assert.match(sceneSource, /private handleEscape = \(\): void =>/);
  assert.match(sceneSource, /if \(this\.statisticsOpen\)[^]*this\.closeStatistics\(\)[^]*return/);
  assert.match(sceneSource, /this\.closeMainMenu\(\)/);
  assert.match(sceneSource, /keydown-ESC['"], this\.handleEscape/);
});

test('menu and reusable modal shell explicitly forbid scroll containers', () => {
  assert.doesNotMatch(
    stylesSource,
    /\.main-menu-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s,
  );
  assert.match(stylesSource, /\.main-menu-panel\s*\{[^}]*overflow\s*:\s*hidden/s);
  assert.match(stylesSource, /\.meta-modal-panel\s*\{[^}]*overflow\s*:\s*hidden/s);
  assert.doesNotMatch(
    stylesSource,
    /\.meta-modal-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s,
  );
  assert.match(statisticsSource, /meta-modal-panel/);
});
