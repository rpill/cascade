import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildVerifiedDealAsset } from '../tools/deals/catalog-format.mjs';
import {
  emitReleaseCatalog,
  scanRange,
  selectProofSample,
  validateReleaseData,
} from '../tools/deals/generate.mjs';
import { verifyCatalogSeeds } from '../tools/deals/verify-all.mjs';
import { buildDealReport } from '../tools/deals/report.mjs';

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

function fakeRecord(seed) {
  return { seed, difficultyScore: seed % 90, proof: [{ kind: 'draw', cardIds: [`seed-${seed}`] }] };
}

test('proof sample selection is deterministic, unique, and covers all release groups', () => {
  let seed = 1;
  const standard = Object.fromEntries(['onboarding', 'easy', 'medium', 'hard'].map((tier) => [
    tier,
    Array.from({ length: 20 }, () => fakeRecord(seed++)),
  ]));
  const dailyRecords = Array.from({ length: 70 }, () => fakeRecord(seed++));
  const dailyBySeed = new Map(dailyRecords.map((record) => [record.seed, record]));
  const start = Date.parse('2026-01-01T00:00:00Z');
  const dailySchedule = dailyRecords.map((record, index) => {
    const date = new Date(start + index * 86_400_000);
    return {
      dailyId: date.toISOString().slice(0, 10),
      seed: record.seed,
      difficultyScore: record.difficultyScore,
    };
  });

  const first = selectProofSample({ standard, dailySchedule, dailyBySeed, target: 64 });
  const second = selectProofSample({ standard, dailySchedule, dailyBySeed, target: 64 });

  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.equal(new Set(first.map((entry) => entry.seed)).size, 64);
  for (const tier of ['onboarding', 'easy', 'medium', 'hard']) {
    assert.ok(first.some((entry) => entry.source === 'standard' && entry.tier === tier));
  }
  for (let weekday = 0; weekday < 7; weekday += 1) {
    assert.ok(first.some((entry) => entry.source === 'daily' && entry.weekday === weekday));
  }
});

test('release-data validation rejects duplicate pools and Daily weekday-band violations', () => {
  const standard = {
    onboarding: [{ seed: 1, difficultyScore: 1, proof: [] }],
    easy: [{ seed: 2, difficultyScore: 10, proof: [] }],
    medium: [{ seed: 3, difficultyScore: 40, proof: [] }],
    hard: [{ seed: 4, difficultyScore: 80, proof: [] }],
  };
  const dailySchedule = [{ dailyId: '2026-01-05', seed: 100, difficultyScore: 10 }]; // Monday 0..15

  assert.doesNotThrow(() => validateReleaseData({
    standard,
    dailySchedule,
    quotas: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailyDays: 1,
    dailyScheduleStart: '2026-01-05',
  }));

  assert.throws(() => validateReleaseData({
    standard,
    dailySchedule: [{ ...dailySchedule[0], difficultyScore: 90 }],
    quotas: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailyDays: 1,
    dailyScheduleStart: '2026-01-05',
  }), /daily.*band/iu);

  assert.throws(() => validateReleaseData({
    standard,
    dailySchedule: [{ ...dailySchedule[0], seed: 1 }],
    quotas: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailyDays: 1,
    dailyScheduleStart: '2026-01-05',
  }), /overlap/iu);
});

test('full verifier uses the slow ceiling for every production seed and replays every fresh proof', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-verify-all-'));
  const asset = buildVerifiedDealAsset({
    standard: { onboarding: [11], easy: [21], medium: [31], hard: [41] },
    daily: [1001, 1002],
    dailyScheduleStart: '2026-01-01',
    audit: AUDIT,
  });
  const binaryPath = path.join(directory, 'verified-deals.bin');
  const manifestPath = path.join(directory, 'verified-deals-manifest.json');
  await writeFile(binaryPath, asset.binary);
  await writeFile(manifestPath, `${JSON.stringify(asset.manifest)}\n`);

  const solved = [];
  const replayed = [];
  const result = await verifyCatalogSeeds({
    binaryPath,
    manifestPath,
    jobs: 3,
    solveSeed: async ({ seed, budget }) => {
      solved.push([seed, budget]);
      return { status: 'SOLVED', seed, nodes: 1, proof: [{ kind: 'draw', cardIds: ['fixture'] }] };
    },
    verifyProofRecord: async (record) => {
      replayed.push(record.seed);
      return { ok: true, verification: { seed: String(record.seed), actionCount: 1, foundationCount: 52 } };
    },
    onProgress: () => {},
  });

  assert.equal(result.verified, 6);
  assert.deepEqual(solved.map(([seed]) => seed).sort((a, b) => a - b), [11, 21, 31, 41, 1001, 1002]);
  assert.ok(solved.every(([, budget]) => budget === 2_000_000));
  assert.deepEqual(replayed.sort((a, b) => a - b), [11, 21, 31, 41, 1001, 1002]);
});


