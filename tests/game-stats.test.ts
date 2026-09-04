import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import {
  beginModeAttempt,
  completeModeAttempt,
  getModeStats,
  type OrdinaryGameMode,
} from '../src/meta/GameStats.ts';

type DailyIsExcluded = Extract<'daily', OrdinaryGameMode> extends never ? true : false;
const dailyIsExcluded: DailyIsExcluded = true;
void dailyIsExcluded;

test('starting an ordinary attempt increments only the selected mode played count', () => {
  const initial = createDefaultMetaSave();
  const next = beginModeAttempt(initial, 'winnable');

  assert.deepEqual(getModeStats(next, 'winnable'), { played: 1, wins: 0 });
  assert.deepEqual(getModeStats(next, 'original'), { played: 0, wins: 0 });
  assert.deepEqual(initial.stats.winnable, { played: 0, wins: 0 });
});

test('first completed attempt records a win and best time', () => {
  let state = createDefaultMetaSave();
  state = beginModeAttempt(state, 'winnable');

  const result = completeModeAttempt(state, 'winnable', 5_000);

  assert.deepEqual(result.stats, { played: 1, wins: 1, bestTimeMs: 5_000 });
  assert.equal(result.improvedBest, true);
  assert.deepEqual(getModeStats(result.state, 'winnable'), result.stats);
});

test('slower wins preserve best time while faster wins replace it', () => {
  let state = beginModeAttempt(createDefaultMetaSave(), 'original');
  state = completeModeAttempt(state, 'original', 5_000).state;

  state = beginModeAttempt(state, 'original');
  const slower = completeModeAttempt(state, 'original', 7_000);
  assert.deepEqual(slower.stats, { played: 2, wins: 2, bestTimeMs: 5_000 });
  assert.equal(slower.improvedBest, false);

  state = beginModeAttempt(slower.state, 'original');
  const faster = completeModeAttempt(state, 'original', 3_500);
  assert.deepEqual(faster.stats, { played: 3, wins: 3, bestTimeMs: 3_500 });
  assert.equal(faster.improvedBest, true);
});

test('completion requires a begun unfinished attempt', () => {
  const empty = createDefaultMetaSave();
  assert.throws(
    () => completeModeAttempt(empty, 'original', 1_000),
    /begin an attempt/i,
  );

  let completed = beginModeAttempt(empty, 'original');
  completed = completeModeAttempt(completed, 'original', 1_000).state;
  assert.throws(
    () => completeModeAttempt(completed, 'original', 900),
    /begin an attempt/i,
  );
});

test('completion rejects non-positive and non-finite elapsed times', () => {
  const state = beginModeAttempt(createDefaultMetaSave(), 'winnable');

  assert.throws(() => completeModeAttempt(state, 'winnable', 0), /positive/i);
  assert.throws(() => completeModeAttempt(state, 'winnable', -1), /positive/i);
  assert.throws(() => completeModeAttempt(state, 'winnable', Number.NaN), /positive/i);
  assert.throws(
    () => completeModeAttempt(state, 'winnable', Number.POSITIVE_INFINITY),
    /positive/i,
  );
});
