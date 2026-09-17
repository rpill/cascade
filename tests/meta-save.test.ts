import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, normalizeMetaSave, META_SAVE_VERSION } from '../src/meta/MetaSave.ts';

test('new Cascade profile uses the v9 mastery schema without obsolete product fields', () => {
  const state = createDefaultMetaSave();
  assert.equal(state.version, META_SAVE_VERSION);
  assert.equal(META_SAVE_VERSION, 9);
  assert.equal(state.standard.selectedDifficulty, 'easy');
  assert.deepEqual(state.standard.completed, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.deepEqual(state.mastery, { rank: 'novice', stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } });
  assert.deepEqual(state.futurePrestige, { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: [] });
  assert.deepEqual(state.progression, { startedAttempts: [], completedAttempts: [], receipts: {} });
  assert.equal('totalXp' in state.progression, false);
  assert.equal('collection' in state, false);
  assert.equal('claimedRewardKeys' in state, false);
});

test('legacy snapshots migrate into the v9 gameplay schema and discard unknown fields', () => {
  const legacy = {
    version: 8,
    achievements: ['a'],
    progression: { startedAttempts: ['attempt-1'], completedAttempts: [], receipts: { stream: 3 }, legacyNoise: 999 },
    standard: { selectedDifficulty: 'hard', recentSeeds: ['1'], completed: { onboarding: [], easy: [], medium: [], hard: [] } },
    legacyNoise: { anything: true },
  };
  const state = normalizeMetaSave(legacy);
  assert.equal(state.version, 9);
  assert.equal(state.standard.selectedDifficulty, 'hard');
  assert.deepEqual(state.progression.startedAttempts, ['attempt-1']);
  assert.equal(state.progression.receipts.stream, 3);
  assert.equal('legacyNoise' in state, false);
});

test('current schema normalizes selected difficulty, seeds and receipt ledger', () => {
  const raw = structuredClone(createDefaultMetaSave()) as any;
  raw.standard.selectedDifficulty = 'hard';
  raw.standard.recentSeeds = ['1', '1', '2'];
  raw.progression.receipts = { alpha: 2, bad: -1 };
  const state = normalizeMetaSave(raw);
  assert.equal(state.standard.selectedDifficulty, 'hard');
  assert.deepEqual(state.standard.recentSeeds, ['1', '2']);
  assert.deepEqual(state.progression.receipts, { alpha: 2 });
});
