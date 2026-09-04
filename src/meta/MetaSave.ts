export const META_SAVE_VERSION = 1 as const;
export const DAILY_ALGORITHM_VERSION = 1 as const;
export const WEEKLY_MILESTONES = [3, 5, 7] as const;

export interface DailyRecord {
  completed: boolean;
  bestTimeMs?: number;
  attempts: number;
}

export interface MetaSaveV1 {
  version: 1;
  collection: {
    ownedCardBacks: string[];
    ownedTables: string[];
    ownedThemes: string[];
  };
  equipped: {
    cardBack: string;
    table: string;
    theme: string;
  };
  achievements: string[];
  daily: {
    algorithmVersion: number;
    records: Record<string, DailyRecord>;
  };
  weekly: {
    weekId: string;
    completedDailyIds: string[];
    claimedMilestones: number[];
  };
}

export function createDefaultMetaSave(): MetaSaveV1 {
  return {
    version: META_SAVE_VERSION,
    collection: {
      ownedCardBacks: [],
      ownedTables: [],
      ownedThemes: [],
    },
    equipped: { cardBack: '', table: '', theme: '' },
    achievements: [],
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
    && (!Number.isFinite(bestTimeMs) || (bestTimeMs as number) <= 0)
  ) {
    return null;
  }

  return {
    completed,
    attempts: attempts as number,
    ...(bestTimeMs === undefined ? {} : { bestTimeMs: bestTimeMs as number }),
  };
}

export function normalizeMetaSave(raw: unknown): MetaSaveV1 {
  const fallback = createDefaultMetaSave();
  if (!isObject(raw) || raw.version !== META_SAVE_VERSION) return fallback;

  const daily = isObject(raw.daily) ? raw.daily : {};
  const rawRecords = isObject(daily.records) ? daily.records : {};
  const records: Record<string, DailyRecord> = {};

  for (const [id, value] of Object.entries(rawRecords)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) continue;
    const record = normalizeDailyRecord(value);
    if (record !== null) records[id] = record;
  }

  const weekly = isObject(raw.weekly) ? raw.weekly : {};
  const claimedMilestones = Array.isArray(weekly.claimedMilestones)
    ? [...new Set(weekly.claimedMilestones.filter(
        (value): value is 3 | 5 | 7 => value === 3 || value === 5 || value === 7,
      ))]
    : [];

  const completedDailyIds = uniqueStrings(weekly.completedDailyIds)
    .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id));

  return {
    ...fallback,
    collection: isObject(raw.collection)
      ? {
          ownedCardBacks: uniqueStrings(raw.collection.ownedCardBacks),
          ownedTables: uniqueStrings(raw.collection.ownedTables),
          ownedThemes: uniqueStrings(raw.collection.ownedThemes),
        }
      : fallback.collection,
    equipped: isObject(raw.equipped)
      ? {
          cardBack: typeof raw.equipped.cardBack === 'string' ? raw.equipped.cardBack : '',
          table: typeof raw.equipped.table === 'string' ? raw.equipped.table : '',
          theme: typeof raw.equipped.theme === 'string' ? raw.equipped.theme : '',
        }
      : fallback.equipped,
    achievements: uniqueStrings(raw.achievements),
    daily: {
      algorithmVersion:
        Number.isInteger(daily.algorithmVersion) && (daily.algorithmVersion as number) > 0
          ? daily.algorithmVersion as number
          : DAILY_ALGORITHM_VERSION,
      records,
    },
    weekly: {
      weekId: typeof weekly.weekId === 'string' ? weekly.weekId : '',
      completedDailyIds,
      claimedMilestones,
    },
  };
}
