import {
  VerifiedDealCatalog,
  type StandardTier,
} from './VerifiedDealCatalog.ts';

export interface StandardDirectorInput {
  readonly wins: number;
  readonly failureStreak: number;
  readonly lastServedTier: '' | StandardTier;
  readonly recentSeeds: readonly string[];
}

export interface StandardSelection {
  readonly tier: StandardTier;
  readonly seed: bigint;
}

export type NextEntropy = () => number;

type WeightedTier = readonly [tier: Exclude<StandardTier, 'onboarding'>, weight: number];

const UINT32_RANGE = 0x1_0000_0000;
const SOFTEN_PROBABILITY = 0.70;

function weightsForWins(wins: number): readonly WeightedTier[] {
  if (wins <= 5) return [['easy', 85], ['medium', 15]];
  if (wins <= 10) return [['easy', 65], ['medium', 35]];
  if (wins <= 20) return [['easy', 45], ['medium', 45], ['hard', 10]];
  if (wins <= 40) return [['easy', 30], ['medium', 50], ['hard', 20]];
  return [['easy', 25], ['medium', 45], ['hard', 30]];
}

function normalizeWins(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeFailureStreak(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0;
}

function softenTier(tier: Exclude<StandardTier, 'onboarding'>): Exclude<StandardTier, 'onboarding'> {
  if (tier === 'hard') return 'medium';
  if (tier === 'medium') return 'easy';
  return 'easy';
}

export class StandardDifficultyDirector {
  private readonly catalog: VerifiedDealCatalog;
  private readonly nextEntropy: NextEntropy;

  constructor(catalog: VerifiedDealCatalog, nextEntropy: NextEntropy) {
    this.catalog = catalog;
    this.nextEntropy = nextEntropy;
  }

  select(input: StandardDirectorInput): StandardSelection {
    const wins = normalizeWins(input.wins);
    const failureStreak = normalizeFailureStreak(input.failureStreak);

    if (wins < 3) {
      return this.selectSeed('onboarding', input.recentSeeds);
    }

    const baseWeights = weightsForWins(wins);
    const allowedWeights = input.lastServedTier === 'hard'
      ? baseWeights.filter(([tier]) => tier !== 'hard')
      : baseWeights;
    let tier = this.rollTier(allowedWeights);

    if (failureStreak >= 3) {
      tier = 'easy';
    } else if (failureStreak === 2 && this.nextUnit() < SOFTEN_PROBABILITY) {
      tier = softenTier(tier);
    }

    return this.selectSeed(tier, input.recentSeeds);
  }

  private rollTier(weights: readonly WeightedTier[]): Exclude<StandardTier, 'onboarding'> {
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) throw new Error('Standard difficulty distribution has no positive weight');
    const target = this.nextUnit() * total;
    let cumulative = 0;
    for (const [tier, weight] of weights) {
      cumulative += weight;
      if (target < cumulative) return tier;
    }
    return weights[weights.length - 1][0];
  }

  private selectSeed(tier: StandardTier, recentSeeds: readonly string[]): StandardSelection {
    const seeds = this.catalog.getStandardSeeds(tier);
    if (seeds.length === 0) throw new Error(`Verified Standard bucket ${tier} is empty`);

    const blocked = new Set(recentSeeds);
    let candidates = seeds.filter((seed) => !blocked.has(seed.toString()));

    if (candidates.length === 0) {
      for (const oldest of recentSeeds) {
        blocked.delete(oldest);
        candidates = seeds.filter((seed) => !blocked.has(seed.toString()));
        if (candidates.length > 0) break;
      }
    }

    if (candidates.length === 0) candidates = [...seeds];
    const index = Math.floor(this.nextUnit() * candidates.length);
    return { tier, seed: candidates[Math.min(index, candidates.length - 1)] };
  }

  private nextUnit(): number {
    const entropy = this.nextEntropy();
    if (!Number.isInteger(entropy) || entropy < 0 || entropy > 0xffff_ffff) {
      throw new RangeError(`Entropy must be a uint32, got ${String(entropy)}`);
    }
    return entropy / UINT32_RANGE;
  }
}
