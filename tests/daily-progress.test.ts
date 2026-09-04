import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import {
  beginDailyAttempt,
  completeDailyAttempt,
  getWeeklyProgress,
} from '../src/meta/DailyProgress.ts';

test('starting attempts increments only that Daily record', () => {
  const state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  const next = beginDailyAttempt(state, '2026-09-04', '2026-W36');

  assert.equal(next.daily.records['2026-09-04'].attempts, 2);
  assert.equal(next.daily.records['2026-09-04'].completed, false);
});

test('first completion records best time and counts the Daily once in the week', () => {
  const state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  const result = completeDailyAttempt(state, '2026-09-04', '2026-W36', 12_000);

  assert.equal(result.firstCompletion, true);
  assert.equal(result.improvedBest, true);
  assert.equal(result.bestTimeMs, 12_000);
  assert.deepEqual(result.state.weekly.completedDailyIds, ['2026-09-04']);
});

test('replaying a completed Daily only replaces a faster personal best', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  state = completeDailyAttempt(state, '2026-09-04', '2026-W36', 12_000).state;
  state = beginDailyAttempt(state, '2026-09-04', '2026-W36');

  const slower = completeDailyAttempt(state, '2026-09-04', '2026-W36', 15_000);
  const faster = completeDailyAttempt(slower.state, '2026-09-04', '2026-W36', 9_000);

  assert.equal(slower.bestTimeMs, 12_000);
  assert.equal(slower.improvedBest, false);
  assert.equal(faster.bestTimeMs, 9_000);
  assert.equal(faster.improvedBest, true);
  assert.equal(faster.state.weekly.completedDailyIds.length, 1);
});

test('weekly progress resets to the new ISO week without deleting Daily history', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-06', '2026-W36');
  state = completeDailyAttempt(state, '2026-09-06', '2026-W36', 10_000).state;
  state = beginDailyAttempt(state, '2026-09-07', '2026-W37');

  assert.equal(state.weekly.weekId, '2026-W37');
  assert.deepEqual(state.weekly.completedDailyIds, []);
  assert.equal(state.daily.records['2026-09-06'].completed, true);
});

test('3 5 and 7 completions are reported once as newly reached milestones', () => {
  let state = createDefaultMetaSave();
  let latest: readonly number[] = [];

  for (let day = 1; day <= 7; day += 1) {
    const id = `2026-09-0${day}`;
    state = beginDailyAttempt(state, id, '2026-W36');
    const result = completeDailyAttempt(state, id, '2026-W36', 10_000);
    state = result.state;
    latest = result.newlyReachedMilestones;
    if (day === 3) assert.deepEqual(latest, [3]);
    if (day === 5) assert.deepEqual(latest, [5]);
    if (day === 7) assert.deepEqual(latest, [7]);
  }

  assert.equal(getWeeklyProgress(state, '2026-W36').completed, 7);
  assert.deepEqual(state.weekly.claimedMilestones, []);
});
