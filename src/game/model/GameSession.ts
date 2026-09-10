import { createDealForMode } from './deal.ts';
import { SUITS, type Deal, type Foundations, type GameMode } from './types.ts';
import { VerifiedDealCatalog } from './VerifiedDealCatalog.ts';

interface GameSessionOptions {
  readonly nextSeed?: () => bigint;
  readonly catalog: VerifiedDealCatalog;
}

function cloneDeal(deal: Deal): Deal {
  const foundations = deal.foundations === undefined
    ? undefined
    : Object.fromEntries(
        SUITS.flatMap((suit) => {
          const pile = deal.foundations?.[suit];
          return pile === undefined ? [] : [[suit, [...pile]]];
        }),
      ) as Partial<Foundations>;

  return {
    seed: deal.seed,
    mode: deal.mode,
    tableau: deal.tableau.map((pile) => [...pile]),
    stock: [...deal.stock],
    ...(deal.waste === undefined ? {} : { waste: [...deal.waste] }),
    ...(deal.freeCell === undefined ? {} : { freeCell: deal.freeCell }),
    ...(foundations === undefined ? {} : { foundations }),
  };
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
  private readonly catalog: VerifiedDealCatalog;
  private activeDeal: Deal | null = null;

  constructor(options: GameSessionOptions) {
    this.nextSeed = options.nextSeed ?? createRandomDealSeed;
    this.catalog = options.catalog;
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

  startOriginal(): Deal {
    const seed = this.selectOriginalSeed();
    this.activeDeal = createDealForMode('original', seed);
    return this.activeDeal;
  }

  startStandard(seed: bigint): Deal {
    if (!this.catalog.hasStandardSeed(seed)) {
      throw new Error(`Standard seed ${seed.toString()} is not a verified Standard catalog member.`);
    }
    this.activeDeal = createDealForMode('winnable', seed);
    return this.activeDeal;
  }

  startDaily(seed: bigint): Deal {
    if (!this.catalog.hasDailySeed(seed)) {
      throw new Error(`Daily seed ${seed.toString()} is not a verified Daily catalog member.`);
    }
    this.activeDeal = createDealForMode('daily', seed);
    return this.activeDeal;
  }

  resume(deal: Deal): Deal {
    this.activeDeal = cloneDeal(deal);
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
      if (candidate !== this.currentSeed) return candidate;
    }
    return nonZeroUint64((this.currentSeed ?? 0n) + 1n);
  }
}
