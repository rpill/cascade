import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const handlers = readFileSync('server/cascade-api/leaderboards.ts', 'utf8');
const handler = readFileSync('server/cascade-api/handler.ts', 'utf8');

test('HTTP backend depends on provider-neutral Cascade store', () => {
  assert.match(handler, /dependencies\.store/);
  assert.doesNotMatch(handler, /dependencies\.gamePush|GamePushBackend|gamePushPlayerId/);
});

test('HTTP leaderboard surface uses GET and POST on the same board route', () => {
  assert.match(handler, /request\.method !== 'GET' && request\.method !== 'POST'/);
  assert.match(handler, /handleLeaderboardSubmit\(board, request, claims, dependencies\.store\)/);
  assert.match(handler, /handleLeaderboardRead\(board, url, claims, dependencies\.store\)/);
});

test('Daily first result delegates to store and has no Unique Value receipt path', () => {
  assert.match(handlers, /store\.submitDaily/);
  assert.match(handlers, /jsonResponse\(\{ status \}\)/);
  assert.doesNotMatch(handlers, /findUniqueValue|createUniqueValue|cascadeDailyFirst/);
});
