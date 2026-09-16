import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';

test('Daily HUD shows first-completion reward instead of wallet balance', () => {
  const available = buildGameHudViewModel({
    moves: 0, activeMs: 0, canUndo: false, coins: 110,
    hintEligible: true, hintRemaining: 1, newDealEnabled: false,
    newDealVisible: false, rewardCoins: 15, rewardClaimed: false,
  }, 'ru');
  const claimed = buildGameHudViewModel({
    moves: 0, activeMs: 0, canUndo: false, coins: 110,
    hintEligible: true, hintRemaining: 0, newDealEnabled: false,
    newDealVisible: false, rewardCoins: 15, rewardClaimed: true,
  }, 'ru');

  assert.equal(available.coinLabel, '+15');
  assert.equal(claimed.coinLabel, 'Получено');
  assert.equal(available.newDealVisible, false);
});

test('Daily HUD removes New Deal slot and shifts Restart upward', () => {
  const viewport = calculateViewportLayout(1728, 864);
  const ordinary = calculateGameHudLayout(viewport, true);
  const daily = calculateGameHudLayout(viewport, false);
  assert.equal(daily.restart.y, ordinary.newDeal.y);
  assert.ok(daily.restart.y < ordinary.restart.y);
  assert.ok(daily.settings.y < ordinary.settings.y);
  assert.ok(daily.metrics.y < ordinary.metrics.y);
});

test('GameScene derives Daily reward once from Daily context and never exposes New Deal there', () => {
  const source = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  assert.match(source, /firstCompletionCoins/);
  assert.match(source, /newDealVisible:\s*mode\s*!==\s*'daily'/);
  assert.match(source, /rewardCoins:\s*dailyRewardCoins \?\? standardRewardCoins/);
  assert.match(source, /standardRewardClaimed/);
  assert.match(hud, /setButtonVisible\(this\.buttons\.newDeal, this\.viewModel\.newDealVisible\)/);
});


test('Standard HUD shows per-deal reward instead of wallet balance', () => {
  const easy = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, coins: 110, hintEligible: false, newDealEnabled: true, difficulty: 'easy', rewardCoins: 5 }, 'ru');
  const medium = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, coins: 110, hintEligible: false, newDealEnabled: true, difficulty: 'medium', rewardCoins: 7 }, 'ru');
  const hardClaimed = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, coins: 110, hintEligible: false, newDealEnabled: true, difficulty: 'hard', rewardCoins: 10, rewardClaimed: true }, 'ru');
  assert.equal(easy.coinLabel, '+5');
  assert.equal(medium.coinLabel, '+7');
  assert.equal(hardClaimed.coinLabel, 'Получено');
});

test('HUD reward row is centered as one inline group with icon and value', () => {
  const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  assert.match(hud, /coinsText = scene\.add\.text\(0, 0, '', \{ \.\.\.textStyle, fontStyle: 'bold' \}\)\.setOrigin\(0\.5\)/);
  assert.match(hud, /const rewardWidth = coinSize \+ coinGap \+ this\.coinsText\.width/);
  assert.match(hud, /const rewardLeft = centerX - rewardWidth \/ 2/);
  assert.match(hud, /this\.coinsText\.setPosition\(rewardLeft \+ coinSize \+ coinGap \+ this\.coinsText\.width \/ 2, rewardY\)/);
});
