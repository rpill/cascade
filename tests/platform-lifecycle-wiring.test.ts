import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('GameScene binds platform pause before player meta loading continues', () => {
  const initialize = extractMethod(sceneSource, 'initializeMeta');
  const bindIndex = initialize.indexOf('this.bindPlatformLifecycle(this.platform)');
  const loadIndex = initialize.indexOf('await this.loadMetaProfile()');
  assert.notEqual(bindIndex, -1);
  assert.notEqual(loadIndex, -1);
  assert.ok(bindIndex < loadIndex);
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


test('new-deal confirmation is a local gameplay blocker until the dialog or transition finishes', () => {
  assert.match(sceneSource, /freshDealActivityBlocked/);
  assert.match(
    sceneSource,
    /freshDealActivityBlocked = true[\s\S]*newDealConfirmView\.confirm\(\)[\s\S]*freshDealActivityBlocked = false[\s\S]*reconcileGameplayActivity/,
  );
  assert.match(
    sceneSource,
    /localInteractionBlocked: this\.rulesOpen \|\| this\.freshDealActivityBlocked/,
  );
});
