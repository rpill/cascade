import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRecordStandardFailure } from '../src/game/model/StandardAttemptPolicy.ts';

const base = {
  currentMode: 'winnable' as const,
  currentSeed: 22n,
  replacementMode: 'original' as const,
  replacementSeed: null,
  attemptStarted: true,
  attemptFinalized: false,
};

test('started unfinished Standard records failure when deliberately replaced', () => {
  assert.equal(shouldRecordStandardFailure(base), true);
  assert.equal(shouldRecordStandardFailure({
    ...base,
    replacementMode: 'winnable',
    replacementSeed: null,
  }), true);
  assert.equal(shouldRecordStandardFailure({
    ...base,
    replacementMode: 'daily',
    replacementSeed: 101n,
  }), true);
});

test('same-seed restart and non-replacements never count as Standard failure', () => {
  assert.equal(shouldRecordStandardFailure({
    ...base,
    replacementMode: 'winnable',
    replacementSeed: 22n,
  }), false);
  assert.equal(shouldRecordStandardFailure({ ...base, attemptStarted: false }), false);
  assert.equal(shouldRecordStandardFailure({ ...base, attemptFinalized: true }), false);
  assert.equal(shouldRecordStandardFailure({ ...base, currentMode: 'original' }), false);
  assert.equal(shouldRecordStandardFailure({ ...base, currentSeed: null }), false);
});
