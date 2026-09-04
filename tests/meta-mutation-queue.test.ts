import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { beginModeAttempt, completeModeAttempt } from '../src/meta/GameStats.ts';
import { MetaMutationQueue } from '../src/meta/MetaMutationQueue.ts';

test('queued mutations replay over loaded meta state exactly once', () => {
  const queue = new MetaMutationQueue();
  let runtime = createDefaultMetaSave();

  runtime = queue.apply(runtime, (state) => beginModeAttempt(state, 'winnable'));
  runtime = queue.apply(
    runtime,
    (state) => completeModeAttempt(state, 'winnable', 4_000).state,
  );

  assert.deepEqual(runtime.stats.winnable, {
    played: 1,
    wins: 1,
    bestTimeMs: 4_000,
  });
  assert.equal(queue.pendingCount, 2);
  assert.equal(queue.loaded, false);

  const base = createDefaultMetaSave();
  const remote: MetaSave = {
    ...base,
    stats: {
      original: { played: 2, wins: 1, bestTimeMs: 9_000 },
      winnable: { played: 10, wins: 3, bestTimeMs: 3_000 },
    },
  };

  const merged = queue.settleLoadedState(remote);

  assert.deepEqual(merged.stats.original, remote.stats.original);
  assert.deepEqual(merged.stats.winnable, {
    played: 11,
    wins: 4,
    bestTimeMs: 3_000,
  });
  assert.equal(queue.loaded, true);
  assert.equal(queue.pendingCount, 0);
  assert.throws(
    () => queue.settleLoadedState(remote),
    /Meta state was already settled/,
  );
});

test('mutations after cloud load apply immediately without entering the replay queue', () => {
  const queue = new MetaMutationQueue();
  const loaded = queue.settleLoadedState(createDefaultMetaSave());

  const next = queue.apply(loaded, (state) => beginModeAttempt(state, 'original'));

  assert.deepEqual(next.stats.original, { played: 1, wins: 0 });
  assert.equal(queue.loaded, true);
  assert.equal(queue.pendingCount, 0);
});

test('a failed mutation is not queued for later replay', () => {
  const queue = new MetaMutationQueue();
  const state = createDefaultMetaSave();

  assert.throws(
    () => queue.apply(state, () => {
      throw new Error('bad mutation');
    }),
    /bad mutation/,
  );

  assert.equal(queue.pendingCount, 0);
  assert.deepEqual(queue.settleLoadedState(state), state);
});
