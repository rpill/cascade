import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/RewardSummaryView.ts', import.meta.url),
  'utf8',
);

test('reward summary presents totals, level, itemized lines and pending state', () => {
  assert.match(source, /readonly xp: number/);
  assert.match(source, /readonly coins: number/);
  assert.match(source, /readonly level: number/);
  assert.match(source, /readonly lines: readonly RewardSummaryLine\[\]/);
  assert.match(source, /pending\?: boolean/);
  assert.match(source, /Награды начисляются/);
  assert.match(source, /Без повторной награды/);
});
