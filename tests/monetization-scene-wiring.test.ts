import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('GameScene wires monetization controller and gates fresh Standard deals without hiding New Deal', () => {
  assert.match(sceneSource, /new MonetizationController/);
  assert.match(sceneSource, /await this\.monetizationController\.initialize\(\)/);
  assert.match(sceneSource, /beforeFreshStandardDeal/);
  assert.match(sceneSource, /newDealConfirmView\.confirm/);
  assert.match(sceneSource, /freshDealTransitionInFlight/);
  assert.match(sceneSource, /currentDeal\.mode === 'winnable'/);
  assert.match(sceneSource, /newDeal: \(\) => this\.startNewDeal\(\)/);
});

test('Daily retry remains a same-deal restart and never enters the interstitial path', () => {
  const retryDaily = sceneSource.match(/private retryDaily\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
  assert.match(retryDaily, /this\.restartDeal\(\)/);
  assert.doesNotMatch(retryDaily, /beforeFreshStandardDeal|requestFreshDeal/);
});
