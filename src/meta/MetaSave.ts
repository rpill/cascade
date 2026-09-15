import { DEFAULT_THEME_ID, isThemeId } from '../theme/ThemeRegistry.ts';
import { REWARDED_DAILY_LIMIT } from '../monetization/Products.ts';

export const META_SAVE_VERSION = 8 as const;
export const DAILY_ALGORITHM_VERSION = 2 as const;
export const WEEKLY_MILESTONES = [3, 5, 7] as const;
export const MAX_ECONOMY_VALUE = 1_000_000_000;

export type StandardDifficulty = 'easy' | 'medium' | 'hard';
export type StandardPartition = 'onboarding' | StandardDifficulty;
export type MasteryRank = 'novice' | 'player' | 'tactician' | 'expert' | 'master' | 'grandmaster';

export interface MasteryStageProgress {
  anyWins: number;
  mediumWins: number;
  hardWins: number;
  onTimeDailyWins: number;
}

export interface DailyRecord {
  completed: boolean;
  completedOnTime: boolean;
  bestTimeMs?: number;
  attempts: number;
}

export interface ModeStats { played: number; wins: number; bestTimeMs?: number }
export interface CollectionState { ownedCardBacks: string[]; ownedTables: string[]; ownedThemes: string[] }
export interface EquippedState { cardBack: string; table: string; theme: string }
export interface DailyState { algorithmVersion: number; records: Record<string, DailyRecord> }
export interface WeeklyState { weekId: string; completedDailyIds: string[]; claimedMilestones: number[] }

export interface ProductProgressionState {
  coins: number;
  startedAttempts: string[];
  completedAttempts: string[];
  receipts: Record<string, number>;
}

export interface StandardProductState {
  selectedDifficulty: StandardDifficulty;
  recentSeeds: string[];
  completed: Record<StandardPartition, string[]>;
  masteryCreditedSeeds: string[];
  onboardingWins: number;
}

export interface StandardWinStreakState { current: number; best: number }
export interface MonetizationState { rewardedDay: string; rewardedCount: number }

export interface MetaSave {
  version: typeof META_SAVE_VERSION;
  collection: CollectionState;
  equipped: EquippedState;
  achievements: string[];
  stats: { original: ModeStats; winnable: ModeStats };
  daily: DailyState;
  weekly: WeeklyState;
  progression: ProductProgressionState;
  standard: StandardProductState;
  standardWinStreak: StandardWinStreakState;
  mastery: { rank: MasteryRank; stage: MasteryStageProgress };
  futurePrestige: { mediumSeeds: string[]; hardSeeds: string[]; onTimeDailyDates: string[] };
  claimedRewardKeys: string[];
  monetization: MonetizationState;
}

