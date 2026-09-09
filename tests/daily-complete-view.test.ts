import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/DailyCompleteView.ts', import.meta.url),
  'utf8',
);

test('Daily completion view shows run time best time weekly progress and retry/menu actions', () => {
  assert.match(source, /DAILY COMPLETE|ИСПЫТАНИЕ ДНЯ/);
  assert.match(source, /bestTimeMs/);
  assert.match(source, /weekCompleted/);
  assert.match(source, /retry/);
  assert.match(source, /menu/);
  assert.match(source, /reward\?: RewardSummaryState/);
  assert.match(source, /RewardSummaryView/);
});
