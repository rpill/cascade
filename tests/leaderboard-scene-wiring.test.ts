import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('Statistics shell owns three-mode competitive leaderboard flow', () => {
  assert.match(sceneSource, /StatisticsPageView/);
  assert.match(sceneSource, /private leaderboardMode: StatisticsMode = 'winnable'/);
  assert.match(sceneSource, /selectMode: \(mode\) => this\.selectStatisticsMode\(mode\)/);
  assert.doesNotMatch(sceneSource, /new LeaderboardView\(/);
});

test('authorized bootstrap syncs Standard streak and current Daily best only', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  assert.match(initialize, /this\.leaderboardService = new LeaderboardService\(this\.platform\)/);
  assert.match(initialize, /if \(this\.leaderboardService\.authorized\)[\s\S]*syncHistoricalLeaderboards\(\)/);
  assert.doesNotMatch(initialize, /requestAuthorization\(/);

  const sync = extractMethod(sceneSource, 'syncHistoricalLeaderboards');
  assert.match(sync, /syncStandardStreak\(this\.metaState\.standardWinStreak\.best\)/);
  assert.match(sync, /syncDailyBest\(dailyContext\.dailyId, dailyBest\)/);
  assert.doesNotMatch(sync, /original|classicbesttime|syncBest/);
});

test('Standard win syncs best streak while Classic completion never submits best time', () => {
  const ordinary = extractMethod(sceneSource, 'finishOrdinaryAttempt');
  assert.match(ordinary, /recorded && mode === 'winnable'/);
  assert.match(ordinary, /syncStandardStreak\(this\.metaState\.standardWinStreak\.best\)/);
  assert.doesNotMatch(ordinary, /syncBest|classicbesttime|standardbesttime/);
});

test('Daily completion syncs current date best time', () => {
  const daily = extractMethod(sceneSource, 'finishDailyAttempt');
  assert.match(daily, /syncDailyBest\(/);
  assert.match(daily, /context\.dailyId/);
  assert.match(daily, /this\.metaState\.daily\.records\[context\.dailyId\]\?\.bestTimeMs/);
});

test('Classic statistics disables network leaderboard while Standard and Daily load remotely', () => {
  const open = extractMethod(sceneSource, 'openStatisticsPage');
  assert.match(open, /!hasGlobalLeaderboard\(this\.leaderboardMode\)/);
  assert.match(open, /status: 'disabled'/);

  const select = extractMethod(sceneSource, 'selectStatisticsMode');
  assert.match(select, /!hasGlobalLeaderboard\(mode\)/);
  assert.match(select, /status: 'disabled'/);
  assert.match(select, /this\.loadLeaderboard\(mode\)/);

  const load = extractMethod(sceneSource, 'loadLeaderboard');
  assert.match(load, /!hasGlobalLeaderboard\(mode\)/);
  assert.match(load, /mode === 'daily'/);
  assert.match(load, /service\.load\(mode, dailyId/);
  assert.match(load, /requestId !== this\.leaderboardRequestId/);
});

test('authorization exists only for modes with global leaderboards', () => {
  const authorize = extractMethod(sceneSource, 'authorizeLeaderboard');
  assert.match(authorize, /!hasGlobalLeaderboard\(this\.leaderboardMode\)/);
  assert.match(authorize, /service\.requestAuthorization\(\)/);
  assert.match(authorize, /await this\.syncHistoricalLeaderboards\(\)/);
  assert.match(authorize, /await this\.loadLeaderboard\(this\.leaderboardMode\)/);

  const requestAuthorizationOccurrences = sceneSource.match(/requestAuthorization\(\)/g) ?? [];
  assert.equal(requestAuthorizationOccurrences.length, 1);
});

test('leaderboard requests are invalidated on close and shutdown and GameScene never reaches raw Yandex SDK', () => {
  const close = extractMethod(sceneSource, 'closeStatisticsPage');
  assert.match(close, /this\.leaderboardRequestId \+= 1/);
  const shutdown = extractMethod(sceneSource, 'shutdown');
  assert.match(shutdown, /this\.leaderboardRequestId \+= 1/);
  assert.match(shutdown, /this\.statisticsPage\.destroy\(\)/);
  assert.doesNotMatch(sceneSource, /openAuthDialog|ysdk\.leaderboards|YaGames/);
});
