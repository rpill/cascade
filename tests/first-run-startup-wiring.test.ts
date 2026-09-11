import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boot = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('first-run boot selects the onboarding Standard deal before loading card faces', () => {
  assert.match(boot, /preferences\.howToPlaySeen/);
  assert.match(boot, /FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY/);
  assert.match(boot, /new StandardDifficultyDirector/);
  assert.match(boot, /createDealForMode\('winnable',\s*selection\.seed\)/);
  assert.match(boot, /deal\.tableau\.flat\(\)/);
  assert.match(boot, /deal\.stock\.slice\(-3\)/);
  assert.match(boot, /this\.load\.start\(\)/);
});

test('first-run GameScene consumes the preselected deal and defers noncritical assets', () => {
  assert.match(scene, /FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY/);
  assert.match(scene, /getDeferredFirstRunCardBatches/);
  assert.match(scene, /this\.load\.start\(\)/);
  assert.match(scene, /cue !== 'deal'/);
});

test('BoardView creates no images for hidden stock cards and waits for uncached draws', () => {
  const createCards = extractMethod(board, 'createCardImages');
  assert.doesNotMatch(createCards, /\.\.\.this\.game\.stock/);
  assert.match(board, /ensureCardImage/);
  const stockClick = extractMethod(board, 'drawFromStockWhenReady');
  assert.match(stockClick, /ensureCardsReady/);
  assert.match(stockClick, /await/);
  assert.match(stockClick, /animateDraw/);
  assert.match(board, /textures\.exists\(card\.id\)/);
  assert.match(scene, /ensureCardsReady:\s*\(cards\)\s*=>\s*this\.ensureCardTextures\(cards\)/);
});

test('Yandex LoadingAPI ready is released before profile and payment initialization', () => {
  const initialize = extractMethod(scene, 'initializeMeta');
  const ready = initialize.indexOf('this.platform.ready()');
  const profile = initialize.indexOf('await this.loadMetaProfile()');
  const payments = initialize.indexOf('await this.initializeMonetization()');
  assert.notEqual(ready, -1);
  assert.notEqual(profile, -1);
  assert.notEqual(payments, -1);
  assert.ok(ready < profile, 'LoadingAPI.ready must not wait for cloud profile');
  assert.ok(ready < payments, 'LoadingAPI.ready must not wait for payments');
});
