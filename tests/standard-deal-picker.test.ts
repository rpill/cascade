import assert from 'node:assert/strict';
import test from 'node:test';

import { pickStandardDeal } from '../src/game/model/StandardDealPicker.ts';
import type { StandardPartition } from '../src/meta/MetaSave.ts';

const pools: Record<StandardPartition, readonly bigint[]> = {
  onboarding: [1n, 2n],
  easy: [11n, 12n, 13n],
  medium: [21n, 22n],
  hard: [31n, 32n],
};

const catalog = {
  getStandardSeeds(partition: StandardPartition): readonly bigint[] {
    return pools[partition];
  },
};

test('easy uses onboarding pool until five onboarding wins', () => {
  const selection = pickStandardDeal({
    catalog,
    requestedDifficulty: 'easy',
    onboardingWins: 4,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    recentSeeds: [],
    randomIndex: () => 0,
  });
  assert.deepEqual(selection, { seed: 1n, partition: 'onboarding', difficulty: 'easy', isReplayPoolFallback: false });
});

test('easy uses easy pool after onboarding is complete', () => {
  const selection = pickStandardDeal({
    catalog,
    requestedDifficulty: 'easy',
    onboardingWins: 5,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    recentSeeds: [],
    randomIndex: () => 0,
  });
  assert.equal(selection.partition, 'easy');
  assert.equal(selection.seed, 11n);
});

test('medium and hard always use the requested pool', () => {
  assert.equal(pickStandardDeal({
    catalog,
    requestedDifficulty: 'medium',
    onboardingWins: 0,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    recentSeeds: [],
    randomIndex: () => 0,
  }).partition, 'medium');
  assert.equal(pickStandardDeal({
    catalog,
    requestedDifficulty: 'hard',
    onboardingWins: 0,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    recentSeeds: [],
    randomIndex: () => 0,
  }).partition, 'hard');
});

test('prefers unseen and non-recent seeds', () => {
  const selection = pickStandardDeal({
    catalog,
    requestedDifficulty: 'easy',
    onboardingWins: 5,
    completedByPartition: { onboarding: [], easy: ['11'], medium: [], hard: [] },
    recentSeeds: ['12'],
    randomIndex: () => 0,
  });
  assert.equal(selection.seed, 13n);
  assert.equal(selection.isReplayPoolFallback, false);
});

test('replays only after every seed in the requested partition is completed', () => {
  const selection = pickStandardDeal({
    catalog,
    requestedDifficulty: 'medium',
    onboardingWins: 5,
    completedByPartition: { onboarding: [], easy: [], medium: ['21', '22'], hard: [] },
    recentSeeds: ['21'],
    randomIndex: () => 0,
  });
  assert.equal(selection.seed, 22n);
  assert.equal(selection.isReplayPoolFallback, true);
});

test('randomIndex must return a valid candidate index', () => {
  assert.throws(() => pickStandardDeal({
    catalog,
    requestedDifficulty: 'hard',
    onboardingWins: 5,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    recentSeeds: [],
    randomIndex: () => 2,
  }), /out of range/u);
});
