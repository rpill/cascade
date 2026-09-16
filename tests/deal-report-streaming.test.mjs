import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../tools/deals/report.mjs', import.meta.url), 'utf8');

test('deal report streams multi-gigabyte candidate snapshots instead of materializing them as one string', () => {
  assert.doesNotMatch(source, /function\s+readJsonl\s*\(/u);
  assert.doesNotMatch(source, /readFileSync\((?:standardCandidatesPath|dailyCandidatesPath)/u);
  assert.match(source, /openCandidateSnapshot/u);
});
