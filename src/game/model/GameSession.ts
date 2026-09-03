import { createDealForMode } from './deal.ts';
import type { Deal, GameMode } from './types.ts';
import { WINNABLE_SEEDS } from './winnableSeeds.ts';

interface GameSessionOptions {
  readonly nextSeed?: () => bigint;
  readonly winnableSeeds?: readonly bigint[];
}

function nonZeroUint64(value: bigint): bigint {
  return BigInt.asUintN(64, value) || 1n;
}

export function createRandomDealSeed(): bigint {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues !== undefined) {
    const words = cryptoApi.getRandomValues(new Uint32Array(2));
    return nonZeroUint64((BigInt(words[0]) << 32n) | BigInt(words[1]));
  }

  const time = BigInt(Date.now());
  const random = BigInt(Math.floor(Math.random() * 0x1_0000_0000));
  return nonZeroUint64((time << 32n) ^ random);
}

export class GameSession {
  private readonly nextSeed: () => bigint;
  private readonly winnableSeeds: readonly bigint[];
  private activeDeal: Deal | null = null;

  constructor(options: GameSessionOptions = {}) {
    this.nextSeed = options.nextSeed ?? createRandomDealSeed;
    this.winnableSeeds = options.winnableSeeds ?? WINNABLE_SEEDS;
  }

  get currentMode(): GameMode | null {
    return this.activeDeal?.mode ?? null;
  }

  get currentSeed(): bigint | null {
    return this.activeDeal?.seed ?? null;
  }

  get currentDeal(): Deal | null {
    return this.activeDeal;
  }

  startNew(mode: GameMode): Deal {
    const seed = mode === 'winnable'
      ? this.selectWinnableSeed()
      : this.selectOriginalSeed();

    this.activeDeal = createDealForMode(mode, seed);
    return this.activeDeal;
  }

  restart(): Deal {
    if (this.activeDeal === null) {
      throw new Error('Cannot restart before starting a game.');
    }

    this.activeDeal = createDealForMode(this.activeDeal.mode, this.activeDeal.seed);
    return this.activeDeal;
  }

  private selectOriginalSeed(): bigint {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = nonZeroUint64(this.nextSeed());

      if (candidate !== this.currentSeed) {
        return candidate;
      }
    }

    return nonZeroUint64((this.currentSeed ?? 0n) + 1n);
  }

  private selectWinnableSeed(): bigint {
    if (this.winnableSeeds.length === 0) {
      throw new Error('The winnable seed pool is empty.');
    }

    if (this.winnableSeeds.some((seed) => seed <= 0n)) {
      throw new Error('The winnable seed pool contains an invalid seed.');
    }

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const entropy = nonZeroUint64(this.nextSeed());
      const candidate = this.winnableSeeds[Number(entropy % BigInt(this.winnableSeeds.length))];

      if (this.winnableSeeds.length === 1 || candidate !== this.currentSeed) {
        return candidate;
      }
    }

    return this.winnableSeeds.find((seed) => seed !== this.currentSeed)
      ?? this.winnableSeeds[0];
  }
}
