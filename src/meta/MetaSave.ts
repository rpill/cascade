import type { StandardTier } from '../game/model/VerifiedDealCatalog.ts';
import { DEFAULT_THEME_ID, isThemeId } from '../theme/ThemeRegistry.ts';
import { REWARDED_DAILY_LIMIT } from '../monetization/Products.ts';

export const META_SAVE_VERSION = 7 as const;
export const DAILY_ALGORITHM_VERSION = 2 as const;
export const WEEKLY_MILESTONES = [3, 5, 7] as const;

export interface DailyRecord {
  completed: boolean;
  bestTimeMs?: number;
  attempts: number;
}

interface CollectionState {
  ownedCardBacks: string[];
  ownedTables: string[];
  ownedThemes: string[];
}

interface EquippedState {
  cardBack: string;
  table: string;
  theme: string;
}

interface DailyState {
  algorithmVersion: number;
  records: Record<string, DailyRecord>;
}

interface WeeklyState {
  weekId: string;
  completedDailyIds: string[];
  claimedMilestones: number[];
}

interface MetaSaveV1 {
  version: 1;
  collection: CollectionState;
  equipped: EquippedState;
  achievements: string[];
  daily: DailyState;
  weekly: WeeklyState;
}

export interface ModeStats {
  played: number;
  wins: number;
  bestTimeMs?: number;
}

export interface MetaSaveV2 {
  version: 2;
  collection: CollectionState;
  equipped: EquippedState;
  achievements: string[];
  stats: {
    original: ModeStats;
    winnable: ModeStats;
  };
  daily: DailyState;
  weekly: WeeklyState;
}

export interface ProgressionState {
  totalXp: number;
  coins: number;
  lastWinDay: string;
  startedAttempts: string[];
  completedAttempts: string[];
  receipts: Record<string, number>;
}

export interface MetaSaveV3 extends Omit<MetaSaveV2, 'version'> {
  version: 3;
  progression: ProgressionState;
}

export interface StandardDifficultyState {
  readonly failureStreak: 0 | 1 | 2 | 3;
  readonly lastServedTier: '' | StandardTier;
  readonly recentSeeds: string[];
}

export interface MetaSaveV4 extends Omit<MetaSaveV3, 'version'> {
  version: 4;
  standardDifficulty: StandardDifficultyState;
}

export interface StandardWinStreakState {
  current: number;
  best: number;
}

export interface MetaSaveV5 extends Omit<MetaSaveV4, 'version'> {
  version: 5;
  standardWinStreak: StandardWinStreakState;
}

export interface MonetizationState {
  removeAds: boolean;
  creditedPurchaseTokens: string[];
  rewardedDay: string;
  rewardedCount: number;
}

export interface MetaSaveV6 extends Omit<MetaSaveV5, 'version'> {
  version: 6;
  monetization: MonetizationState;
}

export interface MetaSaveV7 extends Omit<MetaSaveV6, 'version'> {
  version: 7;
}

export type MetaSave = MetaSaveV7;
export const MAX_ECONOMY_VALUE = 1_000_000_000;

export function normalizeProgression(raw: unknown): ProgressionState {
  const value = isObject(raw) ? raw : {};
  const integer = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0
    ? Math.min(n as number, MAX_ECONOMY_VALUE) : 0;
  const receipts: Record<string, number> = {};
  if (isObject(value.receipts)) {
    for (const [id, sequence] of Object.entries(value.receipts)) {
      if (/^[a-zA-Z0-9_-]{1,100}$/.test(id) && Number.isSafeInteger(sequence) && (sequence as number) >= 0) {
        Object.defineProperty(receipts, id, {value:sequence,enumerable:true,writable:true,configurable:true});
      }
    }
  }
  return {
    totalXp: integer(value.totalXp), coins: integer(value.coins),
    lastWinDay: typeof value.lastWinDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastWinDay) ? value.lastWinDay : '',
    startedAttempts: uniqueStrings(value.startedAttempts).slice(-128),
    completedAttempts: uniqueStrings(value.completedAttempts).slice(-128), receipts,
  };
}

const STANDARD_TIERS = new Set<StandardTier>(['onboarding', 'easy', 'medium', 'hard']);
const MAX_UINT32_SEED = 0xffff_ffffn;

