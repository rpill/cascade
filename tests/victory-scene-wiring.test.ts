import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('ordinary completion sends coin/mastery reward state to the shared victory overlay with no XP model', () => {
  assert.match(source, /completionId:\s*completion\.event\.attemptId/);
  assert.match(source, /reward:\{\.\.\.\(this\.metaSession\.getReward/);
  assert.doesNotMatch(source, /totalXpBefore/);
  const showCall = source.match(/this\.gameCompleteView\.show\(\{[^]*?\n\s*\}\);/)?.[0] ?? '';
  assert.doesNotMatch(showCall, /wins:/);
  assert.doesNotMatch(showCall, /played:/);
});
