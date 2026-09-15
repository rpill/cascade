import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LEADERBOARD_NAME,
  LEADERBOARD_NAMES,
  STANDARD_LEADERBOARD_NAME,
  getLeaderboardName,
  hasGlobalLeaderboard,
} from '../src/leaderboards/LeaderboardConfig.ts';

test('Standard and Daily map to exact Yandex technical names while Classic has no board', () => {
  assert.equal(STANDARD_LEADERBOARD_NAME, 'standardwinstreak');
  assert.equal(DAILY_LEADERBOARD_NAME, 'dailyfastest');
  assert.equal(LEADERBOARD_NAMES.winnable, 'standardwinstreak');
  assert.equal(LEADERBOARD_NAMES.daily, 'dailyfastest');
  assert.equal(getLeaderboardName('winnable'), 'standardwinstreak');
  assert.equal(getLeaderboardName('daily'), 'dailyfastest');
  assert.equal(hasGlobalLeaderboard('winnable'), true);
  assert.equal(hasGlobalLeaderboard('daily'), true);
  assert.equal(hasGlobalLeaderboard('original'), false);
  assert.match(STANDARD_LEADERBOARD_NAME, /^[a-zA-Z0-9]+$/);
  assert.match(DAILY_LEADERBOARD_NAME, /^[a-zA-Z0-9]+$/);
});

import { MASTERY_LEADERBOARD_NAME, encodeMasteryLeaderboardScore, decodeMasteryLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

test('Mastery uses Cascade technical name and Trifold rank-plus-lifetime score', () => {
  const profile=createDefaultMetaSave();
  profile.mastery.rank='expert';
  profile.futurePrestige.mediumSeeds=['1','2'];
  profile.futurePrestige.hardSeeds=['3'];
  profile.futurePrestige.onTimeDailyDates=['2026-09-10'];
  assert.equal(MASTERY_LEADERBOARD_NAME,'cascademastery');
  const score=encodeMasteryLeaderboardScore(profile);
  assert.equal(score,4_000_000_010);
  assert.deepEqual(decodeMasteryLeaderboardScore(score),{rank:'expert',points:10});
  assert.match(MASTERY_LEADERBOARD_NAME,/^[a-zA-Z0-9]+$/);
});
