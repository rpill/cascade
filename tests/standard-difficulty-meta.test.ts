import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMetaOperation, type MetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

function complete(mode: 'winnable' | 'original' | 'daily', attemptId: string): MetaOperation {
  return {
    kind: 'complete',
    attemptId,
    mode,
    ...(mode === 'daily' ? { dailyId: '2026-09-10', weekId: '2026-W37' } : {}),
    elapsedMs: 5_000,
    trustedDay: '2026-09-10',
    trustedWeek: '2026-W37',
  };
}

test('standard-served remembers the tier and newest 256 unique positive uint32 seeds without changing wins', () => {
  let state = createDefaultMetaSave();
  const winsBefore = state.stats.winnable.wins;

  for (let seed = 1; seed <= 300; seed += 1) {
    state = applyMetaOperation(state, {
      kind: 'standard-served',
      seed: String(seed),
      tier: seed === 300 ? 'hard' : 'easy',
    });
  }

  assert.equal(state.stats.winnable.wins, winsBefore);
  assert.equal(state.standardDifficulty.lastServedTier, 'hard');
  assert.equal(state.standardDifficulty.recentSeeds.length, 256);
  assert.equal(state.standardDifficulty.recentSeeds[0], '45');
  assert.equal(state.standardDifficulty.recentSeeds.at(-1), '300');

  state = applyMetaOperation(state, { kind: 'standard-served', seed: '100', tier: 'medium' });
  assert.equal(state.standardDifficulty.recentSeeds.length, 256);
  assert.equal(state.standardDifficulty.recentSeeds.at(-1), '100');
  assert.equal(new Set(state.standardDifficulty.recentSeeds).size, 256);
  assert.equal(state.standardDifficulty.lastServedTier, 'medium');
});

test('standard-failed caps the hidden failure streak at three', () => {
  let state = createDefaultMetaSave();
  for (let index = 1; index <= 5; index += 1) {
    state = applyMetaOperation(state, { kind: 'standard-failed', attemptId: `attempt-${index}` });
  }
  assert.equal(state.standardDifficulty.failureStreak, 3);
});

test('only a completed Standard win resets the failure streak', () => {
  const failed = applyMetaOperation(
    applyMetaOperation(
      applyMetaOperation(createDefaultMetaSave(), { kind: 'standard-failed', attemptId: 'f1' }),
      { kind: 'standard-failed', attemptId: 'f2' },
    ),
    { kind: 'standard-failed', attemptId: 'f3' },
  );

  const afterOriginal = applyMetaOperation(failed, complete('original', 'original-win'));
  assert.equal(afterOriginal.standardDifficulty.failureStreak, 3);

  const afterDaily = applyMetaOperation(afterOriginal, complete('daily', 'daily-win'));
  assert.equal(afterDaily.standardDifficulty.failureStreak, 3);

  const afterStandard = applyMetaOperation(afterDaily, complete('winnable', 'standard-win'));
  assert.equal(afterStandard.standardDifficulty.failureStreak, 0);
});
