import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSolver = process.platform === 'win32'
  ? path.join(ROOT, 'tools', 'sawayama_solver.exe')
  : path.join(ROOT, 'tools', 'sawayama_solver');
const solver = process.env.CASCADE_SOLVER || defaultSolver;
const APPROVED_KINDS = new Set([
  'draw',
  'tableau-to-tableau',
  'waste-to-tableau',
  'free-to-tableau',
  'to-free',
  'to-foundation',
]);

test('proof-json solver output is structured and replayable in shape', (t) => {
  if (!existsSync(solver)) {
    t.skip(`solver is not built at ${solver}`);
    return;
  }

  const result = spawnSync(solver, ['--seed', '1', '--budget', '250000', '--proof-json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(result.stdout.trim());

  assert.equal(record.status, 'SOLVED');
  assert.equal(record.seed, 1);
  assert.equal(typeof record.nodes, 'number');
  assert.ok(Number.isSafeInteger(record.nodes) && record.nodes > 0);
  assert.ok(Array.isArray(record.proof));
  assert.ok(record.proof.length > 0);
  for (const action of record.proof) {
    assert.ok(APPROVED_KINDS.has(action.kind), `unexpected action kind ${action.kind}`);
  }
});

test('proof solver keeps a difficult fast-budget search bounded enough to solve seed 5', (t) => {
  if (!existsSync(solver)) {
    t.skip(`solver is not built at ${solver}`);
    return;
  }

  const result = spawnSync(solver, ['--seed', '5', '--budget', '250000', '--proof-json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(result.stdout.trim());
  assert.equal(record.status, 'SOLVED');
  assert.equal(record.seed, 5);
  assert.ok(record.nodes <= 250000);
  assert.ok(Array.isArray(record.proof) && record.proof.length > 0);
});
