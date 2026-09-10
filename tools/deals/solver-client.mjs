import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function defaultSolverPath(platform = process.platform) {
  return path.join(ROOT, 'tools', platform === 'win32' ? 'sawayama_solver.exe' : 'sawayama_solver');
}

function normalizeSeed(seed) {
  let value;
  try {
    value = typeof seed === 'bigint' ? Number(seed) : Number(seed);
  } catch {
    throw new RangeError(`Invalid solver seed: ${String(seed)}`);
  }
  if (!Number.isInteger(value) || value < 1 || value > 0xffff_ffff) {
    throw new RangeError(`Invalid solver seed: ${String(seed)}`);
  }
  return value;
}

function normalizeBudget(budget) {
  const value = Number(budget);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`Invalid solver budget: ${String(budget)}`);
  }
  return value;
}

export function parseSolverOutput(text, expectedSeed) {
  let record;
  try {
    record = JSON.parse(String(text).trim());
  } catch (error) {
    throw new Error(`Invalid solver JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid solver JSON: expected an object');
  }
  if (!['SOLVED', 'UNSOLVABLE', 'UNDETERMINED'].includes(record.status)) {
    throw new Error(`Invalid solver status: ${String(record.status)}`);
  }
  if (!Number.isInteger(record.seed) || record.seed < 1 || record.seed > 0xffff_ffff) {
    throw new Error(`Invalid solver seed: ${String(record.seed)}`);
  }
  if (expectedSeed !== undefined && record.seed !== normalizeSeed(expectedSeed)) {
    throw new Error(`Solver seed mismatch: expected ${normalizeSeed(expectedSeed)}, got ${record.seed}`);
  }
  if (!Number.isSafeInteger(record.nodes) || record.nodes < 0) {
    throw new Error(`Invalid solver nodes: ${String(record.nodes)}`);
  }

  if (record.status === 'SOLVED') {
    if (!Array.isArray(record.proof) || record.proof.length === 0) {
      throw new Error('Invalid solver proof: SOLVED result requires a non-empty proof array');
    }
    return {
      status: record.status,
      seed: record.seed,
      nodes: record.nodes,
      proof: record.proof,
    };
  }

  return {
    status: record.status,
    seed: record.seed,
    nodes: record.nodes,
    proof: undefined,
  };
}

export async function solveSeed({ seed, budget, solverPath } = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const normalizedBudget = normalizeBudget(budget);
  const executable = solverPath || process.env.CASCADE_SOLVER || defaultSolverPath();

  const { stdout, stderr, code } = await new Promise((resolve, reject) => {
    const child = spawn(executable, [
      '--seed', String(normalizedSeed),
      '--budget', String(normalizedBudget),
      '--proof-json',
    ], {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, code }));
  });

  const parsed = parseSolverOutput(stdout, normalizedSeed);
  const expectedExit = parsed.status === 'SOLVED' ? 0 : parsed.status === 'UNSOLVABLE' ? 3 : 4;
  if (code !== expectedExit) {
    throw new Error(
      `Solver exit mismatch for seed ${normalizedSeed}: status=${parsed.status} expected=${expectedExit} actual=${code}; stderr=${stderr.trim()}`,
    );
  }

  return parsed;
}
