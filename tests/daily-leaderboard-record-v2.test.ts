import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { beginDailyAttempt, completeDailyAttempt } from '../src/meta/DailyProgress.ts';

test('Daily record keeps the first ranked attempt pair while replays can improve personal best time', () => {
  let state = createDefaultMetaSave();
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', { attemptId: 'daily-a', rankingEligible: true });
  state = completeDailyAttempt(state, '2026-09-16', '2026-W38', 80_000, 52, 'daily-a').state;
  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', { attemptId: 'daily-b', rankingEligible: true });
  state = completeDailyAttempt(state, '2026-09-16', '2026-W38', 60_000, 55, 'daily-b').state;
  let record = state.daily.records['2026-09-16']!;
  assert.equal(record.bestMoves, 52);
  assert.equal(record.bestMovesTimeMs, 80_000);
  assert.equal(record.bestTimeMs, 60_000);

  state = beginDailyAttempt(state, '2026-09-16', '2026-W38', { attemptId: 'daily-c', rankingEligible: true });
  state = completeDailyAttempt(state, '2026-09-16', '2026-W38', 50_000, 40, 'daily-c').state;
  record = state.daily.records['2026-09-16']!;
  assert.equal(record.bestMoves, 52);
  assert.equal(record.bestMovesTimeMs, 80_000);
  assert.equal(record.bestTimeMs, 50_000);
});
