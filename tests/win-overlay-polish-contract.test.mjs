import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('win overlay includes coin icon support and keeps a visible claimed x2 state', () => {
  const overlay = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');
  assert.match(overlay, /rewardIcon/);
  assert.match(overlay, /UI_ICON_KEYS\.coin/);
  assert.match(overlay, /rewardActionLabel !== null/);
});

test('completion views label time and Daily moves explicitly', () => {
  const game = readFileSync('src/game/view/GameCompleteView.ts', 'utf8');
  const daily = readFileSync('src/game/view/DailyCompleteView.ts', 'utf8');
  assert.match(game, /Время: \{value0\}/);
  assert.match(daily, /Ходы: \{value0\}/);
});

test('game scene surfaces a claimed double-reward state back into the completion popup', () => {
  const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  assert.match(scene, /claimedRewardDouble/);
  assert.match(scene, /ПОЛУЧЕНО ×2/);
});
