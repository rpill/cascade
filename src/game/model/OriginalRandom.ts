const MASK_64 = (1n << 64n) - 1n;
const MIX_MULTIPLIER_1 = 18_397_679_294_719_823_053n;
const MIX_MULTIPLIER_2 = 14_181_476_777_654_086_739n;

function uint64(value: bigint): bigint {
  return value & MASK_64;
}

function mixSeed(value: bigint): bigint {
  let result = uint64(value);
  result ^= result >> 33n;
  result = uint64(result * MIX_MULTIPLIER_1);
  result ^= result >> 33n;
  result = uint64(result * MIX_MULTIPLIER_2);
  result ^= result >> 33n;
  return uint64(result);
}

export type DealSeed = bigint;
export type DealSeedInput = DealSeed | number | string;

export function normalizeDealSeed(seed: DealSeedInput): DealSeed {
  if (typeof seed === 'bigint') {
    const normalized = uint64(seed);

    if (normalized === 0n) {
      throw new RangeError('Deal seed must be a non-zero 64-bit integer.');
    }

    return normalized;
  }

  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError('Numeric deal seed must be a safe integer.');
    }

    return normalizeDealSeed(BigInt(seed));
  }

  if (/^(?:0x[0-9a-f]+|[0-9]+)$/iu.test(seed)) {
    return normalizeDealSeed(BigInt(seed));
  }

  let hash = 14_695_981_039_346_656_037n;

  for (const character of seed) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = uint64(hash * 1_099_511_628_211n);
  }

  return normalizeDealSeed(hash || 1n);
}

/** The exact 64-bit generator used by The Zachtronics Solitaire Collection. */
export class OriginalRandom {
  private state0: bigint;
  private state1: bigint;

  constructor(seed: DealSeedInput) {
    const normalized = normalizeDealSeed(seed);
    this.state0 = mixSeed(normalized);
    this.state1 = mixSeed(this.state0);
  }

  nextUint64(): bigint {
    let x = this.state0;
    const y = this.state1;

    this.state0 = y;
    x = uint64(x ^ uint64(x << 23n));
    x ^= x >> 17n;
    x ^= y;
    x ^= y >> 26n;
    this.state1 = uint64(x);

    return uint64(this.state0 + this.state1);
  }

  nextInt(exclusiveMaximum: number): number {
    if (!Number.isSafeInteger(exclusiveMaximum) || exclusiveMaximum <= 0) {
      throw new RangeError('Random upper bound must be a positive safe integer.');
    }

    return Number(this.nextUint64() % BigInt(exclusiveMaximum));
  }
}
