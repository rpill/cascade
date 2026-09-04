import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDailyId,
  getDailySeed,
  getIsoWeekDailyIds,
  getIsoWeekId,
} from '../src/meta/DailyCalendar.ts';

test('Daily ID uses UTC rather than local calendar assumptions', () => {
  assert.equal(getDailyId(Date.parse('2026-09-04T23:59:59.999Z')), '2026-09-04');
  assert.equal(getDailyId(Date.parse('2026-09-05T00:00:00.000Z')), '2026-09-05');
});

test('ISO week calculation handles year boundaries', () => {
  assert.equal(getIsoWeekId(Date.parse('2026-01-01T12:00:00Z')), '2026-W01');
  assert.equal(getIsoWeekId(Date.parse('2027-01-01T12:00:00Z')), '2026-W53');
});

test('week Daily IDs are Monday through Sunday in UTC', () => {
  assert.deepEqual(getIsoWeekDailyIds(Date.parse('2026-09-04T12:00:00Z')), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('same Daily ID/version maps to the same solver-proven pool member', () => {
  const pool = [11n, 22n, 33n, 44n] as const;
  const first = getDailySeed('2026-09-04', 1, pool);
  const second = getDailySeed('2026-09-04', 1, pool);

  assert.equal(first, second);
  assert.ok(pool.includes(first as 11n | 22n | 33n | 44n));
});
