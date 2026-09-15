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
    /freshDealActivityBlocked = true[\s\S]*newDealConfirmOverlay\.confirm\(\)[\s\S]*freshDealActivityBlocked = false[\s\S]*reconcileGameplayActivity/,
  );
  assert.match(
    sceneSource,
    /localInteractionBlocked: this\.rulesOpen \|\| this\.freshDealActivityBlocked/,
  );
});


test('fresh Standard deal waits for ad resume and a settled viewport before rebuilding the board', () => {
  const requestFreshDeal = extractMethod(sceneSource, 'requestFreshDeal');
  const adIndex = requestFreshDeal.indexOf('beforeFreshStandardDeal');
  const settleIndex = requestFreshDeal.indexOf('waitForPlatformResumeAndViewport');
  const startIndex = requestFreshDeal.indexOf('startNewInCurrentMode');
  assert.notEqual(adIndex, -1);
  assert.notEqual(settleIndex, -1);
  assert.notEqual(startIndex, -1);
  assert.ok(adIndex < settleIndex, 'viewport wait must happen after the interstitial closes');
  assert.ok(settleIndex < startIndex, 'new deal must not be built against the ad-transition viewport');

  const waitMethod = extractMethod(sceneSource, 'waitForPlatformResumeAndViewport');
  assert.match(waitMethod, /this\.platformPaused/);
  assert.match(waitMethod, /requestAnimationFrame/);
});

test('menu-paused flow is included in the shared scene-pause decision', () => {
  const reconcile = extractMethod(sceneSource, 'reconcileGameplayActivity');
  assert.match(reconcile, /menuPaused: this\.flow\?\.state === 'menu-paused'/);
  assert.match(reconcile, /decision\.sceneShouldPause/);
});
