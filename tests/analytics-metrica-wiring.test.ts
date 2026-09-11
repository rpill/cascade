import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const metricaSource = readFileSync(new URL('../src/analytics/YandexMetrica.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('Metrica loader uses the configured Cascade counter without Webvisor', () => {
  assert.match(metricaSource, /112502032/);
  assert.match(metricaSource, /https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=/);
  assert.match(metricaSource, /webvisor:\s*false/);
  assert.match(metricaSource, /clickmap:\s*true/);
  assert.match(metricaSource, /trackLinks:\s*true/);
  assert.match(metricaSource, /accurateTrackBounce:\s*true/);
});

test('Metrica transport uses reachGoal for configured conversions and params for other events', () => {
  assert.match(metricaSource, /['"]reachGoal['"]/);
  assert.match(metricaSource, /['"]params['"]/);
  assert.match(metricaSource, /cascade_event/);
});

test('main initializes analytics before Phaser starts', () => {
  assert.match(mainSource, /initializeYandexMetrica\(\)/);
  assert.ok(mainSource.indexOf('initializeYandexMetrica()') < mainSource.indexOf('startWhenHostReady('));
});
