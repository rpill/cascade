import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { beginDailyAttempt } from '../src/meta/DailyProgress.ts';
import { settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';

test('on-time Daily first completion marks completedOnTime and advances novice mastery', () => {
  const started = beginDailyAttempt(createDefaultMetaSave(), '2026-09-16', '2026-W38');
  const result = settleDailyWin(started, {
    dailyId: '2026-09-16', weekId: '2026-W38', completionDateId: '2026-09-16', elapsedMs: 60_000,
  });
  assert.equal(result.firstCompletion, true);
  assert.equal(result.completedOnTime, true);
  assert.equal(result.state.daily.records['2026-09-16']?.completedOnTime, true);
  assert.equal(result.state.mastery.stage.anyWins, 1);
  assert.equal(result.state.mastery.stage.onTimeDailyWins, 0);
});

test('archived Daily first completion does not advance on-time mastery', () => {
  const started = beginDailyAttempt(createDefaultMetaSave(), '2026-09-15', '2026-W38');
  const result = settleDailyWin(started, {
    dailyId: '2026-09-15', weekId: '2026-W38', completionDateId: '2026-09-16', elapsedMs: 60_000,
  });
  assert.equal(result.firstCompletion, true);
  assert.equal(result.completedOnTime, false);
  assert.equal(result.state.mastery.stage.anyWins, 0);
});

test('Daily replay improves best time without duplicating first-completion mastery', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-16', '2026-W38');
  state = settleDailyWin(state, {
    dailyId: '2026-09-16', weekId: '2026-W38', completionDateId: '2026-09-16', elapsedMs: 60_000,
  }).state;
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38');
  const replay = settleDailyWin(state, {
    dailyId: '2026-09-16', weekId: '2026-W38', completionDateId: '2026-09-16', elapsedMs: 50_000,
  });
  assert.equal(replay.firstCompletion, false);
  assert.equal(replay.state.mastery.stage.anyWins, 1);
  assert.equal(replay.state.mastery.stage.onTimeDailyWins, 0);
  assert.equal(replay.state.daily.records['2026-09-16']?.bestTimeMs, 50_000);
});
