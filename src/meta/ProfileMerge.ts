import { REWARDED_DAILY_LIMIT } from '../monetization/Products.ts';
import { DEFAULT_THEME_ID, isThemeId } from '../theme/ThemeRegistry.ts';
import {
  MAX_ECONOMY_VALUE,
  normalizeMetaSave,
  type DailyRecord,
  type MetaSave,
  type ModeStats,
} from './MetaSave.ts';

const PROFILE_MERGE_TRANSFER_KEY = 'cascadePendingProfileMerge';
const PROFILE_MERGE_TRANSFER_VERSION = 1 as const;
const MAX_PROFILE_SCOPE_LENGTH = 256;
const MAX_STATS_VALUE = Number.MAX_SAFE_INTEGER;

export interface ProfileMergeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProfileMergeTransfer {
  readonly sourceScope: string;
  readonly state: MetaSave;
}

function resolveStorage(): ProfileMergeStorage | null {
  try {
    return (globalThis as { localStorage?: ProfileMergeStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function uniqueTail(values: readonly string[], limit: number): string[] {
  return [...new Set(values)].slice(-limit);
}

function safeAdd(left: number, right: number, limit: number): number {
  return Math.min(limit, left + right);
}

function mergeBest(left?: number, right?: number): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function mergeStats(target: ModeStats, source: ModeStats): ModeStats {
  const played = safeAdd(target.played, source.played, MAX_STATS_VALUE);
  const wins = Math.min(played, safeAdd(target.wins, source.wins, MAX_STATS_VALUE));
  const bestTimeMs = mergeBest(target.bestTimeMs, source.bestTimeMs);
  return {
    played,
    wins,
    ...(bestTimeMs === undefined || wins === 0 ? {} : { bestTimeMs }),
  };
}

function mergeDailyRecord(target: DailyRecord | undefined, source: DailyRecord | undefined): DailyRecord | undefined {
  if (target === undefined) return source === undefined ? undefined : { ...source };
  if (source === undefined) return { ...target };
  const bestTimeMs = mergeBest(target.bestTimeMs, source.bestTimeMs);
  return {
    completed: target.completed || source.completed,
    attempts: safeAdd(target.attempts, source.attempts, MAX_STATS_VALUE),
    ...(bestTimeMs === undefined ? {} : { bestTimeMs }),
  };
}

function mergeReceipts(target: Record<string, number>, source: Record<string, number>): Record<string, number> {
  const merged = { ...target };
  for (const [key, sequence] of Object.entries(source)) {
    merged[key] = Math.max(merged[key] ?? 0, sequence);
  }
  return merged;
}

function mergeWeekly(target: MetaSave['weekly'], source: MetaSave['weekly']): MetaSave['weekly'] {
  if (target.weekId === source.weekId) {
    return {
      weekId: target.weekId,
      completedDailyIds: [...new Set([...target.completedDailyIds, ...source.completedDailyIds])],
      claimedMilestones: [...new Set([...target.claimedMilestones, ...source.claimedMilestones])],
    };
  }
  const newer = source.weekId > target.weekId ? source : target;
  return {
    weekId: newer.weekId,
    completedDailyIds: [...newer.completedDailyIds],
    claimedMilestones: [...newer.claimedMilestones],
  };
}

function mergeRewardedWindow(target: MetaSave['monetization'], source: MetaSave['monetization']): Pick<MetaSave['monetization'], 'rewardedDay' | 'rewardedCount'> {
  if (target.rewardedDay === source.rewardedDay) {
    return {
      rewardedDay: target.rewardedDay,
      rewardedCount: Math.min(REWARDED_DAILY_LIMIT, target.rewardedCount + source.rewardedCount),
    };
  }
  return source.rewardedDay > target.rewardedDay
    ? { rewardedDay: source.rewardedDay, rewardedCount: source.rewardedCount }
    : { rewardedDay: target.rewardedDay, rewardedCount: target.rewardedCount };
}

function chooseEquipped(
  target: string,
  source: string,
  owned: readonly string[],
): string {
  if (source.length > 0 && owned.includes(source)) return source;
  if (target.length > 0 && owned.includes(target)) return target;
  return '';
}

export function profileMergeReceiptKey(scope: string): string {
  // 64-bit FNV-1a keeps the durable receipt key short and valid for MetaSave receipts.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < scope.length; index += 1) {
    hash ^= BigInt(scope.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `profilemerge_${hash.toString(36)}`;
}

export function hasMergedProfileScope(state: MetaSave, sourceScope: string): boolean {
  return (state.progression.receipts[profileMergeReceiptKey(sourceScope)] ?? 0) >= 1;
}

export function shouldPreserveActiveGameForProfileMerge(
  currentScope: string,
  authorized: boolean,
  transfer: ProfileMergeTransfer | null,
): boolean {
  return authorized && transfer?.sourceScope === currentScope;
}

export function mergeMetaProfiles(targetRaw: MetaSave, sourceRaw: MetaSave, sourceScope: string): MetaSave {
  const target = normalizeMetaSave(targetRaw);
  const source = normalizeMetaSave(sourceRaw);
  const receiptKey = profileMergeReceiptKey(sourceScope);
  if ((target.progression.receipts[receiptKey] ?? 0) >= 1) return target;

  const ownedCardBacks = [...new Set([...target.collection.ownedCardBacks, ...source.collection.ownedCardBacks])];
  const ownedTables = [...new Set([...target.collection.ownedTables, ...source.collection.ownedTables])];
  const ownedThemes = [...new Set([...target.collection.ownedThemes, ...source.collection.ownedThemes])];

  const dailyIds = new Set([
    ...Object.keys(target.daily.records),
    ...Object.keys(source.daily.records),
  ]);
  const records: MetaSave['daily']['records'] = {};
  for (const dailyId of dailyIds) {
    const record = mergeDailyRecord(target.daily.records[dailyId], source.daily.records[dailyId]);
    if (record !== undefined) records[dailyId] = record;
  }

  const sourceHasStandardActivity = source.stats.winnable.played > 0
    || source.standardDifficulty.lastServedTier !== ''
    || source.standardDifficulty.recentSeeds.length > 0;
  const rewarded = mergeRewardedWindow(target.monetization, source.monetization);
  const receipts = mergeReceipts(target.progression.receipts, source.progression.receipts);
  receipts[receiptKey] = 1;

  const merged: MetaSave = {
    ...target,
    collection: { ownedCardBacks, ownedTables, ownedThemes },
    equipped: {
      cardBack: chooseEquipped(target.equipped.cardBack, source.equipped.cardBack, ownedCardBacks),
      table: chooseEquipped(target.equipped.table, source.equipped.table, ownedTables),
      theme: isThemeId(source.equipped.theme) && ownedThemes.includes(source.equipped.theme)
        ? source.equipped.theme
        : isThemeId(target.equipped.theme) && ownedThemes.includes(target.equipped.theme)
          ? target.equipped.theme
          : DEFAULT_THEME_ID,
    },
    achievements: [...new Set([...target.achievements, ...source.achievements])],
    stats: {
      original: mergeStats(target.stats.original, source.stats.original),
      winnable: mergeStats(target.stats.winnable, source.stats.winnable),
    },
    progression: {
      totalXp: safeAdd(target.progression.totalXp, source.progression.totalXp, MAX_ECONOMY_VALUE),
      coins: safeAdd(target.progression.coins, source.progression.coins, MAX_ECONOMY_VALUE),
      lastWinDay: source.progression.lastWinDay > target.progression.lastWinDay
        ? source.progression.lastWinDay
        : target.progression.lastWinDay,
      startedAttempts: uniqueTail([...target.progression.startedAttempts, ...source.progression.startedAttempts], 128),
      completedAttempts: uniqueTail([...target.progression.completedAttempts, ...source.progression.completedAttempts], 128),
      receipts,
    },
    standardDifficulty: {
      failureStreak: sourceHasStandardActivity
        ? source.standardDifficulty.failureStreak
        : target.standardDifficulty.failureStreak,
      lastServedTier: sourceHasStandardActivity
        ? source.standardDifficulty.lastServedTier
        : target.standardDifficulty.lastServedTier,
      recentSeeds: uniqueTail([...target.standardDifficulty.recentSeeds, ...source.standardDifficulty.recentSeeds], 256),
    },
    standardWinStreak: {
      current: sourceHasStandardActivity
        ? source.standardWinStreak.current
        : target.standardWinStreak.current,
      best: Math.max(target.standardWinStreak.best, source.standardWinStreak.best),
    },
    monetization: {
      removeAds: target.monetization.removeAds || source.monetization.removeAds,
      creditedPurchaseTokens: uniqueTail([
        ...target.monetization.creditedPurchaseTokens,
        ...source.monetization.creditedPurchaseTokens,
      ], 128),
      ...rewarded,
    },
    daily: {
      algorithmVersion: target.daily.algorithmVersion,
      records,
    },
    weekly: mergeWeekly(target.weekly, source.weekly),
  };

  return normalizeMetaSave(merged);
}

export function stageProfileMergeTransfer(
  sourceScope: string,
  state: MetaSave,
  storage: ProfileMergeStorage | null = resolveStorage(),
): boolean {
  if (storage === null || sourceScope.length === 0 || sourceScope.length > MAX_PROFILE_SCOPE_LENGTH) return false;
  try {
    storage.setItem(PROFILE_MERGE_TRANSFER_KEY, JSON.stringify({
      version: PROFILE_MERGE_TRANSFER_VERSION,
      sourceScope,
      state: normalizeMetaSave(state),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readProfileMergeTransfer(
  storage: ProfileMergeStorage | null = resolveStorage(),
): ProfileMergeTransfer | null {
  if (storage === null) return null;
  try {
    const serialized = storage.getItem(PROFILE_MERGE_TRANSFER_KEY);
    if (serialized === null) return null;
    const parsed = JSON.parse(serialized) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (
      value.version !== PROFILE_MERGE_TRANSFER_VERSION
      || typeof value.sourceScope !== 'string'
      || value.sourceScope.length === 0
      || value.sourceScope.length > MAX_PROFILE_SCOPE_LENGTH
    ) return null;
    return {
      sourceScope: value.sourceScope,
      state: normalizeMetaSave(value.state),
    };
  } catch {
    return null;
  }
}

export function clearProfileMergeTransfer(
  storage: ProfileMergeStorage | null = resolveStorage(),
): void {
  if (storage === null) return;
  try {
    storage.removeItem(PROFILE_MERGE_TRANSFER_KEY);
  } catch {
    // A failed cleanup only causes an idempotent retry because the merge receipt is durable.
  }
}
