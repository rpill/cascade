import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultMetaSave,
  normalizeMetaSave,
} from '../src/meta/MetaSave.ts';

test('missing or malformed saves normalize to version 1 defaults', () => {
  assert.deepEqual(normalizeMetaSave(null), createDefaultMetaSave());
  assert.deepEqual(normalizeMetaSave({ version: 99 }), createDefaultMetaSave());
});

test('version 1 normalization preserves valid Daily records and removes invalid values', () => {
  const save = normalizeMetaSave({
    version: 1,
    daily: {
      algorithmVersion: 1,
      records: {
        '2026-09-04': { completed: true, bestTimeMs: 12_345, attempts: 3 },
        broken: { completed: true, bestTimeMs: -5, attempts: -1 },
      },
    },
    weekly: {
      weekId: '2026-W36',
      completedDailyIds: ['2026-09-04', '2026-09-04', 'bad'],
      claimedMilestones: [3, 3, 99],
    },
  });

  assert.deepEqual(save.daily.records['2026-09-04'], {
    completed: true,
    bestTimeMs: 12_345,
    attempts: 3,
  });
  assert.equal(save.daily.records.broken, undefined);
  assert.deepEqual(save.weekly.completedDailyIds, ['2026-09-04']);
  assert.deepEqual(save.weekly.claimedMilestones, [3]);
});
