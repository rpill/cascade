import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDailyId,
  getDailySeed,
  getIsoWeekDailyIds,
  getIsoWeekId,
} from '../src/meta/DailyCalendar.ts';
import {
  VerifiedDealCatalog,
  type StandardTier,
  type VerifiedDealManifest,
} from '../src/game/model/VerifiedDealCatalog.ts';

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function tinyDailyCatalog(): VerifiedDealCatalog {
  const standard: Record<StandardTier, number[]> = {
    onboarding: [11],
    easy: [21],
    medium: [31],
    hard: [41],
  };
  const daily = [1001, 1002, 1003];
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

test('Daily seed maps exact UTC date offsets into the verified schedule', () => {
  const catalog = tinyDailyCatalog();

  assert.equal(getDailySeed('2026-01-01', catalog), 1001n);
  assert.equal(getDailySeed('2026-01-02', catalog), 1002n);
  assert.equal(getDailySeed('2026-01-03', catalog), 1003n);
  assert.equal(getDailySeed('2026-01-02', catalog), 1002n);
});

test('Daily seed rejects invalid ids and dates outside the generated schedule', () => {
  const catalog = tinyDailyCatalog();

  assert.throws(() => getDailySeed('2026-02-30', catalog), /invalid daily id/iu);
  assert.throws(() => getDailySeed('bad-date', catalog), /invalid daily id/iu);
  assert.throws(() => getDailySeed('2025-12-31', catalog), /before.*schedule|out of range/iu);
  assert.throws(() => getDailySeed('2026-01-04', catalog), /after.*schedule|out of range/iu);
});