export function normalizeStandardDifficulty(raw: unknown): StandardDifficultyState {
  const value = isObject(raw) ? raw : {};
  const rawFailureStreak = Number.isInteger(value.failureStreak) ? value.failureStreak as number : 0;
  const failureStreak = Math.max(0, Math.min(3, rawFailureStreak)) as 0 | 1 | 2 | 3;
  const lastServedTier = typeof value.lastServedTier === 'string' && STANDARD_TIERS.has(value.lastServedTier as StandardTier)
    ? value.lastServedTier as StandardTier
    : '';

  const source = Array.isArray(value.recentSeeds) ? value.recentSeeds : [];
  const newestFirst: string[] = [];
  const seen = new Set<string>();
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const seed = source[index];
    if (typeof seed !== 'string' || !/^[1-9]\d{0,9}$/u.test(seed)) continue;
    let parsed: bigint;
    try { parsed = BigInt(seed); } catch { continue; }
    if (parsed < 1n || parsed > MAX_UINT32_SEED || seen.has(seed)) continue;
    seen.add(seed);
    newestFirst.push(seed);
    if (newestFirst.length >= 256) break;
  }

  return {
    failureStreak,
    lastServedTier,
    recentSeeds: newestFirst.reverse(),
  };
}

function createDefaultModeStats(): ModeStats {
  return { played: 0, wins: 0 };
}

export function normalizeStandardWinStreak(raw: unknown): StandardWinStreakState {
  const value = isObject(raw) ? raw : {};
  const current = Number.isSafeInteger(value.current) && (value.current as number) >= 0
    ? value.current as number
    : 0;
  const rawBest = Number.isSafeInteger(value.best) && (value.best as number) >= 0
    ? value.best as number
    : 0;
  return { current, best: Math.max(current, rawBest) };
}

export function normalizeMonetization(raw: unknown): MonetizationState {
  const value = isObject(raw) ? raw : {};
  const tokens = uniqueStrings(value.creditedPurchaseTokens)
    .filter((token) => token.length > 0 && token.length <= 512)
    .slice(-128);
  const rewardedDay = typeof value.rewardedDay === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.rewardedDay)
    ? value.rewardedDay
    : '';
  const rewardedCount = Number.isSafeInteger(value.rewardedCount)
    ? Math.max(0, Math.min(REWARDED_DAILY_LIMIT, value.rewardedCount as number))
    : 0;

  return {
    removeAds: value.removeAds === true,
    creditedPurchaseTokens: tokens,
    rewardedDay,
    rewardedCount,
  };
}

export function createDefaultMetaSave(): MetaSave {
  return {
    version: META_SAVE_VERSION,
    collection: {
      ownedCardBacks: [],
      ownedTables: [],
      ownedThemes: [DEFAULT_THEME_ID],
    },
    equipped: { cardBack: '', table: '', theme: DEFAULT_THEME_ID },
    progression: normalizeProgression(null),
    standardDifficulty: normalizeStandardDifficulty(null),
    standardWinStreak: normalizeStandardWinStreak(null),
    monetization: normalizeMonetization(null),
    achievements: [],
    stats: {
      original: createDefaultModeStats(),
      winnable: createDefaultModeStats(),
    },
    daily: { algorithmVersion: DAILY_ALGORITHM_VERSION, records: {} },
    weekly: { weekId: '', completedDailyIds: [], claimedMilestones: [] },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function normalizeDailyRecord(value: unknown): DailyRecord | null {
  if (!isObject(value)) return null;

  const attempts = value.attempts;
  const completed = value.completed;
  const bestTimeMs = value.bestTimeMs;

  if (
    !Number.isInteger(attempts)
    || (attempts as number) < 0
    || typeof completed !== 'boolean'
  ) {
    return null;
  }

  if (
    bestTimeMs !== undefined
    && (typeof bestTimeMs !== 'number' || !Number.isFinite(bestTimeMs) || bestTimeMs <= 0)
  ) {
    return null;
  }

  return {
    completed,
    attempts: attempts as number,
    ...(bestTimeMs === undefined ? {} : { bestTimeMs }),
  };
}

function normalizeCollection(value: unknown): CollectionState {
  if (!isObject(value)) {
    return { ownedCardBacks: [], ownedTables: [], ownedThemes: [] };
  }

  return {
    ownedCardBacks: uniqueStrings(value.ownedCardBacks),
    ownedTables: uniqueStrings(value.ownedTables),
    ownedThemes: uniqueStrings(value.ownedThemes),
  };
}

function normalizeEquipped(value: unknown): EquippedState {
  if (!isObject(value)) {
    return { cardBack: '', table: '', theme: '' };
  }

  return {
    cardBack: typeof value.cardBack === 'string' ? value.cardBack : '',
    table: typeof value.table === 'string' ? value.table : '',
    theme: typeof value.theme === 'string' ? value.theme : '',
  };
}

function normalizeDaily(value: unknown): DailyState {
  const daily = isObject(value) ? value : {};
  const rawRecords = isObject(daily.records) ? daily.records : {};
  const records: Record<string, DailyRecord> = {};

  for (const [id, recordValue] of Object.entries(rawRecords)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) continue;
    const record = normalizeDailyRecord(recordValue);
    if (record !== null) records[id] = record;
  }

  return {
    algorithmVersion: DAILY_ALGORITHM_VERSION,
    records,
  };
}

function normalizeWeekly(value: unknown): WeeklyState {
  const weekly = isObject(value) ? value : {};
  const claimedMilestones = Array.isArray(weekly.claimedMilestones)
    ? [...new Set(weekly.claimedMilestones.filter(
        (milestone): milestone is 3 | 5 | 7 => milestone === 3 || milestone === 5 || milestone === 7,
      ))]
    : [];

  return {
    weekId: typeof weekly.weekId === 'string' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(weekly.weekId) ? weekly.weekId : '',
    completedDailyIds: uniqueStrings(weekly.completedDailyIds)
      .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)),
    claimedMilestones,
  };
}

