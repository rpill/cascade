import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'tools', 'sawayama_solver.cpp'), 'utf8');

test('solver DFS does not recurse on the process call stack', () => {
  assert.doesNotMatch(
    source,
    /bool\s+dfs_solve\s*\([\s\S]*?dfs_solve\s*\(/u,
    'recursive dfs_solve can overflow the smaller default Windows process stack on deep deals',
  );
});
