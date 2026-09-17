import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('ordinary completion records meta and sends only result plus mastery to the victory UI', () => {
  assert.match(scene, /const recorded = this\.dispatchMeta\(event\)/);
  assert.match(scene, /this\.gameCompleteView\.show\(/);
  assert.match(scene, /mastery:\s*completion\.mastery/);
  assert.doesNotMatch(scene, /completeRewardedAttempt|themePurchaseUnlocked|coins|totalXpBefore/);
});
