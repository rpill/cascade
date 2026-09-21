import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const vite = readFileSync('vite.config.ts', 'utf8');
const env = readFileSync('.env.pikabu.example', 'utf8');

test('Pikabu build uses a Vite mode while keeping relative asset base', () => {
  assert.match(pkg.scripts['build:pikabu'] ?? '', /vite build --mode pikabu/);
  assert.match(vite, /base:\s*['"]\.\/['"]/);
  assert.match(env, /VITE_PLATFORM_TARGET=pikabu/);
  assert.match(env, /VITE_GAMEPUSH_PROJECT_ID=30632/);
  assert.match(env, /VITE_GAMEPUSH_PUBLIC_TOKEN=/);
  assert.doesNotMatch(env, /VITE_BACKEND_URL=/);
  assert.doesNotMatch(env, /PIKABU_GAME_SECRET|SERVICE_ROLE/);
});
