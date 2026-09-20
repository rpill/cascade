import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const copy = readFileSync('src/platform/PlatformCopy.ts', 'utf8');
const scene = readFileSync('src/ui/scenes/LeaderboardsScene.ts', 'utf8');
const legacyLeaderboard = readFileSync('src/game/view/LeaderboardView.ts', 'utf8');
const statistics = readFileSync('src/game/view/StatisticsPageView.ts', 'utf8');
const english = readFileSync('src/localization/English.ts', 'utf8');

test('platform-specific leaderboard auth copy is centralized for Yandex and Pikabu', () => {
  assert.match(copy, /VITE_PLATFORM_TARGET/);
  assert.match(copy, /Войдите в аккаунт Пикабу, чтобы сохранить рекорд и увидеть своё место в таблице\./);
  assert.match(copy, /Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице\./);
  assert.match(copy, /Войдите в аккаунт Пикабу, чтобы сохранить результат и увидеть своё место в таблице\./);
  assert.match(copy, /Войдите с Яндекс ID, чтобы сохранить результат и увидеть своё место в таблице\./);

  for (const source of [scene, legacyLeaderboard, statistics]) {
    assert.match(source, /getLeaderboardAuthCopy/);
    assert.doesNotMatch(source, /Войдите с Яндекс ID/);
    assert.doesNotMatch(source, /Войдите в аккаунт Пикабу/);
  }
});

test('Pikabu leaderboard auth copy has natural English translations', () => {
  assert.match(
    english,
    /'Войдите в аккаунт Пикабу, чтобы сохранить рекорд и увидеть своё место в таблице\.': 'Sign in with your Pikabu account to save your best time and see your rank\.'/,
  );
  assert.match(
    english,
    /'Войдите в аккаунт Пикабу, чтобы сохранить результат и увидеть своё место в таблице\.': 'Sign in with your Pikabu account to save your result and see your rank\.'/,
  );
});
