export type StandardTier = 'onboarding' | 'easy' | 'medium' | 'hard';

export interface VerifiedDealSourceScanRange {
  readonly source: string;
  readonly startSeed: number;
  readonly maxSeeds: number;
}

export interface VerifiedDealManifest {
  readonly catalogVersion: number;
  readonly difficultyModelVersion: 1;
  readonly dailyAlgorithmVersion: 2;
  readonly solverSourceHash: string;
  readonly gameRulesSourceHash: string;
  readonly standardCounts: Readonly<Record<StandardTier, number>>;
  readonly dailyScheduleStart: string;
  readonly dailyScheduleLength: number;
  readonly fastNodeBudget: 250000;
  readonly slowNodeBudget: 2000000;
  readonly sourceScanRanges: readonly VerifiedDealSourceScanRange[];
  readonly verifiedCount: number;
  readonly rejectedVerificationCount: number;
  readonly crossPoolDuplicateCount: 0;
  readonly productionAssetHash: string;
  readonly offsets: Readonly<Record<StandardTier | 'daily', { readonly byteOffset: number; readonly count: number }>>;
}

const STANDARD_TIERS: readonly StandardTier[] = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const MAX_UINT32 = 0xffff_ffff;
const UINT32_BYTES = 4;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireDailyId(value: unknown): string {
  const text = requireString(value, 'dailyScheduleStart');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) throw new Error(`Invalid dailyScheduleStart: ${text}`);
  const millis = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== text) {
    throw new Error(`Invalid dailyScheduleStart: ${text}`);
  }
  return text;
}

function requireHash(value: unknown, label: string): string {
  const hash = requireString(value, label);
  if (!/^[a-f0-9]{64}$/iu.test(hash) && !/^[a-zA-Z0-9_-]+$/u.test(hash)) {
    throw new Error(`${label} must be a SHA-256 or stable source hash`);
  }
  return hash;
}

function parseManifest(raw: unknown): VerifiedDealManifest {
  if (!isObject(raw)) throw new Error('Verified deal manifest must be an object');
  if (raw.difficultyModelVersion !== 1) throw new Error('Unsupported difficultyModelVersion');
  if (raw.dailyAlgorithmVersion !== 2) throw new Error('Unsupported dailyAlgorithmVersion');
  if (raw.fastNodeBudget !== 250000) throw new Error('Unexpected fastNodeBudget');
  if (raw.slowNodeBudget !== 2000000) throw new Error('Unexpected slowNodeBudget');
  if (raw.crossPoolDuplicateCount !== 0) throw new Error('crossPoolDuplicateCount must be 0');

  if (!isObject(raw.standardCounts)) throw new Error('standardCounts must be an object');
  if (!isObject(raw.offsets)) throw new Error('offsets must be an object');

  const standardCounts = {} as Record<StandardTier, number>;
  const offsets = {} as Record<StandardTier | 'daily', { byteOffset: number; count: number }>;
  for (const tier of STANDARD_TIERS) {
    standardCounts[tier] = requireInteger(raw.standardCounts[tier], `standardCounts.${tier}`);
  }
  for (const name of [...STANDARD_TIERS, 'daily'] as const) {
    const offset = raw.offsets[name];
    if (!isObject(offset)) throw new Error(`offsets.${name} must be an object`);
    offsets[name] = {
      byteOffset: requireInteger(offset.byteOffset, `offsets.${name}.byteOffset`),
      count: requireInteger(offset.count, `offsets.${name}.count`),
    };
    if (offsets[name].byteOffset % UINT32_BYTES !== 0) throw new Error(`offsets.${name}.byteOffset must be uint32-aligned`);
  }

  const sourceScanRanges: VerifiedDealSourceScanRange[] = [];
  if (raw.sourceScanRanges !== undefined) {
    if (!Array.isArray(raw.sourceScanRanges)) throw new Error('sourceScanRanges must be an array');
    for (const [index, range] of raw.sourceScanRanges.entries()) {
      if (!isObject(range)) throw new Error(`sourceScanRanges[${index}] must be an object`);
      sourceScanRanges.push(Object.freeze({
        source: requireString(range.source, `sourceScanRanges[${index}].source`),
        startSeed: requireInteger(range.startSeed, `sourceScanRanges[${index}].startSeed`, 1),
        maxSeeds: requireInteger(range.maxSeeds, `sourceScanRanges[${index}].maxSeeds`, 1),
      }));
    }
  }

  const productionAssetHash = requireHash(raw.productionAssetHash, 'productionAssetHash');
  if (!/^[a-f0-9]{64}$/iu.test(productionAssetHash)) throw new Error('productionAssetHash must be a SHA-256 hex digest');

  return Object.freeze({
    catalogVersion: requireInteger(raw.catalogVersion, 'catalogVersion', 1),
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 2,
    solverSourceHash: requireHash(raw.solverSourceHash, 'solverSourceHash'),
    gameRulesSourceHash: requireHash(raw.gameRulesSourceHash, 'gameRulesSourceHash'),
    standardCounts: Object.freeze(standardCounts),
    dailyScheduleStart: requireDailyId(raw.dailyScheduleStart),
    dailyScheduleLength: requireInteger(raw.dailyScheduleLength, 'dailyScheduleLength'),
    fastNodeBudget: 250000,
    slowNodeBudget: 2000000,
    sourceScanRanges: Object.freeze(sourceScanRanges),
    verifiedCount: requireInteger(raw.verifiedCount, 'verifiedCount'),
    rejectedVerificationCount: requireInteger(raw.rejectedVerificationCount, 'rejectedVerificationCount'),
    crossPoolDuplicateCount: 0,
    productionAssetHash,
    offsets: Object.freeze(Object.fromEntries(
      Object.entries(offsets).map(([key, value]) => [key, Object.freeze(value)]),
    )) as VerifiedDealManifest['offsets'],
  });
}

