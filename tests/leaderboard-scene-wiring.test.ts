import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('scene mounts leaderboard functionality into the Statistics shell page', () => {
  assert.match(sceneSource, /StatisticsPageView/);
  assert.match(sceneSource, /new StatisticsPageView\(this\.appShell\.contentHost, \{/);
  assert.match(sceneSource, /selectMode: \(mode\) => this\.selectStatisticsMode\(mode\)/);
  assert.match(sceneSource, /authorize: \(\) => \{ void this\.authorizeLeaderboard\(\); \}/);
  assert.match(sceneSource, /leaderboard: \(\) => this\.openStatisticsPage\(true\)/);
  assert.doesNotMatch(sceneSource, /new LeaderboardView\(/);
});

test('leaderboard service is created only after platform and meta load, then shell meta refreshes', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  assert.match(initialize, /this\.platform = await initializePlatform\(\)/);
  assert.match(initialize, /const loaded = await this\.metaRepository\.load\(\)/);
  assert.match(initialize, /this\.metaState = this\.metaMutations\.settleLoadedState\(loaded\)/);
  assert.match(initialize, /this\.leaderboardService = new LeaderboardService\(this\.platform\)/);
  assert.match(initialize, /this\.refreshMenuMeta\(\)/);
  assert.ok(initialize.indexOf('new LeaderboardService(this.platform)') > initialize.indexOf('settleLoadedState(loaded)'));
  assert.doesNotMatch(initialize, /requestAuthorization\(/);
});

test('authorized bootstrap syncs historical bests without automatic authorization', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  assert.match(initialize, /if \(this\.leaderboardService\.authorized\)[\s\S]*syncHistoricalLeaderboardBests\(\)/);
  assert.doesNotMatch(initialize, /requestAuthorization\(/);

  const sync = extractMethod(sceneSource, 'syncHistoricalLeaderboardBests');
  assert.match(sync, /Promise\.all/);
  assert.match(sync, /service\.syncBest\('winnable', this\.metaState\.stats\.winnable\.bestTimeMs\)/);
  assert.match(sync, /service\.syncBest\('original', this\.metaState\.stats\.original\.bestTimeMs\)/);
});

test('leaderboard load uses request tokens and ignores stale mode or hidden Statistics responses', () => {
  assert.match(sceneSource, /private leaderboardRequestId = 0/);
  assert.match(sceneSource, /private leaderboardMode: OrdinaryGameMode = 'winnable'/);

  const open = extractMethod(sceneSource, 'openStatisticsPage');
  assert.match(open, /status: 'loading'/);
  assert.match(open, /this\.loadLeaderboard\(this\.leaderboardMode\)/);

  const load = extractMethod(sceneSource, 'loadLeaderboard');
  assert.match(load, /const requestId = \+\+this\.leaderboardRequestId/);
  assert.match(load, /const result = await service\.load\(mode\)/);
  assert.match(load, /requestId !== this\.leaderboardRequestId/);
  assert.match(load, /!this\.statisticsOpen/);
  assert.match(load, /mode !== this\.leaderboardMode/);
  assert.match(load, /status: result\.status/);
  assert.match(load, /entries: result\.entries/);

  const close = extractMethod(sceneSource, 'closeStatisticsPage');
  assert.match(close, /this\.statisticsOpen = false/);
  assert.match(close, /this\.leaderboardRequestId \+= 1/);
  assert.match(close, /this\.statisticsPage\.hide\(\)/);
});

test('mode switching refreshes selected stats and reloads only when mode actually changes', () => {
  const select = extractMethod(sceneSource, 'selectStatisticsMode');
  assert.match(select, /if \([^)]*!this\.statisticsOpen[^)]*mode === this\.leaderboardMode[^)]*\)[\s\S]*return/);
  assert.match(select, /this\.leaderboardMode = mode/);
  assert.match(select, /this\.renderLeaderboardState\(/);
  assert.match(select, /this\.loadLeaderboard\(mode\)/);
});

test('authorization is explicit, blocked by unfinished games, and stays inside Statistics page on failure', () => {
  const canAuthorize = extractMethod(sceneSource, 'canAuthorizeLeaderboard');
  assert.match(canAuthorize, /this\.gameState === null \|\| this\.gameState\.isWon/);

  const authorize = extractMethod(sceneSource, 'authorizeLeaderboard');
  assert.match(authorize, /this\.leaderboardAuthPending/);
  assert.match(authorize, /!this\.canAuthorizeLeaderboard\(\)/);
  assert.match(authorize, /service\.requestAuthorization\(\)/);
  assert.match(authorize, /message: 'Вход не выполнен'/);
  assert.match(authorize, /await this\.syncHistoricalLeaderboardBests\(\)/);
  assert.match(authorize, /await this\.loadLeaderboard\(this\.leaderboardMode\)/);

  const requestAuthorizationOccurrences = sceneSource.match(/requestAuthorization\(\)/g) ?? [];
  assert.equal(requestAuthorizationOccurrences.length, 1);
});

test('account selection reloads chosen progress and shutdown invalidates leaderboard work', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  assert.match(initialize, /onAccountSelectionClosed\(\(\) => \{/);
  assert.match(initialize, /window\.location\.reload\(\)/);

  const shutdown = extractMethod(sceneSource, 'shutdown');
  assert.match(shutdown, /this\.unsubscribeAccountSelection\?\.\(\)/);
  assert.match(shutdown, /this\.unsubscribeAccountSelection = null/);
  assert.match(shutdown, /this\.statisticsOpen = false/);
  assert.match(shutdown, /this\.leaderboardRequestId \+= 1/);
  assert.match(shutdown, /this\.statisticsPage\.destroy\(\)/);
});

test('GameScene never reaches into raw Yandex SDK APIs', () => {
  assert.doesNotMatch(sceneSource, /openAuthDialog|ysdk\.leaderboards|YaGames/);
});

test('only an improved ordinary best requests fire-and-forget leaderboard synchronization', () => {
  const ordinary = extractMethod(sceneSource, 'finishOrdinaryAttempt');
  assert.match(
    ordinary,
    /completion\.improvedBest[\s\S]*bestTimeMs[\s\S]*void this\.leaderboardService\?\.syncBest\(mode, bestTimeMs\)/,
  );
});