test('scanRange honors bounded parallel jobs while preserving deterministic seed output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-parallel-scan-'));
  let active = 0;
  let maxActive = 0;
  const result = await scanRange({
    startSeed: 200,
    maxSeeds: 6,
    checkpointPath: path.join(directory, 'checkpoint.json'),
    outputPath: path.join(directory, 'candidates.jsonl'),
    jobs: 3,
    batchSize: 6,
    solveSeed: async ({ seed }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, (206 - seed) * 2));
      active -= 1;
      return { status: 'UNSOLVABLE', seed, nodes: 1 };
    },
  });

  assert.equal(result.scannedCount, 6);
  assert.ok(maxActive >= 2 && maxActive <= 3, `expected bounded concurrency, got ${maxActive}`);
  const lines = (await (await import('node:fs/promises')).readFile(path.join(directory, 'candidates.jsonl'), 'utf8'))
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((record) => record.seed), [200, 201, 202, 203, 204, 205]);
});


test('deal report summarizes catalog counts and detects zero cross-pool duplicates', () => {
  const manifest = {
    standardCounts: { onboarding: 1, easy: 2, medium: 3, hard: 4 },
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: 7,
    verifiedCount: 17,
    rejectedVerificationCount: 2,
    sourceScanRanges: [{ source: 'standard', startSeed: 1, maxSeeds: 20 }],
  };
  const report = buildDealReport({
    manifest,
    standardSeeds: { onboarding: [1], easy: [2, 3], medium: [4, 5, 6], hard: [7, 8, 9, 10] },
    dailySeeds: [101, 102, 103, 104, 105, 106, 107],
    standardCandidates: [],
    dailyCandidates: [],
  });

  assert.match(report, /standard onboarding=1 easy=2 medium=3 hard=4 total=10/iu);
  assert.match(report, /daily length=7 start=2026-01-01/iu);
  assert.match(report, /crossPoolDuplicates=0/iu);
  assert.match(report, /rejectedVerification=2/iu);
});

test('package exposes the stable verified-deal release commands', async () => {
  const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['deals:build-solver'], 'node tools/deals/build-solver.mjs');
  assert.equal(pkg.scripts['deals:generate'], 'node tools/deals/generate.mjs');
  assert.equal(pkg.scripts['deals:verify-sample'], 'node --test tests/verified-proof-sample.test.ts');
  assert.equal(pkg.scripts['deals:verify-all'], 'node tools/deals/verify-all.mjs');
  assert.equal(pkg.scripts['deals:report'], 'node tools/deals/report.mjs');
});


test('release emission validates first, writes all three production artifacts, and leaves no temp files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-release-emit-'));
  let seed = 1;
  const standard = Object.fromEntries(['onboarding', 'easy', 'medium', 'hard'].map((tier) => [
    tier,
    Array.from({ length: 2 }, () => ({ ...fakeRecord(seed++), difficultyScore: 10 })),
  ]));
  const start = Date.parse('2026-01-01T00:00:00Z');
  const dailySchedule = Array.from({ length: 56 }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    const weekday = date.getUTCDay();
    const bands = { 0: [80, 95], 1: [0, 15], 2: [10, 30], 3: [25, 45], 4: [40, 60], 5: [55, 72], 6: [68, 85] };
    const [low, high] = bands[weekday];
    return { dailyId: date.toISOString().slice(0, 10), seed: 1000 + index, difficultyScore: (low + high) / 2 };
  });
  const dailyScored = dailySchedule.map((row) => ({ ...row, proof: [{ kind: 'draw', cardIds: [`seed-${row.seed}`] }] }));
  const output = {
    binary: path.join(directory, 'verified-deals.bin'),
    manifest: path.join(directory, 'verified-deals-manifest.json'),
    sample: path.join(directory, 'verified-proof-sample.json'),
  };

  const emitted = emitReleaseCatalog({
    standard,
    dailyScored,
    dailySchedule,
    quotas: { onboarding: 2, easy: 2, medium: 2, hard: 2 },
    dailyDays: 56,
    dailyScheduleStart: '2026-01-01',
    standardCheckpoint: { startSeed: 1, scannedCount: 10, rejectedVerificationCount: 1 },
    dailyCheckpoint: { startSeed: 1_000_000_001, scannedCount: 70, rejectedVerificationCount: 2 },
    output,
    proofSampleTarget: 64,
  });

  assert.equal(emitted.manifest.verifiedCount, 64);
  assert.equal(JSON.parse(await (await import('node:fs/promises')).readFile(output.sample, 'utf8')).length, 64);
  for (const file of Object.values(output)) {
    assert.equal((await import('node:fs')).existsSync(file), true);
    assert.equal((await import('node:fs')).existsSync(`${file}.tmp`), false);
  }
});