function readSegment(
  view: DataView,
  byteLength: number,
  name: StandardTier | 'daily',
  offset: { readonly byteOffset: number; readonly count: number },
): readonly bigint[] {
  const end = offset.byteOffset + offset.count * UINT32_BYTES;
  if (end > byteLength) throw new Error(`${name} offset/count is outside binary bounds`);
  const seeds: bigint[] = [];
  for (let index = 0; index < offset.count; index += 1) {
    const value = view.getUint32(offset.byteOffset + index * UINT32_BYTES, true);
    if (value < 1 || value > MAX_UINT32) throw new Error(`${name} seed must be a positive uint32, got ${value}`);
    seeds.push(BigInt(value));
  }
  return Object.freeze(seeds);
}

export class VerifiedDealCatalog {
  private readonly standard: Readonly<Record<StandardTier, readonly bigint[]>>;
  private readonly daily: readonly bigint[];
  private readonly standardMembership: ReadonlySet<bigint>;
  private readonly dailyMembership: ReadonlySet<bigint>;
  private readonly manifest: VerifiedDealManifest;

  private constructor(
    standard: Readonly<Record<StandardTier, readonly bigint[]>>,
    daily: readonly bigint[],
    manifest: VerifiedDealManifest,
  ) {
    this.standard = standard;
    this.daily = daily;
    this.manifest = manifest;
    this.standardMembership = new Set(STANDARD_TIERS.flatMap((tier) => [...standard[tier]]));
    this.dailyMembership = new Set(daily);
  }

  static decode(buffer: ArrayBuffer, rawManifest: unknown): VerifiedDealCatalog {
    if (!(buffer instanceof ArrayBuffer)) throw new TypeError('Verified deal binary must be an ArrayBuffer');
    const manifest = parseManifest(rawManifest);

    let expectedByteOffset = 0;
    let expectedCount = 0;
    for (const tier of STANDARD_TIERS) {
      const offset = manifest.offsets[tier];
      if (offset.byteOffset !== expectedByteOffset) throw new Error(`${tier} offset does not match required binary layout`);
      if (offset.count !== manifest.standardCounts[tier]) throw new Error(`${tier} count does not match standardCounts`);
      expectedByteOffset += offset.count * UINT32_BYTES;
      expectedCount += offset.count;
    }
    if (manifest.offsets.daily.byteOffset !== expectedByteOffset) throw new Error('daily offset does not match required binary layout');
    if (manifest.offsets.daily.count !== manifest.dailyScheduleLength) throw new Error('daily count does not match dailyScheduleLength');
    expectedByteOffset += manifest.offsets.daily.count * UINT32_BYTES;
    expectedCount += manifest.offsets.daily.count;
    if (buffer.byteLength !== expectedByteOffset) throw new Error(`binary length mismatch: expected ${expectedByteOffset}, got ${buffer.byteLength}`);
    if (manifest.verifiedCount !== expectedCount) throw new Error(`verifiedCount mismatch: expected ${expectedCount}, got ${manifest.verifiedCount}`);

    const view = new DataView(buffer);
    const standard = {} as Record<StandardTier, readonly bigint[]>;
    const standardSeen = new Set<bigint>();
    for (const tier of STANDARD_TIERS) {
      const seeds = readSegment(view, buffer.byteLength, tier, manifest.offsets[tier]);
      for (const seed of seeds) {
        if (standardSeen.has(seed)) throw new Error(`Duplicate Standard seed ${seed.toString()}`);
        standardSeen.add(seed);
      }
      standard[tier] = seeds;
    }

    const daily = readSegment(view, buffer.byteLength, 'daily', manifest.offsets.daily);
    const dailySeen = new Set<bigint>();
    for (const seed of daily) {
      if (dailySeen.has(seed)) throw new Error(`Duplicate Daily seed ${seed.toString()}`);
      if (standardSeen.has(seed)) throw new Error(`Standard/Daily seed overlap at ${seed.toString()}`);
      dailySeen.add(seed);
    }

    return new VerifiedDealCatalog(Object.freeze(standard), daily, manifest);
  }

  getStandardSeeds(tier: StandardTier): readonly bigint[] {
    return this.standard[tier];
  }

  hasStandardSeed(seed: bigint): boolean {
    return this.standardMembership.has(seed);
  }

  getDailySeedByOffset(dayOffset: number): bigint {
    if (!Number.isSafeInteger(dayOffset) || dayOffset < 0 || dayOffset >= this.daily.length) {
      throw new RangeError(`Daily offset out of range: ${String(dayOffset)}`);
    }
    return this.daily[dayOffset];
  }

  hasDailySeed(seed: bigint): boolean {
    return this.dailyMembership.has(seed);
  }

  get metadata(): VerifiedDealManifest {
    return this.manifest;
  }
}
