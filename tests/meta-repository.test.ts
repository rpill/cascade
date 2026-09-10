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

test('repository migrates stored version 1 meta to version 5 on load', async () => {
  const storage: PlayerStorage = {
    load: async () => ({
      cascadeMeta: {
        version: 1,
        daily: {
          algorithmVersion: 1,
          records: {
            '2026-09-04': { completed: true, attempts: 1, bestTimeMs: 4_000 },
          },
        },
        weekly: {
          weekId: '2026-W36',
          completedDailyIds: ['2026-09-04'],
          claimedMilestones: [],
        },
      },
    }),
    save: async () => {},
  };

  const state = await new MetaRepository(storage).load();

  assert.equal(state.version, 5);
  assert.deepEqual(state.stats, {
    original: { played: 0, wins: 0 },
    winnable: { played: 0, wins: 0 },
  });
  assert.equal(state.daily.records['2026-09-04'].bestTimeMs, 4_000);
});
