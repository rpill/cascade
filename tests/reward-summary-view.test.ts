import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/view/RewardSummaryView.ts', import.meta.url), 'utf8');

test('reward summary exposes only coin, mastery and persistence state with no XP or Level', () => {
  assert.match(source, /readonly coins: number/);
  assert.match(source, /readonly lines: readonly RewardSummaryLine\[\]/);
  assert.match(source, /rankAdvancedTo\?: MasteryRank/);
  assert.match(source, /pending\?: boolean/);
  assert.match(source, /themePurchaseUnlocked\?: boolean/);
  assert.doesNotMatch(source, /readonly xp:/);
  assert.doesNotMatch(source, /readonly level:/);
});
