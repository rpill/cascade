import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};
const gameSceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const envSource = readFileSync(new URL('../.env.yandex-dev', import.meta.url), 'utf8');

test('yandex:dev uses the normal production build without dev cheats', () => {
  assert.equal(packageJson.scripts?.['build:yandex-dev'], undefined);
  assert.equal(packageJson.scripts?.['yandex:dev'], 'pnpm build && node scripts/yandex-dev-proxy.mjs');
  assert.doesNotMatch(envSource, /VITE_DEV_CHEATS\s*=\s*true/i);
});

test('production scene contains no hidden development economy hooks', () => {
  assert.doesNotMatch(gameSceneSource, /VITE_DEV_CHEATS|setDevelopmentCoinFloor/);
});
