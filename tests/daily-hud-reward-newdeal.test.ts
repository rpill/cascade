import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';

test('Daily HUD has no currency or completion-reward row', () => {
  const view = buildGameHudViewModel({
    moves: 0, activeMs: 0, canUndo: false,
    hintEligible: true, hintRemaining: 1, newDealEnabled: false,
    newDealVisible: false,
  }, 'ru');
  assert.equal(view.newDealVisible, false);
  assert.equal('coinLabel' in view, false);
  assert.equal('rewardCoins' in view, false);
});

test('Daily HUD removes New Deal slot but preserves action-group hierarchy', () => {
  const viewport = calculateViewportLayout(1728, 864);
  const ordinary = calculateGameHudLayout(viewport, true);
  const daily = calculateGameHudLayout(viewport, false);
  assert.equal(daily.restart.y, ordinary.restart.y);
  assert.ok(daily.undo.y < daily.hint.y);
  assert.ok(daily.hint.y < daily.restart.y);
  assert.ok(daily.metrics.y < ordinary.metrics.y);
});

test('GameScene never exposes per-deal currency rewards', () => {
  const source = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  assert.match(source, /newDealVisible:\s*mode\s*!==\s*'daily'/);
  assert.doesNotMatch(source, /rewardCoins|rewardClaimed|firstCompletionCoins|standardReward/);
  assert.doesNotMatch(hud, /coin|rewardCoins|rewardClaimed/);
  assert.match(hud, /setButtonVisible\(this\.buttons\.newDeal, this\.viewModel\.newDealVisible\)/);
});

test('Standard HUD keeps difficulty and actions without a currency field', () => {
  const easy = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, hintEligible: false, newDealEnabled: true, difficulty: 'easy' }, 'ru');
  const hard = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, hintEligible: false, newDealEnabled: true, difficulty: 'hard' }, 'ru');
  assert.equal(easy.difficultyLabel, 'Лёгкая');
  assert.equal(hard.difficultyLabel, 'Сложная');
  assert.equal('coinLabel' in easy, false);
});
