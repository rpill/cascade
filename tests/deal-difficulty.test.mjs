import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isOnboardingCandidate,
  measureProof,
  partitionStandard,
  scorePopulation,
} from '../tools/deals/difficulty.mjs';

const draw = (ids) => ({ kind: 'draw', cardIds: ids });
const autoFoundation = (cardId = 'clubs-1') => ({
  kind: 'to-foundation', source: { zone: 'waste' }, cardId, suit: 'clubs', automatic: true,
});
const foundation = (cardId = 'clubs-2') => ({
  kind: 'to-foundation', source: { zone: 'waste' }, cardId, suit: 'clubs',
});

test('measureProof counts player decisions, rearrangements, free-cell touches, stock interleaves and early progress', () => {
  const proof = [
    draw(['a', 'b', 'c']),                    // decision 1
    autoFoundation('clubs-1'),               // foundation 1, automatic
    { kind: 'waste-to-tableau', cardId: 'x', destinationPile: 1 }, // decision 2, rearrange, interleave
    { kind: 'to-free', source: { zone: 'waste' }, cardId: 'y' },    // decision 3, rearrange, free, interleave
    foundation('clubs-2'),                   // decision 4, foundation 2, interleave
    { kind: 'free-to-tableau', cardId: 'y', destinationPile: 2 },   // decision 5, rearrange, free, interleave
    draw(['d', 'e', 'f']),                    // decision 6, stock fully traversed
    { kind: 'tableau-to-tableau', sourcePile: 0, startCardId: 'z', destinationPile: 3 }, // decision 7, rearrange
    autoFoundation('diamonds-1'),             // foundation 3, automatic
    foundation('clubs-3'),                   // decision 8, foundation 4
    foundation('clubs-4'),                   // decision 9
  ];

  assert.deepEqual(measureProof(proof, 6), {
    decisionActions: 9,
    rearrangementMoves: 4,
    freeCellTouches: 2,
    stockInterleaves: 4,
    earlyProgressActions: 8,
  });
});

test('scorePopulation uses average-rank percentiles, v1 weights, and log1p solver input', () => {
  const records = [10, 100, 1000, 10_000, 100_000].map((nodes, index) => ({
    seed: index + 1,
    nodes,
    initialStockCount: 24,
    proof: [
      ...Array.from({ length: index + 1 }, (_, drawIndex) => draw([`d${index}-${drawIndex}`])),
      ...Array.from({ length: index + 1 }, (_, moveIndex) => ({
        kind: 'tableau-to-tableau', sourcePile: 0, startCardId: `m${index}-${moveIndex}`, destinationPile: 1,
      })),
      ...Array.from({ length: index + 1 }, (_, freeIndex) => ({
        kind: 'to-free', source: { zone: 'tableau', pile: 0 }, cardId: `f${index}-${freeIndex}`,
      })),
      ...Array.from({ length: 4 }, (_, foundationIndex) => foundation(`clubs-${foundationIndex + 1}`)),
    ],
  }));

  const scored = scorePopulation(records);
  assert.deepEqual(scored.map((record) => record.difficultyScore), [0, 25, 50, 75, 100]);
  assert.ok(scored.every((record, index) => record.difficultyInputs.solverNodes === Math.log1p(records[index].nodes)));
  assert.deepEqual(scored.map((record) => record.difficultyPercentiles.solverNodes), [0, 25, 50, 75, 100]);
});

test('scorePopulation gives tied metric values their average percentile rank', () => {
  const records = [
    { seed: 1, nodes: 10, initialStockCount: 24, proof: [foundation(), foundation(), foundation(), foundation()] },
    { seed: 2, nodes: 10, initialStockCount: 24, proof: [foundation(), foundation(), foundation(), foundation()] },
    { seed: 3, nodes: 1000, initialStockCount: 24, proof: [draw(['a']), foundation(), foundation(), foundation(), foundation()] },
  ];
  const scored = scorePopulation(records);
  assert.equal(scored[0].difficultyPercentiles.solverNodes, 25);
  assert.equal(scored[1].difficultyPercentiles.solverNodes, 25);
  assert.equal(scored[2].difficultyPercentiles.solverNodes, 100);
});

test('onboarding filter and Standard partitioning are deterministic and disjoint', () => {
  const make = (seed, score, free = score, rearrange = score, early = score) => ({
    seed,
    difficultyScore: score,
    difficultyPercentiles: {
      solverNodes: score,
      rearrangementMoves: rearrange,
      freeCellTouches: free,
      stockInterleaves: score,
      decisionActions: score,
      earlyProgressActions: early,
    },
  });
  const records = [
    make(5, 10), make(3, 10), make(4, 15),
    make(10, 25), make(11, 35), make(12, 45), make(13, 55), make(14, 65), make(15, 75), make(16, 85),
    make(99, 100),
  ];

  assert.equal(isOnboardingCandidate(records[0]), true);
  assert.equal(isOnboardingCandidate(make(77, 21)), false);
  assert.equal(isOnboardingCandidate(make(78, 10, 36)), false);

  const partitions = partitionStandard(records, { onboarding: 2, easy: 2, medium: 2, hard: 2 });
  assert.deepEqual(partitions.onboarding.map((record) => record.seed), [3, 5]);
  const allSeeds = Object.values(partitions).flat().map((record) => record.seed);
  assert.equal(new Set(allSeeds).size, allSeeds.length);
  assert.equal(allSeeds.includes(99), false, 'top >95 difficulty tail is excluded');
});

test('partitionStandard refuses to weaken quotas when too few eligible candidates exist', () => {
  const record = {
    seed: 1,
    difficultyScore: 10,
    difficultyPercentiles: {
      solverNodes: 10, rearrangementMoves: 10, freeCellTouches: 10,
      stockInterleaves: 10, decisionActions: 10, earlyProgressActions: 10,
    },
  };
  assert.throws(
    () => partitionStandard([record], { onboarding: 1, easy: 1, medium: 0, hard: 0 }),
    /quota/iu,
  );
});
