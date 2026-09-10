import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readCheckpoint, scanRange } from '../tools/deals/generate.mjs';
import { verifyProofRecord } from '../tools/deals/verify-proof.mjs';

function tempPaths(directory) {
  return {
    checkpointPath: path.join(directory, 'checkpoint.json'),
    outputPath: path.join(directory, 'candidates.jsonl'),
  };
}

test('scanRange resumes without solving or appending completed seeds twice', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-deals-'));
  const paths = tempPaths(directory);
  const calls = [];

  const solveSeed = async ({ seed, budget }) => {
    calls.push([seed, budget]);
    return { status: 'UNSOLVABLE', seed, nodes: seed * 10 };
  };

  await scanRange({
    ...paths,
    startSeed: 1,
    maxSeeds: 5,
    stopAfter: 3,
    batchSize: 1,
    solveSeed,
  });

  const firstCheckpoint = readCheckpoint(paths.checkpointPath);
  assert.equal(firstCheckpoint.nextSeed, 4);
  assert.equal(firstCheckpoint.scannedCount, 3);
  assert.deepEqual(calls.map(([seed]) => seed), [1, 2, 3]);

  await scanRange({
    ...paths,
    startSeed: 1,
    maxSeeds: 5,
    batchSize: 1,
    solveSeed,
  });

  const finalCheckpoint = readCheckpoint(paths.checkpointPath);
  assert.equal(finalCheckpoint.nextSeed, 6);
  assert.equal(finalCheckpoint.scannedCount, 5);
  assert.deepEqual(calls.map(([seed]) => seed), [1, 2, 3, 4, 5]);

  const records = (await readFile(paths.outputPath, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(records.map((record) => record.seed), [1, 2, 3, 4, 5]);
});

test('scanRange retries UNDETERMINED at the slow budget and stores only the final record', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-deals-retry-'));
  const paths = tempPaths(directory);
  const calls = [];

  const solveSeed = async ({ seed, budget }) => {
    calls.push([seed, budget]);
    if (budget === 250_000) {
      return { status: 'UNDETERMINED', seed, nodes: budget };
    }
    return { status: 'UNSOLVABLE', seed, nodes: budget };
  };

  await scanRange({
    ...paths,
    startSeed: 11,
    maxSeeds: 1,
    batchSize: 1,
    solveSeed,
  });

  assert.deepEqual(calls, [[11, 250_000], [11, 2_000_000]]);
  const record = JSON.parse((await readFile(paths.outputPath, 'utf8')).trim());
  assert.equal(record.seed, 11);
  assert.equal(record.status, 'UNSOLVABLE');
  assert.equal(record.budget, 2_000_000);
  assert.equal(readCheckpoint(paths.checkpointPath).unresolvedRetryQueue.length, 0);
});

test('verifyProofRecord rejects a syntactically valid SOLVED record whose proof cannot replay', async () => {
  const result = await verifyProofRecord({
    status: 'SOLVED',
    seed: 1,
    nodes: 10,
    proof: [{ kind: 'draw', cardIds: ['clubs-2'] }],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /seed=1 action=0 kind=draw/iu);
});

test('verified candidate records persist the actual initial stock size for difficulty scoring', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-deals-stock-size-'));
  const paths = tempPaths(directory);

  await scanRange({
    ...paths,
    startSeed: 1,
    maxSeeds: 1,
    batchSize: 1,
    solveSeed: async ({ seed }) => ({ status: 'SOLVED', seed, nodes: 1, proof: [{ kind: 'draw', cardIds: ['placeholder'] }] }),
    verifyProofRecord: async () => ({ ok: true, verification: { seed: '1', actionCount: 1, foundationCount: 52 } }),
  });

  const record = JSON.parse((await readFile(paths.outputPath, 'utf8')).trim());
  assert.equal(record.initialStockCount, 24);
});

test('slow retry records report the slow budget even when the second solve finishes under the fast node count', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-deals-budget-'));
  const paths = tempPaths(directory);
  let calls = 0;

  await scanRange({
    ...paths,
    startSeed: 21,
    maxSeeds: 1,
    batchSize: 1,
    solveSeed: async ({ seed, budget }) => {
      calls += 1;
      if (calls === 1) return { status: 'UNDETERMINED', seed, nodes: budget };
      return { status: 'UNSOLVABLE', seed, nodes: 100 };
    },
  });

  const record = JSON.parse((await readFile(paths.outputPath, 'utf8')).trim());
  assert.equal(record.budget, 2_000_000);
});


test('parallel scan checkpoints completed fast-pass seeds before an interrupted slow retry and resumes only the unresolved seed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cascade-deals-parallel-resume-'));
  const paths = tempPaths(directory);
  const firstCalls = [];

  await assert.rejects(
    scanRange({
      ...paths,
      startSeed: 31,
      maxSeeds: 3,
      stopAfter: 3,
      batchSize: 3,
      jobs: 3,
      solveSeed: async ({ seed, budget }) => {
        firstCalls.push([seed, budget]);
        if (budget === 250_000 && seed === 32) return { status: 'UNDETERMINED', seed, nodes: budget };
        if (budget === 2_000_000 && seed === 32) throw new Error('simulated interrupted slow retry');
        return { status: 'UNSOLVABLE', seed, nodes: 1 };
      },
    }),
    /simulated interrupted slow retry/iu,
  );

  const afterFailure = readCheckpoint(paths.checkpointPath);
  assert.equal(afterFailure.nextSeed, 34);
  assert.equal(afterFailure.scannedCount, 2);
  assert.deepEqual(afterFailure.unresolvedRetryQueue, [32]);

  const partialRecords = (await readFile(paths.outputPath, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(partialRecords.map((record) => record.seed), [31, 33]);

  const resumeCalls = [];
  await scanRange({
    ...paths,
    startSeed: 31,
    maxSeeds: 3,
    batchSize: 3,
    jobs: 3,
    solveSeed: async ({ seed, budget }) => {
      resumeCalls.push([seed, budget]);
      return { status: 'UNSOLVABLE', seed, nodes: 1 };
    },
  });

  assert.deepEqual(resumeCalls, [[32, 2_000_000]]);
  const finalCheckpoint = readCheckpoint(paths.checkpointPath);
  assert.equal(finalCheckpoint.scannedCount, 3);
  assert.equal(finalCheckpoint.unsolvableCount, 3);
  assert.deepEqual(finalCheckpoint.unresolvedRetryQueue, []);

  const finalRecords = (await readFile(paths.outputPath, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual([...new Set(finalRecords.map((record) => record.seed))].sort((a, b) => a - b), [31, 32, 33]);
  assert.equal(finalRecords.length, 3);
});
