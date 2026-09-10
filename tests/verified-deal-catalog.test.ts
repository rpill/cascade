import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VerifiedDealCatalog,
  type StandardTier,
  type VerifiedDealManifest,
} from '../src/game/model/VerifiedDealCatalog.ts';

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function tinyAsset() {
  const standard: Record<StandardTier, number[]> = {
    onboarding: [11, 12],
    easy: [21, 22],
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
  return { buffer, manifest };
}

test('runtime catalog decodes exact standard buckets and daily schedule', () => {
  const asset = tinyAsset();
  const catalog = VerifiedDealCatalog.decode(asset.buffer, asset.manifest);

  assert.deepEqual(catalog.getStandardSeeds('onboarding'), [11n, 12n]);
  assert.deepEqual(catalog.getStandardSeeds('easy'), [21n, 22n]);
  assert.deepEqual(catalog.getStandardSeeds('medium'), [31n]);
  assert.deepEqual(catalog.getStandardSeeds('hard'), [41n]);
  assert.equal(catalog.hasStandardSeed(22n), true);
  assert.equal(catalog.hasStandardSeed(1001n), false);
  assert.equal(catalog.getDailySeedByOffset(0), 1001n);
  assert.equal(catalog.getDailySeedByOffset(2), 1003n);
  assert.equal(catalog.hasDailySeed(1002n), true);
  assert.equal(catalog.hasDailySeed(31n), false);
  assert.equal(catalog.metadata.verifiedCount, 9);
});

test('runtime catalog rejects duplicate and cross-pool seeds', () => {
  const base = tinyAsset();
  const duplicateBuffer = base.buffer.slice(0);
  new DataView(duplicateBuffer).setUint32(4, 11, true);
  assert.throws(
    () => VerifiedDealCatalog.decode(duplicateBuffer, base.manifest),
    /duplicate.*11/iu,
  );

  const overlapBuffer = base.buffer.slice(0);
  new DataView(overlapBuffer).setUint32(base.manifest.offsets.daily.byteOffset, 11, true);
  assert.throws(
    () => VerifiedDealCatalog.decode(overlapBuffer, base.manifest),
    /standard.*daily.*11|daily.*standard.*11/iu,
  );
});

test('runtime catalog rejects invalid positive uint32 seeds and malformed offsets', () => {
  const asset = tinyAsset();
  const zeroBuffer = asset.buffer.slice(0);
  new DataView(zeroBuffer).setUint32(0, 0, true);
  assert.throws(
    () => VerifiedDealCatalog.decode(zeroBuffer, asset.manifest),
    /positive uint32/iu,
  );

  const outOfRangeManifest: VerifiedDealManifest = {
    ...asset.manifest,
    offsets: {
      ...asset.manifest.offsets,
      daily: { byteOffset: asset.buffer.byteLength, count: 1 },
    },
  };
  assert.throws(
    () => VerifiedDealCatalog.decode(asset.buffer, outOfRangeManifest),
    /offset|bounds|length/iu,
  );

  const badCountManifest: VerifiedDealManifest = {
    ...asset.manifest,
    standardCounts: { ...asset.manifest.standardCounts, easy: 99 },
  };
  assert.throws(
    () => VerifiedDealCatalog.decode(asset.buffer, badCountManifest),
    /count/iu,
  );
});

test('daily offset lookup is bounds checked', () => {
  const asset = tinyAsset();
  const catalog = VerifiedDealCatalog.decode(asset.buffer, asset.manifest);
  assert.throws(() => catalog.getDailySeedByOffset(-1), /daily.*offset/iu);
  assert.throws(() => catalog.getDailySeedByOffset(3), /daily.*offset/iu);
  assert.throws(() => catalog.getDailySeedByOffset(0.5), /daily.*offset/iu);
});
