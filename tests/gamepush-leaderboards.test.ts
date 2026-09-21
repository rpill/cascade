import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeDailyLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';

async function loadModule() {
  try {
    return await import('../src/platform/GamePushLeaderboards.ts');
  } catch {
    return null;
  }
}

function fakeApi() {
  const fetches: any[] = [];
  const ratings: any[] = [];
  const publishes: any[] = [];
  return {
    api: {
      async fetchScoped(query: any) {
        fetches.push(query);
        if (query.tag === 'cascadeStandard') {
          return { topPlayers: [{ id: 1, name: 'A', avatar: 'a.webp', position: 1, bestStreak: 12 }] };
        }
        if (query.tag === 'cascadeDaily') {
          return { topPlayers: [{ id: 2, name: 'B', avatar: '', position: 2, moves: 44, elapsedMs: 123456, completedAt: 10 }] };
        }
        return { topPlayers: [{ id: 3, name: 'C', avatar: '', position: 1, masteryPoints: 4_000_000_321 }] };
      },
      async fetchPlayerRatingScoped(query: any) {
        ratings.push(query);
        if (query.tag === 'cascadeStandard') return { player: { id: 9, name: 'Me', avatar: '', position: 5, bestStreak: 7 } };
        return { player: null };
      },
      async publishRecord(query: any) { publishes.push(query); return { record: query.record, fields: [] }; },
    },
    fetches,
    ratings,
    publishes,
  };
}

test('GamePush maps Cascade technical leaderboard names to configured scoped boards', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const fake = fakeApi();
  const boards = new mod.GamePushLeaderboards(fake.api);

  const standard = await boards.getEntries('standardwinstreak', { quantityTop: 20 });
  assert.deepEqual(standard, [{ rank: 1, score: 12, playerId: '1', publicName: 'A', avatarUrl: 'a.webp' }]);
  assert.deepEqual(fake.fetches[0], {
    tag: 'cascadeStandard', variant: 'global', order: 'DESC', limit: 20, withMe: 'none',
  });

  const daily = await boards.getEntries('dailyfastest', { quantityTop: 20, scopeKey: '2026-09-21' });
  assert.equal(daily[0]?.score, encodeDailyLeaderboardScore('2026-09-21', 44, 123456));
  assert.equal(fake.fetches[1].tag, 'cascadeDaily');
  assert.equal(fake.fetches[1].variant, '2026-09-21');
  assert.equal(fake.fetches[1].order, 'ASC');

  const mastery = await boards.getEntries('cascademastery', { quantityTop: 20 });
  assert.equal(mastery[0]?.score, 4_000_000_321);
});

test('GamePush uses scoped player rating for the current player', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const fake = fakeApi();
  const boards = new mod.GamePushLeaderboards(fake.api);
  const player = await boards.getPlayerEntry('standardwinstreak');
  assert.equal(player?.score, 7);
  assert.deepEqual(fake.ratings[0], { tag: 'cascadeStandard', variant: 'global' });
});

test('GamePush publishes Standard, Daily and Mastery records without a forced override', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const fake = fakeApi();
  const boards = new mod.GamePushLeaderboards(fake.api, () => 1_790_000_000_000);

  await boards.setScore('standardwinstreak', 9, { kind: 'standard', bestStreak: 9 });
  await boards.setScore('dailyfastest', encodeDailyLeaderboardScore('2026-09-21', 40, 90000), {
    kind: 'daily', dailyId: '2026-09-21', moves: 40, elapsedMs: 90000, completedOnTime: true, attemptId: 'daily-a',
  });
  await boards.setScore('cascademastery', 5_000_000_123, { kind: 'mastery', profile: {} });

  assert.deepEqual(fake.publishes[0], {
    tag: 'cascadeStandard', variant: 'global', record: { bestStreak: 9 },
  });
  assert.deepEqual(fake.publishes[1], {
    tag: 'cascadeDaily', variant: '2026-09-21', record: { moves: 40, elapsedMs: 90000, completedAt: 1_790_000_000_000 },
  });
  assert.equal('override' in fake.publishes[1], false);
  assert.deepEqual(fake.publishes[2], {
    tag: 'cascadeMastery', variant: 'global', record: { masteryPoints: 5_000_000_123 },
  });
});

test('retired Daily streak board is inert on GamePush', async () => {
  const mod = await loadModule();
  assert.ok(mod);
  const fake = fakeApi();
  const boards = new mod.GamePushLeaderboards(fake.api);
  assert.deepEqual(await boards.getEntries('dailystreak', { quantityTop: 20, scopeKey: '2026-09-21' }), []);
  assert.equal(await boards.getPlayerEntry('dailystreak', { scopeKey: '2026-09-21' }), null);
  await boards.setScore('dailystreak', 123, { kind: 'streak', todayId: '2026-09-21' });
  assert.equal(fake.publishes.length, 0);
});
