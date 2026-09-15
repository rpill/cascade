import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, normalizeMetaSave, META_SAVE_VERSION } from '../src/meta/MetaSave.ts';

test('new Cascade profile uses clean mastery product schema', () => {
  const state = createDefaultMetaSave();
  assert.equal(state.version, META_SAVE_VERSION);
  assert.equal(META_SAVE_VERSION, 8);
  assert.equal(state.standard.selectedDifficulty, 'easy');
  assert.deepEqual(state.standard.completed, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.deepEqual(state.mastery, { rank: 'novice', stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } });
  assert.deepEqual(state.futurePrestige, { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: [] });
  assert.equal(state.progression.coins, 0);
  assert.deepEqual(state.claimedRewardKeys, []);
  assert.ok(state.collection.ownedThemes.includes('walnut_study'));
  assert.equal('totalXp' in state.progression, false);
  assert.equal('standardDifficulty' in state, false);
});

test('unpublished legacy profiles reset instead of migrating', () => {
  const legacy = { version: 7, progression: { totalXp: 900, coins: 999 } };
  assert.deepEqual(normalizeMetaSave(legacy), createDefaultMetaSave());
});

test('current schema normalizes selected difficulty and reward ledgers', () => {
  const raw = structuredClone(createDefaultMetaSave()) as any;
  raw.standard.selectedDifficulty = 'hard';
  raw.standard.recentSeeds = ['1', '1', '2'];
  raw.progression.coins = 42;
  raw.claimedRewardKeys = ['a', 'a', 'b'];
  const state = normalizeMetaSave(raw);
  assert.equal(state.standard.selectedDifficulty, 'hard');
  assert.deepEqual(state.standard.recentSeeds, ['1', '2']);
  assert.equal(state.progression.coins, 42);
  assert.deepEqual(state.claimedRewardKeys, ['a', 'b']);
});
