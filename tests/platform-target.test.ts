import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('undefined platform target preserves Yandex while Pikabu selects GamePush', () => {
  assert.match(selector, /VITE_PLATFORM_TARGET/);
  assert.match(selector, /initializeYandexPlatform/);
  assert.match(selector, /initializeGamePushPlatform/);
  assert.match(selector, /target === 'pikabu'[\s\S]*initializeGamePushPlatform\(\)[\s\S]*initializeYandexPlatform\(\)/);
});
