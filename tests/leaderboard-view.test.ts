import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/LeaderboardView.ts', import.meta.url),
  'utf8',
);

test('leaderboard overlay exposes tabs guest CTA personal result and close actions', () => {
  assert.match(source, /ТАБЛИЦА ЛИДЕРОВ/);
  assert.match(source, /СТАНДАРТ/);
  assert.match(source, /КЛАССИКА/);
  assert.match(source, /Ваш результат/);
  assert.match(source, /ВОЙТИ/);
  assert.match(source, /actions\.authorize\(\)/);
  assert.match(source, /actions\.selectMode\('winnable'\)/);
  assert.match(source, /actions\.selectMode\('original'\)/);
  assert.match(source, /ЗАКРЫТЬ/);
  assert.match(source, /actions\.close\(\)/);
});

test('leaderboard overlay renders statuses, formatted rows, and no avatars', () => {
  assert.match(source, /Загрузка…/);
  assert.match(source, /Пока нет результатов/);
  assert.match(source, /Таблица лидеров временно недоступна/);
  assert.match(source, /formatDuration/);
  assert.match(source, /leaderboard-name/);
  assert.match(source, /entry\.rank/);
  assert.match(source, /entry\.publicName/);
  assert.match(source, /entry\.value/);
  assert.doesNotMatch(source, /avatar/i);
});

test('leaderboard overlay keeps public browsing while controlling authorization state', () => {
  assert.match(source, /authorizationAllowed/);
  assert.match(source, /authPending/);
  assert.match(source, /Вход…/);
  assert.match(source, /Завершите текущую партию, чтобы войти и сохранить рекорд\./);
  assert.match(source, /Войдите с Яндекс ID, чтобы сохранить рекорд/);
  assert.match(source, /пока нет результата/);
  assert.match(source, /disabled/);
});

test('leaderboard overlay is a passive native DOM view', () => {
  assert.match(source, /document\.createElement/);
  assert.match(source, /canvas\.parentElement/);
  assert.match(source, /append\(this\.root\)/);
  assert.match(source, /show\(state: LeaderboardViewState\): void/);
  assert.match(source, /update\(state: LeaderboardViewState\): void/);
  assert.match(source, /hide\(\): void/);
  assert.match(source, /destroy\(\): void/);
  assert.doesNotMatch(source, /PlatformServices|Yandex|MetaRepository/);
});

test('leaderboard overlay can show a non-fatal auth message without replacing ready rows', () => {
  assert.match(source, /state\.message !== undefined/);
  assert.match(source, /this\.localization\.text\(this\.authCopy, \(\) => t\(state\.message \?\? ''\)\)/);
});
