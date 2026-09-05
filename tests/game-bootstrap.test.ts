import test from 'node:test';
import assert from 'node:assert/strict';

import {
  startWhenHostReady,
  waitForUsableHostSize,
} from '../src/bootstrap/GameBootstrap.ts';

test('zero-sized host waits until both rendered dimensions are positive', async () => {
  const sizes = [
    { width: 0, height: 390 },
    { width: 844, height: 0 },
    { width: 844.8, height: 390.2 },
  ];
  let index = 0;

  const size = await waitForUsableHostSize(
    () => sizes[index],
    async () => { index += 1; },
  );

  assert.deepEqual(size, { width: 844, height: 390 });
  assert.equal(index, 2);
});

test('first usable host size creates the game exactly once and forwards that size', async () => {
  const sizes = [
    { width: 0, height: 0 },
    { width: 915, height: 412 },
    { width: 932, height: 430 },
  ];
  let index = 0;
  const created: Array<{ width: number; height: number }> = [];

  const result = await startWhenHostReady(
    () => sizes[index],
    (size) => {
      created.push(size);
      return 'game';
    },
    async () => { index += 1; },
  );

  assert.equal(result, 'game');
  assert.deepEqual(created, [{ width: 915, height: 412 }]);
});
