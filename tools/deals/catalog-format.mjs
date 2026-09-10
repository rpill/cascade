import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const MAX_UINT32 = 0xffff_ffff;
const UINT32_BYTES = 4;

function toPositiveUint32(value, label) {
  const number = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isInteger(number) || number < 1 || number > MAX_UINT32) {
    throw new RangeError(`${label} must be a positive uint32, got ${String(value)}`);
  }
  return number;
}

function requireAuditInteger(value, label, expected = null) {
  if (!Number.isSafeInteger(value) || value < 0 || (expected !== null && value !== expected)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function sha256(binary) {
  return createHash('sha256').update(binary).digest('hex');
}

export function verifyProductionAssetHash(binary, manifest) {
  const actual = sha256(binary);
  if (manifest?.productionAssetHash !== actual) {
    throw new Error(`Production asset hash mismatch: expected ${String(manifest?.productionAssetHash)}, got ${actual}`);
  }
  return true;
}

function assertUniqueAndDisjoint(standard, daily) {
  const standardSeen = new Set();
  for (const tier of TIERS) {
    for (const seed of standard[tier]) {
      if (standardSeen.has(seed)) throw new Error(`Duplicate Standard seed ${seed}`);
      standardSeen.add(seed);
    }
  }
  const dailySeen = new Set();
  for (const seed of daily) {
    if (dailySeen.has(seed)) throw new Error(`Duplicate Daily seed ${seed}`);
    if (standardSeen.has(seed)) throw new Error(`Standard/Daily seed overlap at ${seed}`);
    dailySeen.add(seed);
  }
}

export function buildVerifiedDealAsset({ standard, daily, dailyScheduleStart, audit }) {
  if (!standard || !Array.isArray(daily) || !audit) throw new TypeError('standard, daily and audit are required');
  const normalizedStandard = {};
  for (const tier of TIERS) {
    if (!Array.isArray(standard[tier])) throw new TypeError(`standard.${tier} must be an array`);
    normalizedStandard[tier] = standard[tier].map((seed, index) => toPositiveUint32(seed, `${tier}[${index}]`));
  }
  const normalizedDaily = daily.map((seed, index) => toPositiveUint32(seed, `daily[${index}]`));
  assertUniqueAndDisjoint(normalizedStandard, normalizedDaily);

  if (typeof dailyScheduleStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(dailyScheduleStart)) {
    throw new Error(`Invalid dailyScheduleStart: ${String(dailyScheduleStart)}`);
  }

  const offsets = {};
  const standardCounts = {};
  let byteOffset = 0;
  let totalCount = 0;
  for (const tier of TIERS) {
    const count = normalizedStandard[tier].length;
    offsets[tier] = { byteOffset, count };
    standardCounts[tier] = count;
    byteOffset += count * UINT32_BYTES;
    totalCount += count;
  }
  offsets.daily = { byteOffset, count: normalizedDaily.length };
  totalCount += normalizedDaily.length;

  const binary = Buffer.alloc(totalCount * UINT32_BYTES);
  let cursor = 0;
  for (const tier of TIERS) {
    for (const seed of normalizedStandard[tier]) {
      binary.writeUInt32LE(seed, cursor);
      cursor += UINT32_BYTES;
    }
  }
  for (const seed of normalizedDaily) {
    binary.writeUInt32LE(seed, cursor);
    cursor += UINT32_BYTES;
  }

  const manifest = {
    catalogVersion: requireAuditInteger(audit.catalogVersion, 'catalogVersion'),
    difficultyModelVersion: requireAuditInteger(audit.difficultyModelVersion, 'difficultyModelVersion', 1),
    dailyAlgorithmVersion: requireAuditInteger(audit.dailyAlgorithmVersion, 'dailyAlgorithmVersion', 2),
    solverSourceHash: String(audit.solverSourceHash ?? ''),
    gameRulesSourceHash: String(audit.gameRulesSourceHash ?? ''),
    standardCounts,
    dailyScheduleStart,
    dailyScheduleLength: normalizedDaily.length,
    fastNodeBudget: requireAuditInteger(audit.fastNodeBudget, 'fastNodeBudget', 250000),
    slowNodeBudget: requireAuditInteger(audit.slowNodeBudget, 'slowNodeBudget', 2000000),
    sourceScanRanges: Array.isArray(audit.sourceScanRanges) ? structuredClone(audit.sourceScanRanges) : [],
    verifiedCount: totalCount,
    rejectedVerificationCount: requireAuditInteger(audit.rejectedVerificationCount, 'rejectedVerificationCount'),
    crossPoolDuplicateCount: requireAuditInteger(audit.crossPoolDuplicateCount, 'crossPoolDuplicateCount', 0),
    productionAssetHash: sha256(binary),
    offsets,
  };

  verifyProductionAssetHash(binary, manifest);
  return { binary, manifest };
}

export function writeVerifiedDealAssets({ binary, manifest, binaryPath, manifestPath }) {
  verifyProductionAssetHash(binary, manifest);
  mkdirSync(path.dirname(path.resolve(binaryPath)), { recursive: true });
  mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
  writeFileSync(binaryPath, binary);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
