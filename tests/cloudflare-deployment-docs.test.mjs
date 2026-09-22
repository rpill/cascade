import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const docs = [
  '../docs/PIKABU_BACKEND_SETUP.md',
  '../docs/PIKABU_HOSTING.md',
  '../docs/D1_PIKABU_RELEASE_CHECKLIST.md',
  '../CURRENT_STATE.md',
  '../TECH.md',
  '../PATCH_NOTES.md',
].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n');

test('active operator docs use Cloudflare Worker + D1 release flow and CPU gate', () => {
  for (const required of [
    'pnpm dlx wrangler@4.135.0 login',
    'pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET',
    'pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET',
    'pnpm backend:setup:d1',
    'pnpm backend:build:cloudflare',
    'pnpm backend:deploy:cloudflare',
    'pnpm backend:smoke:cloudflare',
    'cascade-db',
    'workers.dev',
    '1102',
  ]) assert.ok(docs.includes(required), `missing docs fragment: ${required}`);
});

test('active operator docs contain no obsolete GamePush or Yandex Cloud backend instructions', () => {
  for (const forbidden of [
    'GAMEPUSH_API_SECRET',
    'GAMEPUSH_PROJECT_ID',
    'pnpm gamepush:smoke',
    'GamePush Server API',
    'hidden first-login provisioning',
    'yc init',
    'yc serverless function',
    'yc serverless api-gateway',
    'Yandex API Gateway',
    'backend:deploy:yandex',
    'backend:smoke:yandex',
  ]) assert.equal(docs.includes(forbidden), false, `stale backend instruction: ${forbidden}`);
});


test('obsolete one-off GamePush overlay readmes are removed from the project root', () => {
  assert.equal(existsSync(new URL('../README.txt', import.meta.url)), false);
  assert.equal(existsSync(new URL('../README-PATCH.txt', import.meta.url)), false);
});
