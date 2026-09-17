import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/view/DailyCompleteView.ts', import.meta.url), 'utf8');

test('Daily completion uses the shared WinOverlay with time, weekly progress, mastery, retry and menu', () => {
  assert.match(source, /WinOverlay/);
  assert.match(source, /bestTimeMs/);
  assert.match(source, /weekCompleted/);
  assert.doesNotMatch(source, /RewardSummaryState|coins|rewarded/i);
  assert.match(source, /mastery\?: VictoryMasteryState/);
  assert.match(source, /newDeal:actions\.retry/);
  assert.match(source, /home:actions\.menu/);
  assert.match(source, /ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО/);
});
