import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const menuSource = readFileSync(
  new URL('../src/game/view/MainMenuView.ts', import.meta.url),
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

test('menu renders local ordinary stats independently of leaderboard availability', () => {
  assert.match(menuSource, /СТАТИСТИКА/);
  assert.match(menuSource, /СТАНДАРТ/);
  assert.match(menuSource, /КЛАССИКА/);
  assert.match(menuSource, /Лучшее время:/);
  assert.match(menuSource, /Math\.round\([^]*wins[^]*played[^]*100/);
  assert.match(menuSource, /played === 0[^]*0/);
  assert.match(menuSource, /bestTimeMs === null[^]*—/);
  assert.match(menuSource, /ТАБЛИЦА ЛИДЕРОВ/);
});

test('menu exposes a leaderboard action but keeps the button disabled when unavailable', () => {
  assert.match(menuSource, /readonly leaderboard:\s*\(\) => void/);
  assert.match(menuSource, /actions\.leaderboard\(\)/);
  assert.match(menuSource, /leaderboardsAvailable/);
  assert.match(menuSource, /disabled = !state\.leaderboardsAvailable/);
  assert.match(menuSource, /classList\.toggle\(['"]is-disabled['"], !state\.leaderboardsAvailable\)/);
});

test('scene supplies ordinary stats and leaderboard availability through refreshMenuMeta', () => {
  assert.match(sceneSource, /LeaderboardService/);
  assert.match(sceneSource, /private leaderboardService: LeaderboardService \| null = null/);
  assert.match(sceneSource, /private buildOrdinaryMenuState\(\): OrdinaryMenuState/);
  assert.match(sceneSource, /const \{ winnable, original \} = this\.metaState\.stats/);
  assert.match(sceneSource, /leaderboardsAvailable: this\.leaderboardService\?\.available \?\? false/);
  assert.match(
    sceneSource,
    /refreshMenuMeta\(\): void \{[^]*updateDailyState\(this\.buildDailyMenuState\(\)\)[^]*updateOrdinaryState\(this\.buildOrdinaryMenuState\(\)\)/,
  );
});

test('ordinary stats refresh after attempts begin and after ordinary completion', () => {
  assert.match(sceneSource, /beginModeAttempt\(state, mode\)[^]*refreshMenuMeta\(\)/);
  assert.match(sceneSource, /finishOrdinaryAttempt[^]*completeModeAttempt[^]*refreshMenuMeta\(\)/);
});

test('statistics styles preserve the existing scrollable menu geometry', () => {
  assert.match(stylesSource, /\.main-menu-stats/);
  assert.match(stylesSource, /\.main-menu-stats-title/);
  assert.match(stylesSource, /\.main-menu-stat-mode/);
  assert.match(stylesSource, /\.main-menu-stat-line/);
  assert.match(stylesSource, /\.main-menu-leaderboard/);
  assert.match(stylesSource, /overflow:\s*auto/);
});
