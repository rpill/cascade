import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const services = readFileSync('src/platform/services.ts', 'utf8');
const selector = readFileSync('src/platform/index.ts', 'utf8');
const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

test('platform services expose optional backend identity without replacing player storage', () => {
  assert.match(services, /backendIdentity\?: BackendIdentityProvider/);
  assert.match(services, /playerStorageScopeChangesOnAuthorization\?: boolean/);
});

test('GameScene imports platform initialization from the target-neutral platform module', () => {
  assert.match(scene, /from '\.\.\/\.\.\/platform\/index\.ts'/);
  assert.doesNotMatch(scene, /from '\.\.\/\.\.\/platform\/yandex\.ts'/);
});

test('undefined platform target preserves the Yandex initializer as the default path', () => {
  assert.match(selector, /VITE_PLATFORM_TARGET/);
  assert.match(selector, /initializeYandexPlatform/);
  assert.match(selector, /target === 'pikabu'/);
});

test('Pikabu remains selected directly and never selects a GamePush product platform', () => {
  assert.match(selector, /initializePikabuPlatform/);
  assert.doesNotMatch(selector, /initializeGamePushPlatform/);
});

test('legacy GamePush product-platform files are removed', () => {
  assert.equal(existsSync('src/platform/gamepush.ts'), false);
  assert.equal(existsSync('src/platform/GamePushLeaderboards.ts'), false);
  assert.equal(existsSync('tests/gamepush-platform.test.ts'), false);
  assert.equal(existsSync('tests/gamepush-leaderboards.test.ts'), false);
});

test('platform services expose no browser provisioning provider', () => {
  assert.doesNotMatch(services, /BackendProvisioning|backendProvisioning/);
});

test('Yandex platform never imports GamePush provisioning', () => {
  const yandex = readFileSync('src/platform/yandex.ts', 'utf8');
  assert.doesNotMatch(yandex, /GamePushProvisioning|BridgeSessionManager/);
});

test('Pikabu platform exposes one shared backend session provider', () => {
  const pikabu = readFileSync('src/platform/pikabu.ts', 'utf8');
  assert.match(pikabu, /BridgeSessionManager/);
  assert.match(pikabu, /backendSession/);
});
