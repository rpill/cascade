import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCompiler,
  solverOutputPath,
} from '../tools/deals/build-solver.mjs';
import {
  parseSolverOutput,
} from '../tools/deals/solver-client.mjs';

test('resolveCompiler prefers explicit CXX over every fallback', () => {
  const result = resolveCompiler(
    { CXX: '/custom/toolchain/c++' },
    'win32',
    () => true,
  );
  assert.deepEqual(result, { command: '/custom/toolchain/c++', argsPrefix: [] });
});

test('resolveCompiler uses the known MSYS2 UCRT compiler on Windows when present', () => {
  const seen = [];
  const result = resolveCompiler({}, 'win32', (candidate) => {
    seen.push(candidate);
    return candidate === 'D:\\msys64\\ucrt64\\bin\\g++.exe';
  });
  assert.deepEqual(result, { command: 'D:\\msys64\\ucrt64\\bin\\g++.exe', argsPrefix: [] });
  assert.deepEqual(seen, ['D:\\msys64\\ucrt64\\bin\\g++.exe']);
});

test('resolveCompiler falls back to g++ and then clang++ from PATH', () => {
  const gpp = resolveCompiler({}, 'linux', (candidate) => candidate === 'g++');
  assert.deepEqual(gpp, { command: 'g++', argsPrefix: [] });

  const clang = resolveCompiler({}, 'linux', (candidate) => candidate === 'clang++');
  assert.deepEqual(clang, { command: 'clang++', argsPrefix: [] });
});

test('solverOutputPath uses the platform executable suffix', () => {
  assert.match(solverOutputPath('win32'), /sawayama_solver\.exe$/u);
  assert.match(solverOutputPath('linux'), /sawayama_solver$/u);
});

test('parseSolverOutput accepts solved and undetermined structured records', () => {
  assert.deepEqual(
    parseSolverOutput('{"status":"SOLVED","seed":7,"nodes":12,"proof":[{"kind":"draw","cardIds":["clubs-1"]}]}', 7),
    {
      status: 'SOLVED',
      seed: 7,
      nodes: 12,
      proof: [{ kind: 'draw', cardIds: ['clubs-1'] }],
    },
  );

  assert.deepEqual(
    parseSolverOutput('{"status":"UNDETERMINED","seed":9,"nodes":250000}', 9),
    { status: 'UNDETERMINED', seed: 9, nodes: 250000, proof: undefined },
  );
});

test('parseSolverOutput rejects malformed JSON and invalid numeric fields', () => {
  assert.throws(() => parseSolverOutput('not-json', 1), /invalid solver JSON/iu);
  assert.throws(
    () => parseSolverOutput('{"status":"SOLVED","seed":0,"nodes":1,"proof":[]}', 0),
    /seed/iu,
  );
  assert.throws(
    () => parseSolverOutput('{"status":"SOLVED","seed":1,"nodes":-1,"proof":[]}', 1),
    /nodes/iu,
  );
  assert.throws(
    () => parseSolverOutput('{"status":"SOLVED","seed":2,"nodes":1,"proof":[]}', 1),
    /seed mismatch/iu,
  );
});
