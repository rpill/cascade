import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeDailyScored,
  analyzeStandardScored,
  openCandidateSnapshot,
  probeResultExitCode,
  scaledStandardQuotas,
} from '../tools/deals/probe.mjs';

test('candidate snapshot ignores an in-progress trailing JSONL record without modifying the file', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cascade-deal-probe-'));
  const candidatePath = path.join(root, 'candidates.jsonl');
  const complete = JSON.stringify({
    seed: 1,
    status: 'SOLVED',
    nodes: 10,
    initialStockCount: 24,
    proof: [{ kind: 'draw', cardIds: [1] }],
    verification: { ok: true },
  });
  const partial = '{"seed":2,"status":"SOLVED","proof":[';
  const original = `${complete}\n${partial}`;
  writeFileSync(candidatePath, original, 'utf8');

  const snapshot = await openCandidateSnapshot(candidatePath);
  try {
    assert.equal(snapshot.scannedCount, 1);
    assert.equal(snapshot.records.length, 1);
    assert.ok(snapshot.ignoredTrailingBytes > 0);
    assert.deepEqual(snapshot.records[0].proof, [{ kind: 'draw', cardIds: [1] }]);
    assert.equal(readFileSync(candidatePath, 'utf8'), original);
  } finally {
    snapshot.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('standard probe reports exact scaled quotas and readiness', () => {
  assert.deepEqual(scaledStandardQuotas(25_000), {
    onboarding: 500,
    easy: 8_167,
    medium: 9_528,
    hard: 6_805,
  });
  assert.deepEqual(scaledStandardQuotas(40_000), {
    onboarding: 500,
    easy: 13_167,
    medium: 15_361,
    hard: 10_972,
  });

  const scored = [
    { seed: 1, difficultyScore: 10, difficultyPercentiles: { freeCellTouches: 10, rearrangementMoves: 10, earlyProgressActions: 10 } },
    { seed: 2, difficultyScore: 30, difficultyPercentiles: { freeCellTouches: 50, rearrangementMoves: 50, earlyProgressActions: 50 } },
    { seed: 3, difficultyScore: 50, difficultyPercentiles: { freeCellTouches: 50, rearrangementMoves: 50, earlyProgressActions: 50 } },
    { seed: 4, difficultyScore: 70, difficultyPercentiles: { freeCellTouches: 50, rearrangementMoves: 50, earlyProgressActions: 50 } },
    { seed: 5, difficultyScore: 99, difficultyPercentiles: { freeCellTouches: 99, rearrangementMoves: 99, earlyProgressActions: 99 } },
  ];

  const result = analyzeStandardScored(scored, { onboarding: 1, easy: 1, medium: 1, hard: 1 });
  assert.equal(result.ready, true);
  assert.equal(result.verified, 5);
  assert.equal(result.eligibleAtOrBelow95, 4);
  assert.equal(result.onboardingEligible, 1);
  assert.equal(result.selected, 4);
});

test('daily probe checks the real weekday-band scheduler', () => {
  const scored = [
    { seed: 11, difficultyScore: 10 },
    { seed: 12, difficultyScore: 20 },
    { seed: 13, difficultyScore: 30 },
    { seed: 14, difficultyScore: 50 },
    { seed: 15, difficultyScore: 60 },
    { seed: 16, difficultyScore: 75 },
    { seed: 17, difficultyScore: 90 },
  ];

  const result = analyzeDailyScored(scored, { startDailyId: '2026-01-05', length: 7 });
  assert.equal(result.ready, true);
  assert.equal(result.selected, 7);
  assert.deepEqual(result.requiredByWeekday, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
});

test('NOT_READY is a diagnostic result, not a process failure', () => {
  assert.equal(probeResultExitCode({ standard: { ready: false }, daily: { ready: false } }), 0);
});
