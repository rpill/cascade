import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/ui/scenes/LeaderboardsScene.ts', 'utf8');
const english = readFileSync('src/localization/English.ts', 'utf8');

test('leaderboard guest auth copy follows the selected platform target', () => {
  assert.match(scene, /VITE_PLATFORM_TARGET/);
  assert.match(scene, /Войдите в аккаунт Пикабу, чтобы сохранить рекорд и увидеть своё место в таблице\./);
  assert.match(scene, /Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице\./);
  assert.match(scene, /t\(LEADERBOARD_AUTH_SUBTITLE\)/);
});

test('Pikabu leaderboard auth copy has an English translation', () => {
  assert.match(
    english,
    /'Войдите в аккаунт Пикабу, чтобы сохранить рекорд и увидеть своё место в таблице\.': 'Sign in to Pikabu to save your best time and see your rank\.'/,
  );
});
