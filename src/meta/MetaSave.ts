export const META_SAVE_VERSION = 2 as const;
export const DAILY_ALGORITHM_VERSION = 1 as const;
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

export type MetaSave = MetaSaveV2;

function createDefaultModeStats(): ModeStats {
  return { played: 0, wins: 0 };
}

export function createDefaultMetaSave(): MetaSaveV2 {
  return {
    version: META_SAVE_VERSION,
    collection: {
      ownedCardBacks: [],
      ownedTables: [],
      ownedThemes: [],
    },
    equipped: { cardBack: '', table: '', theme: '' },
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
    algorithmVersion:
      Number.isInteger(daily.algorithmVersion) && (daily.algorithmVersion as number) > 0
        ? daily.algorithmVersion as number
        : DAILY_ALGORITHM_VERSION,
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
    weekId: typeof weekly.weekId === 'string' ? weekly.weekId : '',
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

export function normalizeMetaSave(raw: unknown): MetaSaveV2 {
  const fallback = createDefaultMetaSave();
  if (!isObject(raw)) return fallback;

  if (raw.version === 1) {
    const legacy = normalizeLegacyV1(raw);
    return {
      version: META_SAVE_VERSION,
      collection: legacy.collection,
      equipped: legacy.equipped,
      achievements: legacy.achievements,
      stats: fallback.stats,
      daily: legacy.daily,
      weekly: legacy.weekly,
    };
  }

  if (raw.version !== META_SAVE_VERSION) return fallback;

  const stats = isObject(raw.stats) ? raw.stats : {};
  return {
    version: META_SAVE_VERSION,
    collection: normalizeCollection(raw.collection),
    equipped: normalizeEquipped(raw.equipped),
    achievements: uniqueStrings(raw.achievements),
    stats: {
      original: normalizeModeStats(stats.original),
      winnable: normalizeModeStats(stats.winnable),
    },
    daily: normalizeDaily(raw.daily),
    weekly: normalizeWeekly(raw.weekly),
  };
}
