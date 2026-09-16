import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';

test('Daily HUD exposes the single official hint quota', () => {
  const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  const available = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, coins: 0, hintEligible: true, hintRemaining: 1, newDealEnabled: false }, 'ru');
  const spent = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, coins: 0, hintEligible: true, hintRemaining: 0, newDealEnabled: false }, 'ru');
  assert.equal(available.hintLabel, 'Подсказка 1/1');
  assert.equal(available.hintEnabled, true);
  assert.equal(spent.hintLabel, 'Подсказка 0/1');
  assert.equal(spent.hintEnabled, false);
  assert.match(scene, /daily-hint-used/);
});

test('Daily replay UI tells the player that leaderboard position will not change', () => {
  const daily = readFileSync('src/ui/scenes/DailyScene.ts', 'utf8');
  assert.match(daily, /Без изменения рейтинга/);
  assert.match(daily, /Первая попытка идёт в рейтинг/);
});

test('Daily page reflects whether the one official hint has already been spent', () => {
  const daily = readFileSync('src/ui/scenes/DailyScene.ts', 'utf8');
  assert.match(daily, /record\?\.hintUsed\s*\?\s*0\s*:\s*1/);
});

test('restarting the active ranked Daily attempt asks for explicit confirmation', () => {
  const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  const confirm = readFileSync('src/ui/game/NewDealConfirmOverlay.ts', 'utf8');
  assert.match(scene, /daily-ranking-restart/);
  assert.match(confirm, /Рейтинговая попытка/);
});
