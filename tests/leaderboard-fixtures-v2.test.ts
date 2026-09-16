import test from 'node:test';
import assert from 'node:assert/strict';

async function loadFixturesModule() {
  try {
    return await import('../src/leaderboards/LeaderboardFixtures.ts');
  } catch {
    return null;
  }
}

test('development leaderboard fixtures exist and are deterministic', async () => {
  const fixtures = await loadFixturesModule();
  assert.ok(fixtures, 'LeaderboardFixtures module should exist');
  const first = fixtures.createLeaderboardFixtureResult('daily', '2026-09-16');
  const second = fixtures.createLeaderboardFixtureResult('daily', '2026-09-16');
  assert.deepEqual(first, second);
  assert.equal(first.status, 'ready');
  assert.ok(first.entries.length >= 20);
  assert.equal(first.playerEntry, null, 'fixtures do not invent a fake player row without local data');
});

test('fixtures cover Standard, Daily, streak and Mastery metrics', async () => {
  const fixtures = await loadFixturesModule();
  assert.ok(fixtures, 'LeaderboardFixtures module should exist');
  const standard = fixtures.createLeaderboardFixtureResult('winnable');
  const daily = fixtures.createLeaderboardFixtureResult('daily', '2026-09-16');
  const streak = fixtures.createLeaderboardFixtureResult('streak');
  const mastery = fixtures.createLeaderboardFixtureResult('mastery');
  assert.equal(standard.entries[0]?.metric.kind, 'standard');
  assert.equal(daily.entries[0]?.metric.kind, 'daily');
  assert.equal(streak.entries[0]?.metric.kind, 'streak');
  assert.equal(mastery.entries[0]?.metric.kind, 'mastery');
});
