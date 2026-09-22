import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const pikabuExample = readFileSync(new URL('../.env.pikabu.example', import.meta.url), 'utf8');
const pikabuWorkflow = readFileSync(new URL('../.github/workflows/deploy-pikabu.yml', import.meta.url), 'utf8');
const pikabuPlatform = readFileSync(new URL('../src/platform/pikabu.ts', import.meta.url), 'utf8');
const bridgeSession = readFileSync(new URL('../src/backend/BridgeSessionManager.ts', import.meta.url), 'utf8');

function textTree(relativeDir, { exclude = new Set() } = {}) {
  const start = join(root, relativeDir);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = relative(root, abs).replaceAll('\\', '/');
      if (exclude.has(rel)) continue;
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (/\.(?:ts|mjs|js|json|jsonc)$/i.test(name)) files.push(abs);
    }
  };
  walk(start);
  return files.map((p) => readFileSync(p, 'utf8')).join('\n');
}

const activeBackendText = [
  textTree('server/cascade-api'),
  textTree('server/cloudflare'),
].join('\n');
const activeBrowserText = [pikabuPlatform, bridgeSession, pikabuExample, pikabuWorkflow].join('\n');

test('browser config points at workers.dev and contains no server secret names or GamePush runtime config', () => {
  assert.match(pikabuExample, /VITE_BACKEND_URL=https:\/\/cascade-api\.<account-subdomain>\.workers\.dev/);
  for (const name of ['PIKABU_GAME_SECRET', 'GAMEPUSH_API_SECRET', 'BRIDGE_SESSION_SECRET']) {
    assert.equal(pikabuExample.includes(name), false);
  }
  assert.doesNotMatch(activeBrowserText, /GAMEPUSH_API_SECRET|api\.gamepush\.com|game-score\.js|VITE_GAMEPUSH|c5GdZPx08oVCDei4Opc5DJDx68TZDUEb/i);
});

test('active Worker/backend runtime has no GamePush secret, endpoint, or SDK dependency', () => {
  assert.doesNotMatch(activeBackendText, /GAMEPUSH_API_SECRET|api\.gamepush\.com|game-score\.js/i);
  assert.doesNotMatch(wrangler, /GAMEPUSH_/i);
  assert.doesNotMatch(wrangler, /"PIKABU_GAME_SECRET"\s*:\s*"[^"]+"/);
  assert.doesNotMatch(wrangler, /"BRIDGE_SESSION_SECRET"\s*:\s*"[^"]+"/);
});