const DIFFICULTIES = new Set<StandardDifficulty>(['easy', 'medium', 'hard']);
const RANKS = new Set<MasteryRank>(['novice','player','tactician','expert','master','grandmaster']);
const MAX_UINT32_SEED = 0xffff_ffffn;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function integer(value: unknown, max = MAX_ECONOMY_VALUE): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? Math.min(value as number, max) : 0;
}
function uniqueStrings(value: unknown, limit = Number.MAX_SAFE_INTEGER): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))].slice(-limit) : [];
}
function normalizeSeeds(value: unknown, limit = 256): string[] {
  const result: string[] = [];
  for (const seed of uniqueStrings(value)) {
    if (!/^[1-9]\d{0,9}$/u.test(seed)) continue;
    try { const parsed = BigInt(seed); if (parsed < 1n || parsed > MAX_UINT32_SEED) continue; } catch { continue; }
    if (!result.includes(seed)) result.push(seed);
  }
  return result.slice(-limit);
}
function normalizeReceipts(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isObject(value)) return result;
  for (const [key, raw] of Object.entries(value)) {
    if (/^[a-zA-Z0-9_-]{1,100}$/.test(key) && Number.isSafeInteger(raw) && (raw as number) >= 0) result[key] = raw as number;
  }
  return result;
}
function modeStats(value: unknown): ModeStats {
  const raw = isObject(value) ? value : {};
  const played = integer(raw.played, Number.MAX_SAFE_INTEGER);
  const wins = Math.min(played, integer(raw.wins, Number.MAX_SAFE_INTEGER));
  const best = typeof raw.bestTimeMs === 'number' && Number.isFinite(raw.bestTimeMs) && raw.bestTimeMs > 0 ? raw.bestTimeMs : undefined;
  return { played, wins, ...(wins > 0 && best !== undefined ? { bestTimeMs: best } : {}) };
}
function dailyRecord(value: unknown): DailyRecord | null {
  if (!isObject(value)) return null;
  const attempts = integer(value.attempts, Number.MAX_SAFE_INTEGER);
  const completed = value.completed === true;
  const completedOnTime = value.completedOnTime === true;
  const best = typeof value.bestTimeMs === 'number' && Number.isFinite(value.bestTimeMs) && value.bestTimeMs > 0 ? value.bestTimeMs : undefined;
  return { completed, completedOnTime, attempts, ...(best === undefined ? {} : { bestTimeMs: best }) };
}
function normalizeDaily(value: unknown): DailyState {
  const raw = isObject(value) ? value : {};
  const source = isObject(raw.records) ? raw.records : {};
  const records: Record<string, DailyRecord> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const parsed = dailyRecord(entry); if (parsed) records[key] = parsed;
  }
  return { algorithmVersion: DAILY_ALGORITHM_VERSION, records };
}
function normalizeWeekly(value: unknown): WeeklyState {
  const raw = isObject(value) ? value : {};
  const milestones = Array.isArray(raw.claimedMilestones) ? [...new Set(raw.claimedMilestones.filter((n): n is 3|5|7 => n===3||n===5||n===7))] : [];
  return {
    weekId: typeof raw.weekId === 'string' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(raw.weekId) ? raw.weekId : '',
    completedDailyIds: uniqueStrings(raw.completedDailyIds).filter((id)=>/^\d{4}-\d{2}-\d{2}$/.test(id)),
    claimedMilestones: milestones,
  };
}
function normalizeCollection(value: unknown): CollectionState {
  const raw = isObject(value) ? value : {};
  const ownedThemes = uniqueStrings(raw.ownedThemes).filter((id)=>isThemeId(id));
  if (!ownedThemes.includes(DEFAULT_THEME_ID)) ownedThemes.unshift(DEFAULT_THEME_ID);
  return { ownedCardBacks: uniqueStrings(raw.ownedCardBacks), ownedTables: uniqueStrings(raw.ownedTables), ownedThemes };
}
function normalizeEquipped(value: unknown, ownedThemes: readonly string[]): EquippedState {
  const raw = isObject(value) ? value : {};
  const theme = typeof raw.theme === 'string' && isThemeId(raw.theme) && ownedThemes.includes(raw.theme) ? raw.theme : DEFAULT_THEME_ID;
  return { cardBack: typeof raw.cardBack === 'string' ? raw.cardBack : '', table: typeof raw.table === 'string' ? raw.table : '', theme };
}
function normalizeProgression(value: unknown): ProductProgressionState {
  const raw = isObject(value) ? value : {};
  return { coins: integer(raw.coins), startedAttempts: uniqueStrings(raw.startedAttempts,128), completedAttempts: uniqueStrings(raw.completedAttempts,128), receipts: normalizeReceipts(raw.receipts) };
}
function normalizeStandard(value: unknown): StandardProductState {
  const raw = isObject(value) ? value : {};
  const selectedDifficulty = typeof raw.selectedDifficulty === 'string' && DIFFICULTIES.has(raw.selectedDifficulty as StandardDifficulty) ? raw.selectedDifficulty as StandardDifficulty : 'easy';
  const completedRaw = isObject(raw.completed) ? raw.completed : {};
  return {
    selectedDifficulty,
    recentSeeds: normalizeSeeds(raw.recentSeeds),
    completed: {
      onboarding: normalizeSeeds(completedRaw.onboarding, 40_000), easy: normalizeSeeds(completedRaw.easy,40_000),
      medium: normalizeSeeds(completedRaw.medium,40_000), hard: normalizeSeeds(completedRaw.hard,40_000),
    },
    masteryCreditedSeeds: normalizeSeeds(raw.masteryCreditedSeeds,40_000),
    onboardingWins: Math.min(5, integer(raw.onboardingWins, 5)),
  };
}
function normalizeMastery(value: unknown): MetaSave['mastery'] {
  const raw = isObject(value) ? value : {};
  const stageRaw = isObject(raw.stage) ? raw.stage : {};
  const rank = typeof raw.rank === 'string' && RANKS.has(raw.rank as MasteryRank) ? raw.rank as MasteryRank : 'novice';
  return { rank, stage: { anyWins: integer(stageRaw.anyWins,100_000), mediumWins: integer(stageRaw.mediumWins,100_000), hardWins: integer(stageRaw.hardWins,100_000), onTimeDailyWins: integer(stageRaw.onTimeDailyWins,100_000) } };
}
function normalizeFuturePrestige(value: unknown): MetaSave['futurePrestige'] {
  const raw = isObject(value) ? value : {};
  return { mediumSeeds: normalizeSeeds(raw.mediumSeeds,40_000), hardSeeds: normalizeSeeds(raw.hardSeeds,40_000), onTimeDailyDates: uniqueStrings(raw.onTimeDailyDates, 10_000).filter((id)=>/^\d{4}-\d{2}-\d{2}$/.test(id)) };
}
function normalizeStreak(value: unknown): StandardWinStreakState {
  const raw = isObject(value) ? value : {};
  const current = integer(raw.current, Number.MAX_SAFE_INTEGER); return { current, best: Math.max(current, integer(raw.best, Number.MAX_SAFE_INTEGER)) };
}
function normalizeMonetization(value: unknown): MonetizationState {
  const raw = isObject(value) ? value : {};
  return { rewardedDay: typeof raw.rewardedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.rewardedDay) ? raw.rewardedDay : '', rewardedCount: Math.min(REWARDED_DAILY_LIMIT, integer(raw.rewardedCount, REWARDED_DAILY_LIMIT)) };
}

