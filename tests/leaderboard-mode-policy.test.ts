import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LEADERBOARD_NAME,
  STANDARD_LEADERBOARD_NAME,
  decodeDailyLeaderboardScore,
  encodeDailyLeaderboardScore,
  hasGlobalLeaderboard,
} from '../src/leaderboards/LeaderboardConfig.ts';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

test('only Standard and Daily have global Yandex leaderboards', () => {
  assert.equal(STANDARD_LEADERBOARD_NAME, 'standardwinstreak');
  assert.equal(DAILY_LEADERBOARD_NAME, 'dailyfastest');
  assert.equal(hasGlobalLeaderboard('winnable'), true);
  assert.equal(hasGlobalLeaderboard('daily'), true);
  assert.equal(hasGlobalLeaderboard('original'), false);
});

test('Daily leaderboard encoding makes newer days outrank older days and faster times outrank slower ones', () => {
  const yesterdayFast = encodeDailyLeaderboardScore('2026-09-09', 60_000);
  const todaySlow = encodeDailyLeaderboardScore('2026-09-10', 600_000);
  const todayFast = encodeDailyLeaderboardScore('2026-09-10', 90_000);

  assert.ok(todaySlow > yesterdayFast);
  assert.ok(todayFast > todaySlow);
  assert.deepEqual(decodeDailyLeaderboardScore(todayFast), {
    dailyId: '2026-09-10',
    elapsedMs: 90_000,
  });
});

test('Standard win streak increments on wins and resets only when an unfinished Standard is replaced', () => {
  let state = createDefaultMetaSave();
  state = applyMetaOperation(state, { kind: 'begin', attemptId: 's~1', mode: 'winnable' });
  state = applyMetaOperation(state, {
    kind: 'complete', attemptId: 's~1', mode: 'winnable', elapsedMs: 1000,
    trustedDay: null, trustedWeek: null,
  });
  state = applyMetaOperation(state, { kind: 'begin', attemptId: 's~2', mode: 'winnable' });
  state = applyMetaOperation(state, {
    kind: 'complete', attemptId: 's~2', mode: 'winnable', elapsedMs: 1000,
    trustedDay: null, trustedWeek: null,
  });
  assert.deepEqual(state.standardWinStreak, { current: 2, best: 2 });

  state = applyMetaOperation(state, { kind: 'standard-failed', attemptId: 's~3' });
  assert.deepEqual(state.standardWinStreak, { current: 0, best: 2 });

  state = applyMetaOperation(state, { kind: 'begin', attemptId: 's~4', mode: 'winnable' });
  state = applyMetaOperation(state, {
    kind: 'complete', attemptId: 's~4', mode: 'winnable', elapsedMs: 1000,
    trustedDay: null, trustedWeek: null,
  });
  assert.deepEqual(state.standardWinStreak, { current: 1, best: 2 });
});
