import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};
const gameSceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('yandex:dev builds with a dedicated Vite mode that enables dev cheats', () => {
  assert.equal(packageJson.scripts?.['build:yandex-dev'], 'tsc && vite build --mode yandex-dev');
  assert.equal(packageJson.scripts?.['yandex:dev'], 'pnpm build:yandex-dev && node scripts/yandex-dev-proxy.mjs');

  const envUrl = new URL('../.env.yandex-dev', import.meta.url);
  assert.equal(existsSync(envUrl), true);
  assert.match(readFileSync(envUrl, 'utf8'), /^VITE_DEV_CHEATS=true\s*$/m);
});

test('development coin floor works in either normal Vite dev or yandex:dev cheat mode', () => {
  assert.match(
    gameSceneSource,
    /\(import\.meta\.env\.DEV\s*\|\|\s*import\.meta\.env\.VITE_DEV_CHEATS\s*===\s*['"]true['"]\)[\s\S]{0,180}setDevelopmentCoinFloor\(999_999\)/,
  );
});
