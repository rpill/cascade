import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const viewUrl = new URL('../src/game/view/StatisticsPageView.ts', import.meta.url);
const source = existsSync(viewUrl) ? readFileSync(viewUrl, 'utf8') : '';

const styles = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('statistics page combines mode stats and leaderboard inside the shell', () => {
  assert.ok(source.length > 0, 'StatisticsPageView.ts must exist');
  assert.match(source, /export class StatisticsPageView/);
  assert.match(source, /constructor\(host: HTMLElement, actions: StatisticsPageActions\)/);
  assert.match(source, /ИГРА/);
  assert.match(source, /ЕЖЕДНЕВНЫЕ/);
  assert.doesNotMatch(source, /createModeTab\('СТАНДАРТ'|createModeTab\('КЛАССИКА'/);
  assert.match(source, /Сыграно/);
  assert.match(source, /Побед/);
  assert.match(source, /Процент побед/);
  assert.match(source, /Лучшее время/);
  assert.match(source, /ЛУЧШИЕ СЕРИИ/);
  assert.match(source, /СЕГОДНЯШНИЙ РЕЙТИНГ/);
  assert.doesNotMatch(source, /meta-modal|backdrop/);
});

test('statistics page owns leaderboard ready, empty, unavailable, error and identity states', () => {
  assert.match(source, /status === 'loading'/);
  assert.match(source, /status === 'unavailable'/);
  assert.match(source, /status === 'error'/);
  assert.match(source, /entries\.length === 0/);
  assert.match(source, /Войдите с Яндекс ID/);
  assert.match(source, /Завершите текущую партию/);
  assert.match(source, /Ваш результат/);
});

test('statistics page is a two-column shell layout with a compact landscape fallback', () => {
  assert.match(styles, /\.main-shell-statistics\s*\{/);
  assert.match(styles, /grid-template-columns:\s*minmax\([^;]+\)\s+minmax\([^;]+\)/);
  assert.match(styles, /\.main-shell-statistics-summary/);
  assert.match(styles, /\.main-shell-statistics-leaderboard/);
  assert.match(styles, /@media \(max-height: 560px\)[\s\S]*\.main-shell-statistics/);
  assert.doesNotMatch(styles, /\.main-shell-statistics[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
