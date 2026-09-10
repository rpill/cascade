import test from 'node:test';
import assert from 'node:assert/strict';

import { StandardDifficultyDirector, type StandardDirectorInput } from '../src/game/model/StandardDifficultyDirector.ts';
import { VerifiedDealCatalog, type StandardTier, type VerifiedDealManifest } from '../src/game/model/VerifiedDealCatalog.ts';

const UINT32_RANGE = 0x1_0000_0000;
const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function catalog(overrides: Partial<Record<StandardTier, number[]>> = {}) {
  const standard: Record<StandardTier, number[]> = {
    onboarding: [101, 102],
    easy: [201, 202, 203],
    medium: [301, 302, 303],
    hard: [401, 402, 403],
    ...overrides,
  };
  const daily = [1001];
  const values = [...TIERS.flatMap((tier) => standard[tier]), ...daily];
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((seed, index) => view.setUint32(index * 4, seed, true));

  const standardCounts = {} as Record<StandardTier, number>;
  const offsets = {} as Record<StandardTier | 'daily', { byteOffset: number; count: number }>;
  let byteOffset = 0;
  for (const tier of TIERS) {
    standardCounts[tier] = standard[tier].length;
    offsets[tier] = { byteOffset, count: standard[tier].length };
    byteOffset += standard[tier].length * 4;
  }
  offsets.daily = { byteOffset, count: daily.length };

  const manifest: VerifiedDealManifest = {
    catalogVersion: 1,
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 2,
    solverSourceHash: 'solver',
    gameRulesSourceHash: 'rules',
    standardCounts,
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: daily.length,
    fastNodeBudget: 250000,
    slowNodeBudget: 2000000,
    sourceScanRanges: [],
    verifiedCount: values.length,
    rejectedVerificationCount: 0,
    crossPoolDuplicateCount: 0,
    productionAssetHash: '0'.repeat(64),
    offsets,
  };
  return VerifiedDealCatalog.decode(buffer, manifest);
}

function entropyAt(unit: number): number {
  if (unit <= 0) return 0;
  if (unit >= 1) return 0xffff_ffff;
  return Math.min(0xffff_ffff, Math.floor(unit * UINT32_RANGE));
}

function entropyQueue(...units: number[]) {
  const values = units.map(entropyAt);
  let cursor = 0;
  return () => values[cursor++] ?? 0;
}

function input(overrides: Partial<StandardDirectorInput> = {}): StandardDirectorInput {
  return {
    wins: 3,
    failureStreak: 0,
    lastServedTier: '',
    recentSeeds: [],
    ...overrides,
  };
}

function selectedTier(wins: number, tierRoll: number): string {
  const director = new StandardDifficultyDirector(catalog(), entropyQueue(tierRoll, 0));
  return director.select(input({ wins })).tier;
}

test('win-count boundaries use the approved hidden Standard distributions', () => {
  for (const wins of [0, 2]) {
    assert.equal(selectedTier(wins, 0.999), 'onboarding');
  }

  for (const wins of [3, 5]) {
    assert.equal(selectedTier(wins, 0.849999), 'easy');
    assert.equal(selectedTier(wins, 0.850001), 'medium');
  }
  for (const wins of [6, 10]) {
    assert.equal(selectedTier(wins, 0.649999), 'easy');
    assert.equal(selectedTier(wins, 0.650001), 'medium');
  }
  for (const wins of [11, 20]) {
    assert.equal(selectedTier(wins, 0.449999), 'easy');
    assert.equal(selectedTier(wins, 0.450001), 'medium');
    assert.equal(selectedTier(wins, 0.900001), 'hard');
  }
  for (const wins of [21, 40]) {
    assert.equal(selectedTier(wins, 0.299999), 'easy');
    assert.equal(selectedTier(wins, 0.300001), 'medium');
    assert.equal(selectedTier(wins, 0.800001), 'hard');
  }
  for (const wins of [41, 100]) {
    assert.equal(selectedTier(wins, 0.249999), 'easy');
    assert.equal(selectedTier(wins, 0.250001), 'medium');
    assert.equal(selectedTier(wins, 0.700001), 'hard');
  }
});

test('two failures soften the rolled tier one step with exactly seventy percent probability', () => {
  const softenedMedium = new StandardDifficultyDirector(catalog(), entropyQueue(0.50, 0.699999, 0));
  assert.equal(softenedMedium.select(input({ wins: 21, failureStreak: 2 })).tier, 'easy');

  const keptMedium = new StandardDifficultyDirector(catalog(), entropyQueue(0.50, 0.700001, 0));
  assert.equal(keptMedium.select(input({ wins: 21, failureStreak: 2 })).tier, 'medium');

  const softenedHard = new StandardDifficultyDirector(catalog(), entropyQueue(0.90, 0.10, 0));
  assert.equal(softenedHard.select(input({ wins: 41, failureStreak: 2 })).tier, 'medium');
});

test('three failures force easy, while onboarding still takes precedence', () => {
  const forced = new StandardDifficultyDirector(catalog(), entropyQueue(0.95, 0));
  assert.equal(forced.select(input({ wins: 100, failureStreak: 3 })).tier, 'easy');

  const onboarding = new StandardDifficultyDirector(catalog(), entropyQueue(0.99));
  assert.equal(onboarding.select(input({ wins: 2, failureStreak: 3, lastServedTier: 'hard' })).tier, 'onboarding');
});

test('hard is never served twice in succession and remaining weights are normalized', () => {
  // At 41+ wins, removing hard turns 25/45 into ~35.7% easy / ~64.3% medium.
  const easy = new StandardDifficultyDirector(catalog(), entropyQueue(0.35, 0));
  assert.equal(easy.select(input({ wins: 41, lastServedTier: 'hard' })).tier, 'easy');

  const medium = new StandardDifficultyDirector(catalog(), entropyQueue(0.36, 0));
  assert.equal(medium.select(input({ wins: 41, lastServedTier: 'hard' })).tier, 'medium');

  const wouldNormallyBeHard = new StandardDifficultyDirector(catalog(), entropyQueue(0.99, 0));
  assert.notEqual(wouldNormallyBeHard.select(input({ wins: 41, lastServedTier: 'hard' })).tier, 'hard');
});

test('recent seeds are rejected when another seed in the selected tier is available', () => {
  const director = new StandardDifficultyDirector(catalog(), entropyQueue(0, 0));
  const selection = director.select(input({ wins: 3, recentSeeds: ['201', '202'] }));
  assert.equal(selection.tier, 'easy');
  assert.equal(selection.seed, 203n);
});

test('when every selected-tier seed is recent, fallback releases oldest history first', () => {
  const director = new StandardDifficultyDirector(
    catalog({ easy: [201, 202] }),
    entropyQueue(0, 0.99),
  );
  const selection = director.select(input({ wins: 3, recentSeeds: ['201', '999', '202'] }));
  assert.equal(selection.tier, 'easy');
  assert.equal(selection.seed, 201n);
});

test('director rejects invalid entropy instead of falling back to Math.random', () => {
  const director = new StandardDifficultyDirector(catalog(), () => -1);
  assert.throws(() => director.select(input({ wins: 3 })), /entropy.*uint32/iu);
});
