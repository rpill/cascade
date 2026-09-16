import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overlay = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');
const view = readFileSync('src/game/view/GameCompleteView.ts', 'utf8');
const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

test('victory screen has separate Rewards and Mastery panels in the shared landscape overlay', () => {
  assert.match(overlay, /rewardPanel/);
  assert.match(overlay, /masteryPanel/);
  assert.match(overlay, /rewardPanelBounds/);
  assert.match(overlay, /masteryPanelBounds/);
  assert.match(view, /Всего получено/);
});

test('ordinary completion includes moves and x2 bonus amount in presentation state', () => {
  assert.match(view, /readonly moves: number/);
  assert.match(view, /rewardDoubleBonusCoins/);
  assert.match(scene, /УДВОИТЬ \+\{count\}/);
  assert.match(scene, /moves: completion\.moves/);
  assert.match(scene, /rewardDoubleBonusCoins: offer\?\.bonusCoins/);
});
