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

test('GameScene submits Standard best streak and current Daily best but never Classic time', () => {
  assert.match(scene, /syncStandardStreak/);
  assert.match(scene, /syncDailyBest/);
  assert.doesNotMatch(scene, /syncBest\('original'/);
  assert.doesNotMatch(scene, /classicbesttime/);
});