export function createDefaultMetaSave(): MetaSave {
  return {
    version: META_SAVE_VERSION,
    collection: { ownedCardBacks: [], ownedTables: [], ownedThemes: [DEFAULT_THEME_ID] },
    equipped: { cardBack: '', table: '', theme: DEFAULT_THEME_ID },
    achievements: [], stats: { original: {played:0,wins:0}, winnable:{played:0,wins:0} },
    daily: { algorithmVersion: DAILY_ALGORITHM_VERSION, records: {} },
    weekly: { weekId:'', completedDailyIds:[], claimedMilestones:[] },
    progression: { coins:0, startedAttempts:[], completedAttempts:[], receipts:{} },
    standard: { selectedDifficulty:'easy', recentSeeds:[], completed:{onboarding:[],easy:[],medium:[],hard:[]}, masteryCreditedSeeds:[], onboardingWins:0 },
    standardWinStreak: {current:0,best:0},
    mastery: { rank:'novice', stage:{anyWins:0,mediumWins:0,hardWins:0,onTimeDailyWins:0} },
    futurePrestige: { mediumSeeds:[], hardSeeds:[], onTimeDailyDates:[] },
    claimedRewardKeys: [], monetization: { rewardedDay:'', rewardedCount:0 },
  };
}

export function normalizeMetaSave(raw: unknown): MetaSave {
  if (!isObject(raw) || raw.version !== META_SAVE_VERSION) return createDefaultMetaSave();
  const collection = normalizeCollection(raw.collection);
  const stats = isObject(raw.stats) ? raw.stats : {};
  return {
    version: META_SAVE_VERSION,
    collection,
    equipped: normalizeEquipped(raw.equipped, collection.ownedThemes),
    achievements: uniqueStrings(raw.achievements),
    stats: { original: modeStats(stats.original), winnable: modeStats(stats.winnable) },
    daily: normalizeDaily(raw.daily), weekly: normalizeWeekly(raw.weekly), progression: normalizeProgression(raw.progression),
    standard: normalizeStandard(raw.standard), standardWinStreak: normalizeStreak(raw.standardWinStreak), mastery: normalizeMastery(raw.mastery),
    futurePrestige: normalizeFuturePrestige(raw.futurePrestige), claimedRewardKeys: uniqueStrings(raw.claimedRewardKeys,10_000), monetization: normalizeMonetization(raw.monetization),
  };
}
