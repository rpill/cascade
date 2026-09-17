import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('ordinary completion sends mastery state to the shared victory overlay with no XP or currency model', () => {
  assert.match(source, /completionId:\s*completion\.event\.attemptId/);
  assert.doesNotMatch(source, /getReward|rewardCoins|coin/i);
  assert.doesNotMatch(source, /totalXpBefore/);
  const showCall = source.match(/this\.gameCompleteView\.show\(\{[^]*?\n\s*\}\);/)?.[0] ?? '';
  assert.doesNotMatch(showCall, /wins:/);
  assert.doesNotMatch(showCall, /played:/);
});
