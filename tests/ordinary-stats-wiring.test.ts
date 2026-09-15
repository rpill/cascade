import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('ordinary completion keeps statistics in meta while victory UI receives only result and product rewards', () => {
  assert.match(scene, /completeRewardedAttempt\(this\.metaState,event\)/);
  assert.match(scene, /const recorded=this\.dispatchMeta\(event\)/);
  assert.match(scene, /this\.gameCompleteView\.show\(/);
  assert.match(scene, /themePurchaseUnlocked/);
  assert.doesNotMatch(scene, /totalXpBefore/);
});
