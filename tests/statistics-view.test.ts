import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/StatisticsView.ts', import.meta.url),
  'utf8',
);

test('statistics modal renders both ordinary modes and derived values', () => {
  assert.match(source, /СТАТИСТИКА/);
  assert.match(source, /СТАНДАРТ/);
  assert.match(source, /КЛАССИКА/);
  assert.match(source, /Партий:/);
  assert.match(source, /Побед:/);
  assert.match(source, /Процент побед:/);
  assert.match(source, /Лучшее время:/);
  assert.match(source, /Math\.round\([^]*wins[^]*played[^]*100/);
  assert.match(source, /played === 0 \? 0/);
  assert.match(source, /bestTimeMs === null \? '—'/);
});

test('statistics modal is a passive DOM view with an explicit close action', () => {
  assert.match(source, /document\.createElement/);
  assert.match(source, /canvas\.parentElement/);
  assert.match(source, /append\(this\.root\)/);
  assert.match(source, /ЗАКРЫТЬ/);
  assert.match(source, /actions\.close\(\)/);
  assert.match(source, /show\(state: StatisticsViewState\): void/);
  assert.match(source, /update\(state: StatisticsViewState\): void/);
  assert.match(source, /hide\(\): void/);
  assert.match(source, /destroy\(\): void/);
  assert.doesNotMatch(source, /MetaRepository|PlatformServices|Yandex|leaderboards/);
});
