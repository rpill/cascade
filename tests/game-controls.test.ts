import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GameFlow } from '../src/game/model/GameFlow.ts';
import { GameSession } from '../src/game/model/GameSession.ts';
import { VerifiedDealCatalog, type StandardTier, type VerifiedDealManifest } from '../src/game/model/VerifiedDealCatalog.ts';
import { createDealForMode } from '../src/game/model/deal.ts';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const hudSource = readFileSync(
  new URL('../src/ui/game/GameHud.ts', import.meta.url),
  'utf8',
);

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function tinyCatalog(): VerifiedDealCatalog {
  const standard: Record<StandardTier, number[]> = {
    onboarding: [1, 2],
    easy: [],
    medium: [],
    hard: [],
  };
  const daily = [101, 102];
  const values = [...TIERS.flatMap((tier) => standard[tier]), ...daily];
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((seed, index) => view.setUint32(index * 4, seed, true));

  const standardCounts = {} as Record<StandardTier, number>;
  const offsets = {} as Record<StandardTier | 'daily', { byteOffset: number; count: number }>;
  let byteOffset = 0;
  for (const tier of TIERS) {
    standardCounts[tier] = standard[tier].length;
    offsets[tier] = { byteOffset, count: standard[tier].length };
    byteOffset += standard[tier].length * 4;
  }
  offsets.daily = { byteOffset, count: daily.length };

  const manifest: VerifiedDealManifest = {
    catalogVersion: 1,
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 2,
    solverSourceHash: 'solver-hash',
    gameRulesSourceHash: 'rules-hash',
    standardCounts,
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: daily.length,
    fastNodeBudget: 250000,
    slowNodeBudget: 2000000,
    sourceScanRanges: [],
    verifiedCount: values.length,
    rejectedVerificationCount: 0,
    crossPoolDuplicateCount: 0,
    productionAssetHash: '0'.repeat(64),
    offsets,
  };

  return VerifiedDealCatalog.decode(buffer, manifest);
}

function createFlow(): GameFlow {
  return new GameFlow(new GameSession({
    nextSeed: (() => {
      let seed = 40n;
      return () => ++seed;
    })(),
    catalog: tinyCatalog(),
  }));
}



test('resume restores a saved deal directly into playing state', () => {
  const flow = createFlow();
  const savedDeal = createDealForMode('original', 123n);

  const resumed = flow.resume(savedDeal, 'playing');

  assert.equal(flow.state, 'playing');
  assert.equal(flow.selectedMode, savedDeal.mode);
  assert.equal(flow.currentDeal, resumed);
  assert.equal(resumed.seed, savedDeal.seed);
});

test('resume restores a saved deal into menu-paused state', () => {
  const flow = createFlow();
  const savedDeal = createDealForMode('winnable', 456n);

  flow.resume(savedDeal, 'menu-paused');

  assert.equal(flow.state, 'menu-paused');
  assert.equal(flow.selectedMode, savedDeal.mode);
  assert.equal(flow.canCancelMenu, true);
  assert.equal(flow.cancelMenu(), true);
  assert.equal(flow.state, 'playing');
});

test('resume rejects menu-required as a restore target', () => {
  const flow = createFlow();
  const savedDeal = createDealForMode('original', 789n);

  assert.throws(
    () => flow.resume(savedDeal, 'menu-required' as 'playing'),
    /resume state|playing|menu-paused/i,
  );
});

test('launch requires selecting a mode before Play can start a deal', () => {
  const flow = createFlow();

  assert.equal(flow.state, 'menu-required');
  assert.equal(flow.selectedMode, null);
  assert.equal(flow.currentDeal, null);
  assert.equal(flow.canCancelMenu, false);
  assert.throws(() => flow.playSelectedMode(), /select/i);
});

test('selecting a menu mode is pending until Play', () => {
  const flow = createFlow();

  flow.selectMenuMode('original');

  assert.equal(flow.selectedMode, 'original');
  assert.equal(flow.currentDeal, null);
  assert.equal(flow.state, 'menu-required');

  const deal = flow.playSelectedMode();
  assert.equal(deal.mode, 'original');
  assert.equal(flow.currentDeal, deal);
  assert.equal(flow.state, 'playing');
});

test('New Game immediately changes seed while keeping the active mode', () => {
  const flow = createFlow();
  flow.selectMenuMode('original');
  const first = flow.playSelectedMode();

  const second = flow.startNewInCurrentMode();

  assert.equal(flow.state, 'playing');
  assert.equal(second.mode, first.mode);
  assert.notEqual(second.seed, first.seed);
});

test('opening the main menu preserves the board and preselects the active mode', () => {
  const flow = createFlow();
  flow.selectMenuMode('original');
  const first = flow.playSelectedMode();

  assert.equal(flow.openMainMenu(), true);
  assert.equal(flow.state, 'menu-paused');
  assert.equal(flow.selectedMode, 'original');
  assert.equal(flow.currentDeal, first);
  assert.equal(flow.canCancelMenu, true);

  flow.selectMenuMode('winnable');
  assert.equal(flow.currentDeal, first);
  assert.equal(flow.cancelMenu(), true);
  assert.equal(flow.state, 'playing');
  assert.equal(flow.currentDeal, first);
});

test('changing mode in the menu takes effect only after Play', () => {
  const flow = createFlow();
  flow.selectMenuMode('original');
  const first = flow.playSelectedMode();
  flow.openMainMenu();

  flow.selectMenuMode('winnable');
  assert.equal(flow.currentDeal, first);

  const second = flow.playSelectedMode(1n);
  assert.equal(second.mode, 'winnable');
  assert.notEqual(second.seed, first.seed);
  assert.equal(flow.state, 'playing');
});

test('restart preserves the active seed and mode', () => {
  const flow = createFlow();
  flow.selectMenuMode('original');
  const first = flow.playSelectedMode();
  const restarted = flow.restart();

  assert.equal(flow.state, 'playing');
  assert.equal(restarted.seed, first.seed);
  assert.equal(restarted.mode, first.mode);
});

test('Daily requires its deterministic seed and New Game replays the same deal', () => {
  const flow = createFlow();
  flow.selectMenuMode('daily');

  assert.throws(() => flow.playSelectedMode(), /Daily seed/i);
  const first = flow.playSelectedMode(101n);
  const second = flow.startNewInCurrentMode();

  assert.equal(first.mode, 'daily');
  assert.equal(second.mode, 'daily');
  assert.equal(second.seed, first.seed);
});


test('keyboard shortcuts remain scene-owned while click controls live in Phaser GameHud', () => {
  assert.match(sceneSource, /keydown-R/);
  assert.match(sceneSource, /keydown-Z/);
  assert.match(sceneSource, /keydown-N/);
  assert.match(sceneSource, /keydown-ESC/);
  assert.match(sceneSource, /new GameHud/);
  assert.match(hudSource, /actions\.home/);
  assert.match(hudSource, /actions\.newDeal/);
  assert.match(hudSource, /actions\.undo/);
  assert.match(hudSource, /actions\.restart/);
});
