import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/platform/yandex.ts', import.meta.url), 'utf8');

test('Yandex leaderboard rank is already one-based and is preserved by the adapter', () => {
  assert.match(source, /rank:\s*entry\.rank[,\n]/);
  assert.doesNotMatch(source, /rank:\s*entry\.rank\s*\+\s*1/);
});
