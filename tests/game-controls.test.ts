import test from 'node:test';
import assert from 'node:assert/strict';

import { GameFlow } from '../src/game/model/GameFlow.ts';
import { GameSession } from '../src/game/model/GameSession.ts';
import { createDealForMode } from '../src/game/model/deal.ts';

function createFlow(): GameFlow {
  return new GameFlow(new GameSession({
    nextSeed: (() => {
      let seed = 40n;
      return () => ++seed;
    })(),
    winnableSeeds: [1n, 2n],
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

  const second = flow.playSelectedMode();
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
  const first = flow.playSelectedMode(1n);
  const second = flow.startNewInCurrentMode();

  assert.equal(first.mode, 'daily');
  assert.equal(second.mode, 'daily');
  assert.equal(second.seed, first.seed);
});
