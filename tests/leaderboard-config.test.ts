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
