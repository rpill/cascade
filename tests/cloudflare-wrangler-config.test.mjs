import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function extractString(name) {
  const match = source.match(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`));
  assert.ok(match, `${name} must be present in wrangler.jsonc`);
  return match[1];
}

test('wrangler config pins a valid non-future compatibility date and Cloudflare Worker entrypoint', () => {
  assert.match(source, /"name"\s*:\s*"cascade-api"/);
  assert.match(source, /"main"\s*:\s*"server\/cloudflare\/worker\.ts"/);
  assert.match(source, /"workers_dev"\s*:\s*true/);
  assert.doesNotMatch(source, /nodejs_compat/);
  const compatibilityDate = extractString('compatibility_date');
  assert.match(compatibilityDate, /^\d{4}-\d{2}-\d{2}$/);
  const todayUtc = new Date().toISOString().slice(0, 10);
  assert.ok(compatibilityDate <= todayUtc, `compatibility_date must not be in the future (got ${compatibilityDate}, UTC today is ${todayUtc})`);
});

test('wrangler source config contains only Pikabu/bridge secrets and exact origin allowlist', () => {
  const parsed = JSON.parse(source);
  assert.deepEqual(parsed.secrets?.required, ['PIKABU_GAME_SECRET', 'BRIDGE_SESSION_SECRET']);
  assert.deepEqual(parsed.vars, {
    CASCADE_ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173,https://games.pikabu.ru',
  });
  assert.doesNotMatch(source, /GAMEPUSH_/i);
  assert.equal(parsed.d1_databases, undefined, 'source config must not commit a fake D1 UUID');
});

test('package scripts expose one-command D1 setup plus Cloudflare dev/build/deploy', () => {
  const scripts = packageJson.scripts ?? {};
  assert.equal(scripts['backend:setup:d1'], 'node scripts/setup-cloudflare-d1.mjs');
  assert.match(scripts['backend:dev:cloudflare'] ?? '', /wrangler(?:@[0-9.]+)?\s+dev/);
  assert.match(scripts['backend:build:cloudflare'] ?? '', /wrangler(?:@[0-9.]+)?\s+deploy\s+--dry-run\s+--outdir\s+dist\/cloudflare-worker/);
  assert.match(scripts['backend:deploy:cloudflare'] ?? '', /wrangler(?:@[0-9.]+)?\s+deploy/);
  assert.equal(Object.keys(scripts).some((key) => key.startsWith('backend:') && key.endsWith(':yandex')), false);
});
