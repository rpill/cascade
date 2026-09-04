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

test('scene constructs one leaderboard view and main menu opens it', () => {
  assert.match(sceneSource, /LeaderboardView/);
  assert.match(sceneSource, /private leaderboardView!: LeaderboardView/);
  assert.match(sceneSource, /new LeaderboardView\(this, \{/);
  assert.match(sceneSource, /selectMode: \(mode\) => this\.selectLeaderboardMode\(mode\)/);
  assert.match(sceneSource, /authorize: \(\) => \{ void this\.authorizeLeaderboard\(\); \}/);
  assert.match(sceneSource, /close: \(\) => this\.closeLeaderboard\(\)/);
  assert.match(sceneSource, /leaderboard: \(\) => this\.openLeaderboard\(\)/);
});

test('leaderboard service is created only after platform and meta load, then menu availability refreshes', () => {
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

test('leaderboard load uses request tokens and ignores stale tab or closed-overlay responses', () => {
  assert.match(sceneSource, /private leaderboardRequestId = 0/);
  assert.match(sceneSource, /private leaderboardMode: OrdinaryGameMode = 'winnable'/);
  assert.match(sceneSource, /private leaderboardOpen = false/);

  const open = extractMethod(sceneSource, 'openLeaderboard');
  assert.match(open, /this\.leaderboardMode = 'winnable'/);
  assert.match(open, /status: 'loading'/);
  assert.match(open, /this\.loadLeaderboard\('winnable'\)/);

  const load = extractMethod(sceneSource, 'loadLeaderboard');
  assert.match(load, /const requestId = \+\+this\.leaderboardRequestId/);
  assert.match(load, /const result = await service\.load\(mode\)/);
  assert.match(load, /requestId !== this\.leaderboardRequestId/);
  assert.match(load, /!this\.leaderboardOpen/);
  assert.match(load, /mode !== this\.leaderboardMode/);
  assert.match(load, /status: result\.status/);
  assert.match(load, /entries: result\.entries/);

  const close = extractMethod(sceneSource, 'closeLeaderboard');
  assert.match(close, /this\.leaderboardOpen = false/);
  assert.match(close, /this\.leaderboardRequestId \+= 1/);
  assert.match(close, /this\.leaderboardView\.hide\(\)/);
});

test('mode switching reloads only when the selected leaderboard actually changes', () => {
  const select = extractMethod(sceneSource, 'selectLeaderboardMode');
  assert.match(select, /if \([^)]*mode === this\.leaderboardMode[^)]*\)[\s\S]*return/);
  assert.match(select, /this\.leaderboardMode = mode/);
  assert.match(select, /status: 'loading'/);
  assert.match(select, /this\.loadLeaderboard\(mode\)/);
});

test('authorization is explicit, blocked by unfinished games, and preserves the public overlay on failure', () => {
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

test('account selection reloads chosen progress and shutdown unsubscribes and invalidates async work', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  assert.match(initialize, /onAccountSelectionClosed\(\(\) => \{/);
  assert.match(initialize, /window\.location\.reload\(\)/);

  const shutdown = extractMethod(sceneSource, 'shutdown');
  assert.match(shutdown, /this\.unsubscribeAccountSelection\?\.\(\)/);
  assert.match(shutdown, /this\.unsubscribeAccountSelection = null/);
  assert.match(shutdown, /this\.leaderboardOpen = false/);
  assert.match(shutdown, /this\.leaderboardRequestId \+= 1/);
  assert.match(shutdown, /this\.leaderboardView\.destroy\(\)/);
});

test('Escape and menu close dismiss leaderboard before the underlying menu', () => {
  const escape = extractMethod(sceneSource, 'handleEscape');
  assert.match(escape, /if \(this\.leaderboardOpen\)[\s\S]*this\.closeLeaderboard\(\)[\s\S]*return/);

  const closeMenu = extractMethod(sceneSource, 'closeMainMenu');
  assert.match(closeMenu, /if \(this\.leaderboardOpen\)[\s\S]*this\.closeLeaderboard\(\)[\s\S]*return/);
});

test('GameScene never reaches into raw Yandex SDK APIs', () => {
  assert.doesNotMatch(sceneSource, /openAuthDialog|ysdk\.leaderboards|YaGames/);
});
