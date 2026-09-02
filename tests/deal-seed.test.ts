import test from 'node:test';
import assert from 'node:assert/strict';

import { createNextDealSeed } from '../src/game/scenes/dealSeed.ts';

test('new game seed changes even when the proposed seed matches the current deal', () => {
  assert.equal(createNextDealSeed(0x1234_5678, 0x1234_5678), 0x1234_5679);
});

test('new game seed normalizes the proposed value to uint32', () => {
  assert.equal(createNextDealSeed(1, 0x1_0000_0002), 2);
});
