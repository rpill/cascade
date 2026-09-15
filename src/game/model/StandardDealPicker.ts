import type { StandardDifficulty, StandardPartition } from '../../meta/MetaSave.ts';

export interface StandardDealCatalogLike {
  getStandardSeeds(partition: StandardPartition): readonly bigint[];
}

export interface StandardDealSelection {
  readonly seed: bigint;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly isReplayPoolFallback: boolean;
}

export interface PickStandardDealInput {
  readonly catalog: StandardDealCatalogLike;
  readonly requestedDifficulty: StandardDifficulty;
  readonly onboardingWins: number;
  readonly completedByPartition: Readonly<Record<StandardPartition, readonly string[]>>;
  readonly recentSeeds: readonly string[];
  readonly randomIndex: (candidateCount: number) => number;
}

const ONBOARDING_WIN_TARGET = 5;

function choosePartition(
  requestedDifficulty: StandardDifficulty,
  onboardingWins: number,
): StandardPartition {
  return requestedDifficulty === 'easy' && onboardingWins < ONBOARDING_WIN_TARGET
    ? 'onboarding'
    : requestedDifficulty;
}

function excludeRecent(seeds: readonly bigint[], recentSeeds: readonly string[]): bigint[] {
  const recent = new Set(recentSeeds);
  return seeds.filter((seed) => !recent.has(seed.toString()));
}

function chooseCandidate(
  candidates: readonly bigint[],
  randomIndex: (candidateCount: number) => number,
): bigint {
  if (candidates.length === 0) throw new Error('Verified Standard candidate pool is empty.');
  const index = randomIndex(candidates.length);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    throw new RangeError(`Standard random index ${String(index)} is out of range for ${candidates.length} candidates.`);
  }
  return candidates[index];
}

export function pickStandardDeal(input: PickStandardDealInput): StandardDealSelection {
  const partition = choosePartition(input.requestedDifficulty, Math.max(0, Math.floor(input.onboardingWins)));
  const pool = input.catalog.getStandardSeeds(partition);
  if (pool.length === 0) throw new Error(`Verified Standard bucket ${partition} is empty.`);

  const completed = new Set(input.completedByPartition[partition]);
  const unseen = pool.filter((seed) => !completed.has(seed.toString()));
  const isReplayPoolFallback = unseen.length === 0;
  const preferredBase = isReplayPoolFallback ? pool : unseen;
  const nonRecent = excludeRecent(preferredBase, input.recentSeeds);
  const candidates = nonRecent.length > 0 ? nonRecent : preferredBase;

  return {
    seed: chooseCandidate(candidates, input.randomIndex),
    partition,
    difficulty: input.requestedDifficulty,
    isReplayPoolFallback,
  };
}
