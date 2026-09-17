import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLeaderboardName } from '../src/leaderboards/LeaderboardConfig.ts';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { createLeaderboardFixtureResult } from '../src/leaderboards/LeaderboardFixtures.ts';
import type { PlatformServices } from '../src/platform/services.ts';

const sceneSource = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const gameSceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const englishSource = readFileSync(new URL('../src/localization/English.ts', import.meta.url), 'utf8');
const dailySceneSource = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');

function fakePlatform(): PlatformServices {
  return {
    playerStorage: { load: async () => ({}), save: async () => undefined },
    trustedClock: { nowMs: () => null },
    auth: { isAuthorized: () => true, requestAuthorization: async () => true, onAccountSelectionClosed: () => () => undefined },
    leaderboards: {
      available: true,
      getEntries: async (name) => {
        assert.equal(name, 'standardwinstreak');
        return [{ rank: 1, score: 12, playerId: 'a', publicName: 'Ada' }];
      },
      getPlayerEntry: async () => ({ rank: 7, score: 5, playerId: 'me', publicName: 'Me' }),
      setScore: async () => undefined,
    },
    ads: { available: false, showInterstitial: async () => false },
    platformPause: { isPaused: () => false, subscribe: () => () => undefined },
    gameplay: { start: () => undefined, stop: () => undefined },
    ready: () => undefined,
  };
}

test('Standard is a first-class leaderboard mode backed by standardwinstreak', async () => {
  assert.equal(getLeaderboardName('winnable'), 'standardwinstreak');
  const result = await new LeaderboardService(fakePlatform()).load('winnable');
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.deepEqual(result.entries[0]?.metric, { kind: 'standard', bestStreak: 12 });
  assert.deepEqual(result.playerEntry?.metric, { kind: 'standard', bestStreak: 5 });
});

test('leaderboard UI exposes Standard alongside Daily and Mastery', () => {
  assert.match(sceneSource, /value:\s*'winnable'/);
  const fixtures = createLeaderboardFixtureResult('winnable');
  assert.ok(fixtures.entries.length >= 20);
  assert.equal(fixtures.entries[0]?.metric.kind, 'standard');
  assert.equal(fixtures.playerEntry, null, 'fixtures require real local player data instead of inventing a fake Standard row');
});

test('Standard leaderboard synchronization is restored', () => {
  assert.match(gameSceneSource, /syncStandardStreak/);
});

test('leaderboard patch remains TypeScript-buildable around localization and Daily helpers', () => {
  assert.equal((englishSource.match(/'Лучшая серия'\s*:/gu) ?? []).length, 1);
  assert.match(dailySceneSource, /function\s+dateAtOffset\s*\(/);
});
