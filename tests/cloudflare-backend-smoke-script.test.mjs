import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../scripts/cloudflare-backend-smoke.mjs', import.meta.url);

test('Cloudflare smoke is non-mutating and checks both allowed and denied CORS', () => {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /CLOUDFLARE_BACKEND_URL/);
  assert.match(source, /CLOUDFLARE_SMOKE_ORIGIN/);
  assert.match(source, /__cascade_missing_route__/);
  assert.match(source, /\/v1\/profile/);
  assert.match(source, /\/v1\/session/);
  assert.match(source, /method:\s*'OPTIONS'/);
  assert.match(source, /cascade-smoke-denied\.invalid/);
  assert.match(source, /access-control-allow-origin/);
  assert.doesNotMatch(source, /GAMEPUSH_API_SECRET|PIKABU_GAME_SECRET|BRIDGE_SESSION_SECRET|publishRecord|\/v1\/leaderboards\//);
  assert.match(source, /Cloudflare backend smoke PASSED\./);
});
