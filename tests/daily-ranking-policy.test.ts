import test from 'node:test';
import assert from 'node:assert/strict';

import { beginDailyAttempt, completeDailyAttempt } from '../src/meta/DailyProgress.ts';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, normalizeMetaSave } from '../src/meta/MetaSave.ts';

test('only the first eligible Daily attempt owns the leaderboard slot', () => {
  let state = createDefaultMetaSave();
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', {
    attemptId: 'daily-a',
    rankingEligible: true,
  });
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', {
    attemptId: 'daily-b',
    rankingEligible: true,
  });

  assert.equal(state.daily.records['2026-09-16']?.rankingAttemptId, 'daily-a');
});

test('replays may improve personal best time but never replace the first ranking result', () => {
  let state = createDefaultMetaSave();
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', {
    attemptId: 'daily-a',
    rankingEligible: true,
  });
  state = completeDailyAttempt(state, '2026-09-16', '2026-W38', 60_000, 50, 'daily-a').state;
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', {
    attemptId: 'daily-b',
    rankingEligible: true,
  });
  state = completeDailyAttempt(state, '2026-09-16', '2026-W38', 40_000, 30, 'daily-b').state;

  const record = state.daily.records['2026-09-16'];
  assert.equal(record?.bestTimeMs, 40_000);
  assert.equal(record?.bestMoves, 50);
  assert.equal(record?.bestMovesTimeMs, 60_000);
});

test('Daily hint use is persisted once per calendar deal', () => {
  const base = createDefaultMetaSave();
  const once = applyMetaOperation(base, { kind: 'daily-hint-used', dailyId: '2026-09-16' } as never);
  const twice = applyMetaOperation(once, { kind: 'daily-hint-used', dailyId: '2026-09-16' } as never);

  assert.equal(twice.daily.records['2026-09-16']?.hintUsed, true);
  assert.equal(twice.daily.records['2026-09-16']?.attempts, 0);
});

test('Daily ranking and hint metadata survive MetaSave normalization', () => {
  const state = createDefaultMetaSave();
  state.daily.records['2026-09-16'] = {
    completed: false,
    completedOnTime: false,
    attempts: 1,
    rankingAttemptId: 'daily-a',
    hintUsed: true,
  } as never;

  const normalized = normalizeMetaSave(JSON.parse(JSON.stringify(state)));
  assert.equal(normalized.daily.records['2026-09-16']?.rankingAttemptId, 'daily-a');
  assert.equal(normalized.daily.records['2026-09-16']?.hintUsed, true);
});
