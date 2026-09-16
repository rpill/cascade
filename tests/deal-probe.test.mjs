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
  assert.deepEqual(result.selectedScoreRanges.onboarding, { min: 10, max: 10 });
  assert.deepEqual(result.selectedScoreRanges.easy, { min: 30, max: 30 });
  assert.deepEqual(result.selectedScoreRanges.medium, { min: 50, max: 50 });
  assert.deepEqual(result.selectedScoreRanges.hard, { min: 70, max: 70 });
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


test('probe report includes selected Standard score ranges for release auditing', async () => {
  const standard = {
    ready: true,
    snapshotScanned: 10,
    verified: 10,
    snapshotBytes: 100,
    ignoredTrailingBytes: 0,
    target: 4,
    quotas: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    eligibleAtOrBelow95: 10,
    onboardingEligible: 2,
    selectedScoreRanges: {
      onboarding: { min: 1, max: 5 },
      easy: { min: 10, max: 25 },
      medium: { min: 25, max: 58 },
      hard: { min: 58, max: 95 },
    },
    reason: null,
  };
  const daily = {
    ready: true,
    snapshotScanned: 7,
    verified: 7,
    snapshotBytes: 70,
    ignoredTrailingBytes: 0,
    target: 7,
    startDailyId: '2026-01-05',
    requiredByWeekday: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
    bandCandidatesByWeekday: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
    reason: null,
  };
  const { formatProbeReport } = await import('../tools/deals/probe.mjs');
  const report = formatProbeReport({ standard, daily });
  assert.match(report, /selectedScoreRanges onboarding=1\.00\.\.5\.00 easy=10\.00\.\.25\.00 medium=25\.00\.\.58\.00 hard=58\.00\.\.95\.00/iu);
});
