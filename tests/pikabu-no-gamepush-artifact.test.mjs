import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenArtifactStrings = [
  'GamePush',
  'game-score.js',
  'onGPInit',
  'VITE_GAMEPUSH_PUBLIC_TOKEN',
  'VITE_GAMEPUSH_PROJECT_ID',
  'GAMEPUSH_API_SECRET',
  'PIKABU_GAME_SECRET',
  'BRIDGE_SESSION_SECRET',
  'PROVISIONING_REQUIRED',
];

const activeClientFiles = [
  'src/platform/pikabu.ts',
  'src/platform/services.ts',
  'src/backend/BridgeSessionManager.ts',
  'src/vite-env.d.ts',
  '.env.pikabu.example',
  '.github/workflows/deploy-pikabu.yml',
];

test('active Pikabu client source has no legacy provisioning hooks', () => {
  assert.equal(existsSync('src/platform/GamePushProvisioning.ts'), false);
  assert.equal(existsSync('src/platform/GamePushConfig.ts'), false);
  const source = activeClientFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of ['GamePushProvisioning', 'GamePushConfig', 'backendProvisioning', 'game-score.js', 'onGPInit']) {
    assert.equal(source.includes(forbidden), false, `active client contains ${forbidden}`);
  }
});

const assetsDir = 'dist/assets';
test('built Pikabu JS contains Worker URL only and no legacy/server-secret strings', {
  skip: existsSync(assetsDir) ? false : 'dist/assets is absent; run pnpm build:pikabu before artifact verification',
}, () => {
  const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'dist/assets must contain built JavaScript');
  const bundle = jsFiles.map((name) => readFileSync(join(assetsDir, name), 'utf8')).join('\n');
  for (const forbidden of forbiddenArtifactStrings) {
    assert.equal(bundle.includes(forbidden), false, `built Pikabu JS contains forbidden string: ${forbidden}`);
  }
  const expectedWorkerUrl = process.env.VITE_BACKEND_URL?.trim();
  if (expectedWorkerUrl) {
    assert.ok(bundle.includes(expectedWorkerUrl), `built Pikabu JS must contain configured Worker URL: ${expectedWorkerUrl}`);
  }
});
