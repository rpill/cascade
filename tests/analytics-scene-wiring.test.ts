import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('GameScene uses the shared analytics service and never calls Metrica directly', () => {
  assert.match(sceneSource, /import \{ analytics \} from '\.\.\/\.\.\/analytics\/AnalyticsService\.ts'/);
  assert.doesNotMatch(sceneSource, /\bym\s*\(/);
});

test('attempt lifecycle emits start, win, daily conversion, abandon and fresh-deal events', () => {
  assert.match(sceneSource, /analytics\.event\('game_start'/);
  assert.match(sceneSource, /analytics\.event\('daily_start'/);
  assert.match(sceneSource, /analytics\.goal\('game_win'/);
  assert.match(sceneSource, /analytics\.goal\('daily_complete'/);
  assert.match(sceneSource, /analytics\.event\('game_abandon'/);
  assert.match(sceneSource, /analytics\.event\('new_deal'/);
});

test('first-run onboarding emits tutorial start and completion conversion', () => {
  assert.match(sceneSource, /analytics\.event\('tutorial_start'/);
  assert.match(sceneSource, /analytics\.goal\('tutorial_complete'/);
});

test('removed cosmetic economy no longer emits shop or purchase analytics', () => {
  assert.doesNotMatch(sceneSource, /shop_open|theme_buy|theme_equip|iap_success|rewarded/);
});
