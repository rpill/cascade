import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LEADERBOARD_NAME,
  DAILY_STREAK_LEADERBOARD_NAME,
  MASTERY_LEADERBOARD_NAME,
  STANDARD_LEADERBOARD_NAME,
  decodeDailyLeaderboardScore,
  decodeDailyStreakLeaderboardScore,
  encodeDailyLeaderboardScore,
  encodeDailyStreakLeaderboardScore,
  getLeaderboardName,
} from '../src/leaderboards/LeaderboardConfig.ts';

test('product leaderboards use Standard, Daily, Daily streak, and Mastery technical names', () => {
  assert.equal(DAILY_LEADERBOARD_NAME, 'dailyfastest');
  assert.equal(DAILY_STREAK_LEADERBOARD_NAME, 'dailystreak');
  assert.equal(MASTERY_LEADERBOARD_NAME, 'cascademastery');
  assert.equal(STANDARD_LEADERBOARD_NAME, 'standardwinstreak');
  assert.equal(getLeaderboardName('winnable'), 'standardwinstreak');
  assert.equal(getLeaderboardName('daily'), 'dailyfastest');
  assert.equal(getLeaderboardName('streak'), 'dailystreak');
  assert.equal(getLeaderboardName('mastery'), 'cascademastery');
});

test('Daily score ranks newer day first, then fewer moves, then faster time', () => {
  const yesterday = encodeDailyLeaderboardScore('2026-09-15', 30, 60_000);
  const todayMoreMoves = encodeDailyLeaderboardScore('2026-09-16', 50, 60_000);
  const todayFewerMoves = encodeDailyLeaderboardScore('2026-09-16', 49, 600_000);
  const todayFaster = encodeDailyLeaderboardScore('2026-09-16', 49, 90_000);
  assert.ok(todayMoreMoves > yesterday);
  assert.ok(todayFewerMoves > todayMoreMoves);
  assert.ok(todayFaster > todayFewerMoves);
  assert.deepEqual(decodeDailyLeaderboardScore(todayFaster), { dailyId: '2026-09-16', moves: 49, elapsedMs: 90_000 });
});

test('Daily streak score ranks current streak first and best streak second', () => {
  const sevenBestTen = encodeDailyStreakLeaderboardScore(7, 10);
  const sevenBestNineteen = encodeDailyStreakLeaderboardScore(7, 19);
  const eightBestEight = encodeDailyStreakLeaderboardScore(8, 8);
  assert.ok(sevenBestNineteen > sevenBestTen);
  assert.ok(eightBestEight > sevenBestNineteen);
  assert.deepEqual(decodeDailyStreakLeaderboardScore(sevenBestNineteen), { current: 7, best: 19 });
});