function normalizeModeStats(value: unknown): ModeStats {
  if (!isObject(value)) return createDefaultModeStats();

  const played = Number.isInteger(value.played) && (value.played as number) >= 0
    ? value.played as number
    : 0;
  const rawWins = Number.isInteger(value.wins) && (value.wins as number) >= 0
    ? value.wins as number
    : 0;
  const wins = Math.min(rawWins, played);
  const bestTimeMs = value.bestTimeMs;
  const validBest = wins > 0
    && typeof bestTimeMs === 'number'
    && Number.isFinite(bestTimeMs)
    && bestTimeMs > 0;

  return {
    played,
    wins,
    ...(validBest ? { bestTimeMs } : {}),
  };
}

function normalizeLegacyV1(raw: Record<string, unknown>): MetaSaveV1 {
  return {
    version: 1,
    collection: normalizeCollection(raw.collection),
    equipped: normalizeEquipped(raw.equipped),
    achievements: uniqueStrings(raw.achievements),
    daily: normalizeDaily(raw.daily),
    weekly: normalizeWeekly(raw.weekly),
  };
}

export function normalizeMetaSave(raw: unknown): MetaSave {
  const fallback = createDefaultMetaSave();
  if (!isObject(raw)) return fallback;

  if (raw.version === 1) {
    const legacy = normalizeLegacyV1(raw);
    return normalizeMetaSave({
      collection: legacy.collection,
      equipped: legacy.equipped,
      achievements: legacy.achievements,
      stats: fallback.stats,
      daily: legacy.daily,
      weekly: legacy.weekly,
      version: 2,
    });
  }

  if (raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== 5 && raw.version !== 6 && raw.version !== META_SAVE_VERSION) return fallback;

  const stats = isObject(raw.stats) ? raw.stats : {};
  const collection = normalizeCollection(raw.collection);
  const equipped = normalizeEquipped(raw.equipped);
  const progression = normalizeProgression(raw.version === 2 ? null : raw.progression);
  // Pre-release v6 builds could persist the 999999 development coin floor into
  // the player profile after a test purchase. Clean only that legacy sentinel;
  // v7+ balances are never rewritten by this migration.
  if (raw.version === 6 && progression.coins === 999_999) progression.coins = 0;
  collection.ownedThemes = [...new Set([DEFAULT_THEME_ID, ...collection.ownedThemes,
    ...(raw.version === 2 && isThemeId(equipped.theme) ? [equipped.theme] : []),
  ])];
  if (!isThemeId(equipped.theme) || !collection.ownedThemes.includes(equipped.theme)) equipped.theme = DEFAULT_THEME_ID;
  return {
    version: META_SAVE_VERSION,
    collection,
    equipped,
    progression,
    standardDifficulty: normalizeStandardDifficulty(raw.version === 4 || raw.version === 5 || raw.version === 6 || raw.version === 7 ? raw.standardDifficulty : null),
    standardWinStreak: normalizeStandardWinStreak(raw.version === 5 || raw.version === 6 || raw.version === 7 ? raw.standardWinStreak : null),
    monetization: normalizeMonetization(raw.version === 6 || raw.version === 7 ? raw.monetization : null),
    achievements: uniqueStrings(raw.achievements),
    stats: {
      original: normalizeModeStats(stats.original),
      winnable: normalizeModeStats(stats.winnable),
    },
    daily: normalizeDaily(raw.daily),
    weekly: normalizeWeekly(raw.weekly),
  };
}
