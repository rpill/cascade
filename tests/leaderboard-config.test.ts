import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getLeaderboardName,
  LEADERBOARD_NAMES,
} from '../src/leaderboards/LeaderboardConfig.ts';

test('ordinary modes map to exact Yandex technical names', () => {
  assert.equal(LEADERBOARD_NAMES.winnable, 'standardbesttime');
  assert.equal(LEADERBOARD_NAMES.original, 'classicbesttime');
  assert.equal(getLeaderboardName('winnable'), 'standardbesttime');
  assert.equal(getLeaderboardName('original'), 'classicbesttime');
  assert.match(LEADERBOARD_NAMES.winnable, /^[a-zA-Z0-9]+$/);
  assert.match(LEADERBOARD_NAMES.original, /^[a-zA-Z0-9]+$/);
});

test('leaderboard mapping is ordinary-only and has no Daily entry', async () => {
  assert.equal('daily' in LEADERBOARD_NAMES, false);

  const source = await readFile(
    new URL('../src/leaderboards/LeaderboardConfig.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /OrdinaryGameMode/);
  assert.doesNotMatch(source, /\bdaily\b/i);
});
