import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/game/view/StatisticsPageView.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('Statistics page exposes Game and Daily with their competitive views', () => {
  assert.match(view, /createModeTab\('ИГРА', 'winnable'\)/);
  assert.match(view, /createModeTab\('ЕЖЕДНЕВНЫЕ', 'daily'\)/);
  assert.doesNotMatch(view, /createModeTab\('КЛАССИКА'|createModeTab\('СТАНДАРТ'/);
  assert.match(view, /ЛУЧШИЕ СЕРИИ/);
  assert.match(view, /СЕГОДНЯШНИЙ РЕЙТИНГ/);
  assert.match(view, /Лучшая серия/);
});

test('GameScene submits Daily result, Daily streak, and Mastery while Standard streak stays local', () => {
  assert.match(scene, /syncDailyBest/);
  assert.match(scene, /syncDailyStreak/);
  assert.match(scene, /syncMasteryScore/);
  assert.doesNotMatch(scene, /syncStandardStreak/);
  assert.doesNotMatch(scene, /classicbesttime/);
});
