import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { selectProofSample } from '../tools/deals/generate.mjs';

test('selectProofSample materializes only selected proofs', () => {
  let proofReads = 0;
  let nextSeed = 1;
  const makeRecord = () => {
    const record = { seed: nextSeed++, difficultyScore: 50 };
    Object.defineProperty(record, 'proof', {
      enumerable: false,
      get() {
        proofReads += 1;
        return [{ kind: 'proof', seed: record.seed }];
      },
    });
    return record;
  };

  const standard = {
    onboarding: Array.from({ length: 100 }, makeRecord),
    easy: Array.from({ length: 100 }, makeRecord),
    medium: Array.from({ length: 100 }, makeRecord),
    hard: Array.from({ length: 100 }, makeRecord),
  };
  const dailyRecords = Array.from({ length: 700 }, makeRecord);
  const start = Date.parse('2026-01-01T00:00:00Z');
  const dailySchedule = dailyRecords.map((record, index) => ({
    dailyId: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    seed: record.seed,
    difficultyScore: record.difficultyScore,
  }));
  const dailyBySeed = new Map(dailyRecords.map((record) => [record.seed, record]));

  const sample = selectProofSample({ standard, dailySchedule, dailyBySeed, target: 64 });
  assert.equal(sample.length, 64);
  assert.equal(proofReads, 64);
});

test('scanRange resumes from a large JSONL under a constrained heap', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cascade-large-jsonl-'));
  try {
    const candidates = path.join(root, 'candidates.jsonl');
    const checkpoint = path.join(root, 'checkpoint.json');
    const padding = 'x'.repeat(64 * 1024);
    const existing = 1024;
    for (let seed = 1; seed <= existing; seed += 1) {
      appendFileSync(candidates, `${JSON.stringify({ seed, status: 'UNSOLVABLE', nodes: 1, padding })}\n`);
    }
    writeFileSync(checkpoint, `${JSON.stringify({
      version: 1,
      startSeed: 1,
      maxSeeds: 2048,
      nextSeed: existing + 1,
      scannedCount: existing,
      acceptedCount: 0,
      rejectedVerificationCount: 0,
      unsolvableCount: existing,
      undeterminedCount: 0,
      unresolvedRetryQueue: [],
    })}\n`);

    const runner = path.join(root, 'runner.mjs');
    const generateUrl = new URL('../tools/deals/generate.mjs', import.meta.url).href;
    writeFileSync(runner, `
      import { scanRange } from ${JSON.stringify(generateUrl)};
      const checkpoint = await scanRange({
        startSeed: 1,
        maxSeeds: 2048,
        checkpointPath: ${JSON.stringify(checkpoint)},
        outputPath: ${JSON.stringify(candidates)},
        stopAfter: 1,
        solveSeed: async ({ seed }) => ({ status: 'UNSOLVABLE', seed, nodes: 1 }),
        verifyProofRecord: async () => ({ ok: true }),
      });
      if (checkpoint.nextSeed !== 1026 || checkpoint.scannedCount !== 1025) process.exit(9);
    `);

    const childExecArgv = process.execArgv.filter((arg) => arg !== '--test' && !arg.startsWith('--test=') && !arg.startsWith('--max-old-space-size='));
    const result = spawnSync(process.execPath, [...childExecArgv, '--max-old-space-size=48', runner], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `child failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test('generateReleaseCatalog does not retain every parsed proof while indexing JSONL', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cascade-proof-retention-'));
  try {
    const standardCandidates = path.join(root, 'artifacts', 'deals', 'standard', 'candidates.jsonl');
    const dailyCandidates = path.join(root, 'artifacts', 'deals', 'daily', 'candidates.jsonl');
    const standardCheckpoint = path.join(root, 'artifacts', 'deals', 'standard', 'checkpoint.json');
    const dailyCheckpoint = path.join(root, 'artifacts', 'deals', 'daily', 'checkpoint.json');
    mkdirSync(path.dirname(standardCandidates), { recursive: true });
    mkdirSync(path.dirname(dailyCandidates), { recursive: true });

    const padding = 'x'.repeat(256 * 1024);
    const existing = 512;
    for (let seed = 1; seed <= existing; seed += 1) {
      appendFileSync(standardCandidates, `${JSON.stringify({
        seed,
        status: 'SOLVED',
        nodes: 1,
        budget: 1,
        initialStockCount: 0,
        proof: [padding],
        verification: { ok: true },
      })}\n`);
    }
    writeFileSync(dailyCandidates, '');
    writeFileSync(standardCheckpoint, `${JSON.stringify({
      version: 1,
      startSeed: 1,
      maxSeeds: 1_000_000_000,
      nextSeed: existing + 1,
      scannedCount: existing,
      acceptedCount: existing,
      rejectedVerificationCount: 0,
      unsolvableCount: 0,
      undeterminedCount: 0,
      unresolvedRetryQueue: [],
    })}\n`);
    writeFileSync(dailyCheckpoint, `${JSON.stringify({
      version: 1,
      startSeed: 1_000_000_001,
      maxSeeds: 3_294_967_295,
      nextSeed: 1_000_000_001,
      scannedCount: 0,
      acceptedCount: 0,
      rejectedVerificationCount: 0,
      unsolvableCount: 0,
      undeterminedCount: 0,
      unresolvedRetryQueue: [],
    })}\n`);

    const runner = path.join(root, 'runner.mjs');
    const generateUrl = new URL('../tools/deals/generate.mjs', import.meta.url).href;
    writeFileSync(runner, `
      import { generateReleaseCatalog } from ${JSON.stringify(generateUrl)};
      try {
        await generateReleaseCatalog({
          root: ${JSON.stringify(root)},
          standardTotal: 50_000,
          dailyDays: 36_525,
          jobs: 1,
          scanBatch: 1,
          solveSeed: async () => { throw new Error('REACHED_SOLVER'); },
          verifyProofRecord: async () => ({ ok: true }),
        });
      } catch (error) {
        if (error?.message === 'REACHED_SOLVER') process.exit(0);
        throw error;
      }
      process.exit(9);
    `);

    const childExecArgv = process.execArgv.filter((arg) => arg !== '--test' && !arg.startsWith('--test=') && !arg.startsWith('--max-old-space-size='));
    const result = spawnSync(process.execPath, [...childExecArgv, '--max-old-space-size=96', runner], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `child failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
