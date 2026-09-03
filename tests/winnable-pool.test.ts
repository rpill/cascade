import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WINNABLE_POOL_METADATA,
  WINNABLE_SEEDS,
} from '../src/game/model/winnableSeeds.ts';

test('shipped winnable seeds are a frozen unique non-zero bigint pool', () => {
  assert.ok(WINNABLE_SEEDS.length > 0);
  assert.equal(Object.isFrozen(WINNABLE_SEEDS), true);
  assert.equal(new Set(WINNABLE_SEEDS).size, WINNABLE_SEEDS.length);
  assert.ok(WINNABLE_SEEDS.every((seed) => typeof seed === 'bigint' && seed > 0n));
  assert.equal(WINNABLE_POOL_METADATA.solved, WINNABLE_SEEDS.length);
  assert.ok(WINNABLE_POOL_METADATA.nodeBudget > 0);
});
