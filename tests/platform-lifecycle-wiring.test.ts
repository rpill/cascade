import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('GameScene binds platform pause before player meta loading continues', () => {
  assert.match(
    sceneSource,
    /this\.platform = await initializePlatform\(\);[\s\S]*bindPlatformLifecycle[\s\S]*new MetaRepository/,
  );
});

test('GameScene reconciles timer markup and external scene pause from one path', () => {
  assert.match(sceneSource, /deriveGameplayActivity/);
  assert.match(sceneSource, /reconcileGameplayActivity/);
  assert.match(sceneSource, /platformPaused/);
  assert.match(sceneSource, /platformScenePaused/);
  assert.match(sceneSource, /gameplayMarkupActive/);
});

test('GameScene cleans up the platform pause subscription on shutdown', () => {
  assert.match(sceneSource, /unsubscribePlatformPause\?\.\(\)/);
  assert.match(sceneSource, /unsubscribePlatformPause = null/);
});

test('platform pause checkpoints the active game before suspension', () => {
  assert.match(
    sceneSource,
    /platformPause\.subscribe[\s\S]*checkpointActiveGame[\s\S]*reconcileGameplayActivity/,
  );
});
