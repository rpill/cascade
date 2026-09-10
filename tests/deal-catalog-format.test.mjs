import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVerifiedDealAsset,
  verifyProductionAssetHash,
} from '../tools/deals/catalog-format.mjs';

const AUDIT = {
  catalogVersion: 1,
  difficultyModelVersion: 1,
  dailyAlgorithmVersion: 2,
  solverSourceHash: 'solver-hash',
  gameRulesSourceHash: 'rules-hash',
  fastNodeBudget: 250000,
  slowNodeBudget: 2000000,
  rejectedVerificationCount: 0,
  crossPoolDuplicateCount: 0,
  sourceScanRanges: [],
};

test('catalog writer emits deterministic little-endian layout and matching SHA-256', () => {
  const asset = buildVerifiedDealAsset({
    standard: { onboarding: [11, 12], easy: [21], medium: [31], hard: [41] },
    daily: [1001, 1002],
    dailyScheduleStart: '2026-01-01',
    audit: AUDIT,
  });

  assert.equal(asset.binary.readUInt32LE(0), 11);
  assert.equal(asset.binary.readUInt32LE(4), 12);
  assert.equal(asset.binary.readUInt32LE(asset.manifest.offsets.daily.byteOffset), 1001);
  assert.equal(verifyProductionAssetHash(asset.binary, asset.manifest), true);
});

test('catalog writer hash guard rejects a manifest whose SHA-256 does not match its binary', () => {
  const asset = buildVerifiedDealAsset({
    standard: { onboarding: [11], easy: [21], medium: [31], hard: [41] },
    daily: [1001],
    dailyScheduleStart: '2026-01-01',
    audit: AUDIT,
  });

  assert.throws(
    () => verifyProductionAssetHash(asset.binary, { ...asset.manifest, productionAssetHash: '0'.repeat(64) }),
    /production asset hash mismatch/iu,
  );
});
