import test from 'node:test';
import assert from 'node:assert/strict';

import { MetaRepository } from '../src/meta/MetaRepository.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

test('repository stores meta under one stable top-level key', async () => {
  let written: Record<string, unknown> | null = null;
  const storage: PlayerStorage = {
    load: async () => ({}),
    save: async (data) => { written = data; },
  };
  const repo = new MetaRepository(storage);
  const state = createDefaultMetaSave();

  await repo.save(state);

  assert.deepEqual(written, { cascadeMeta: state });
});

test('failed save keeps the newest snapshot pending and retry writes only that snapshot', async () => {
  const writes: Record<string, unknown>[] = [];
  let fail = true;
  const storage: PlayerStorage = {
    load: async () => ({}),
    save: async (data) => {
      if (fail) throw new Error('offline');
      writes.push(data);
    },
  };
  const repo = new MetaRepository(storage);
  const first = createDefaultMetaSave();
  const second = createDefaultMetaSave();
  second.daily.records['2026-09-04'] = { completed: true, attempts: 1, bestTimeMs: 1000 };

  await repo.save(first);
  await repo.save(second);
  fail = false;
  await repo.retryPending();

  assert.deepEqual(writes, [{ cascadeMeta: second }]);
});
