import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('ordinary completion captures pre-reward XP and sends only celebratory data to the view', () => {
  assert.match(source, /totalXpBefore/);
  assert.match(source, /totalXpBefore:\s*completion\.totalXpBefore/);
  assert.match(source, /completionId:\s*completion\.event\.attemptId/);
  const showCall = source.match(/this\.gameCompleteView\.show\(\{[^]*?\n\s*\}\);/)?.[0] ?? '';
  assert.doesNotMatch(showCall, /wins:/);
  assert.doesNotMatch(showCall, /played:/);
  assert.doesNotMatch(showCall, /bestTimeMs:/);
});
