import {
  MAX_COUNTER_VALUE,
  normalizeMetaSave,
  type DailyRecord,
  type MasteryRank,
  type MetaSave,
  type ModeStats,
} from '../meta/MetaSave.ts';
import {
  CLOUD_SNAPSHOT_VERSION,
  normalizeCloudSnapshot,
  type CloudActiveGameCheckpoint,
  type CloudSnapshot,
} from './CloudSnapshot.ts';

export interface CloudMergeInput {
  readonly base: CloudSnapshot | null;
  readonly local: CloudSnapshot;
  readonly cloud: CloudSnapshot | null;
  readonly todayId: string;
}

const RANK_ORDER: readonly MasteryRank[] = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'];

const mergeCounter = (base: number, local: number, cloud: number, max = MAX_COUNTER_VALUE): number =>
  Math.min(max, cloud + Math.max(0, local - base));

const minPositive = (a?: number, b?: number): number | undefined =>
  a === undefined ? b : b === undefined ? a : Math.min(a, b);

function unionStrings(...values: readonly (readonly string[])[]): string[] {
  return [...new Set(values.flatMap((entry) => [...entry]))];
}

function mergeReceipts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) merged[key] = Math.max(merged[key] ?? 0, value);
  return merged;
}

function mergeBestPair(a?: DailyRecord, b?: DailyRecord): Pick<DailyRecord, 'bestMoves' | 'bestMovesTimeMs'> {
  const candidates = [a, b]
    .filter((record): record is DailyRecord => record !== undefined && record.bestMoves !== undefined && record.bestMovesTimeMs !== undefined)
    .sort((left, right) => (left.bestMoves! - right.bestMoves!) || (left.bestMovesTimeMs! - right.bestMovesTimeMs!));
  const best = candidates[0];
  return best === undefined ? {} : { bestMoves: best.bestMoves, bestMovesTimeMs: best.bestMovesTimeMs };
}

function mergeDailyRecordFirst(local?: DailyRecord, cloud?: DailyRecord): DailyRecord | undefined {
  if (local === undefined) return cloud === undefined ? undefined : { ...cloud };
  if (cloud === undefined) return { ...local };
  const pair = mergeBestPair(local, cloud);
  return {
    completed: local.completed || cloud.completed,
    completedOnTime: local.completedOnTime || cloud.completedOnTime,
    attempts: Math.max(local.attempts, cloud.attempts),
    ...(minPositive(local.bestTimeMs, cloud.bestTimeMs) === undefined ? {} : { bestTimeMs: minPositive(local.bestTimeMs, cloud.bestTimeMs) }),
    ...pair,
    ...(cloud.rankingAttemptId !== undefined
      ? { rankingAttemptId: cloud.rankingAttemptId }
      : local.rankingAttemptId !== undefined ? { rankingAttemptId: local.rankingAttemptId } : {}),
    ...(local.hintUsed === true || cloud.hintUsed === true ? { hintUsed: true } : {}),
  };
}

function mergeDailyRecordThreeWay(base: DailyRecord | undefined, local: DailyRecord | undefined, cloud: DailyRecord | undefined): DailyRecord | undefined {
  if (local === undefined && cloud === undefined) return undefined;
  if (local === undefined) return cloud === undefined ? undefined : { ...cloud };
  if (cloud === undefined) return { ...local };
  const pair = mergeBestPair(local, cloud);
  return {
    completed: local.completed || cloud.completed,
    completedOnTime: local.completedOnTime || cloud.completedOnTime,
    attempts: mergeCounter(base?.attempts ?? 0, local.attempts, cloud.attempts, Number.MAX_SAFE_INTEGER),
    ...(minPositive(local.bestTimeMs, cloud.bestTimeMs) === undefined ? {} : { bestTimeMs: minPositive(local.bestTimeMs, cloud.bestTimeMs) }),
    ...pair,
    ...(cloud.rankingAttemptId !== undefined
      ? { rankingAttemptId: cloud.rankingAttemptId }
      : local.rankingAttemptId !== undefined ? { rankingAttemptId: local.rankingAttemptId } : {}),
    ...(local.hintUsed === true || cloud.hintUsed === true ? { hintUsed: true } : {}),
  };
}

function mergeDailyRecordsFirst(local: MetaSave['daily']['records'], cloud: MetaSave['daily']['records']): MetaSave['daily']['records'] {
  const merged: MetaSave['daily']['records'] = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const record = mergeDailyRecordFirst(local[id], cloud[id]);
    if (record !== undefined) merged[id] = record;
  }
  return merged;
}

function mergeDailyRecordsThreeWay(base: MetaSave['daily']['records'], local: MetaSave['daily']['records'], cloud: MetaSave['daily']['records']): MetaSave['daily']['records'] {
  const merged: MetaSave['daily']['records'] = {};
  for (const id of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)])) {
    const record = mergeDailyRecordThreeWay(base[id], local[id], cloud[id]);
    if (record !== undefined) merged[id] = record;
  }
  return merged;
}

function mergeWeekly(a: MetaSave['weekly'], b: MetaSave['weekly']): MetaSave['weekly'] {
  if (a.weekId !== b.weekId) {
    const newer = b.weekId > a.weekId ? b : a;
    return {
      weekId: newer.weekId,
      completedDailyIds: [...newer.completedDailyIds],
      claimedMilestones: [...newer.claimedMilestones],
    };
  }
  return {
    weekId: a.weekId,
    completedDailyIds: unionStrings(a.completedDailyIds, b.completedDailyIds),
    claimedMilestones: [...new Set([...a.claimedMilestones, ...b.claimedMilestones])],
  };
}

function mergeModeStatsFirst(a: ModeStats, b: ModeStats): ModeStats {
  const played = Math.max(a.played, b.played);
  const wins = Math.min(played, Math.max(a.wins, b.wins));
  const bestTimeMs = minPositive(a.bestTimeMs, b.bestTimeMs);
  return { played, wins, ...(wins > 0 && bestTimeMs !== undefined ? { bestTimeMs } : {}) };
}

function mergeModeStatsThreeWay(base: ModeStats, local: ModeStats, cloud: ModeStats): ModeStats {
  const played = mergeCounter(base.played, local.played, cloud.played, Number.MAX_SAFE_INTEGER);
  const wins = Math.min(played, mergeCounter(base.wins, local.wins, cloud.wins, Number.MAX_SAFE_INTEGER));
  const bestTimeMs = minPositive(local.bestTimeMs, cloud.bestTimeMs);
  return { played, wins, ...(wins > 0 && bestTimeMs !== undefined ? { bestTimeMs } : {}) };
}

function mergeMasteryFirst(a: MetaSave['mastery'], b: MetaSave['mastery']): MetaSave['mastery'] {
  const ai = RANK_ORDER.indexOf(a.rank);
  const bi = RANK_ORDER.indexOf(b.rank);
  if (ai !== bi) return structuredClone(ai > bi ? a : b);
  return {
    rank: a.rank,
    stage: {
      anyWins: Math.max(a.stage.anyWins, b.stage.anyWins),
      mediumWins: Math.max(a.stage.mediumWins, b.stage.mediumWins),
      hardWins: Math.max(a.stage.hardWins, b.stage.hardWins),
      onTimeDailyWins: Math.max(a.stage.onTimeDailyWins, b.stage.onTimeDailyWins),
    },
  };
}

function mergeMasteryThreeWay(base: MetaSave['mastery'], local: MetaSave['mastery'], cloud: MetaSave['mastery']): MetaSave['mastery'] {
  const li = RANK_ORDER.indexOf(local.rank);
  const ci = RANK_ORDER.indexOf(cloud.rank);
  if (li !== ci) return structuredClone(li > ci ? local : cloud);
  if (base.rank !== local.rank) return mergeMasteryFirst(local, cloud);
  return {
    rank: local.rank,
    stage: {
      anyWins: mergeCounter(base.stage.anyWins, local.stage.anyWins, cloud.stage.anyWins),
      mediumWins: mergeCounter(base.stage.mediumWins, local.stage.mediumWins, cloud.stage.mediumWins),
      hardWins: mergeCounter(base.stage.hardWins, local.stage.hardWins, cloud.stage.hardWins),
      onTimeDailyWins: mergeCounter(base.stage.onTimeDailyWins, local.stage.onTimeDailyWins, cloud.stage.onTimeDailyWins),
    },
  };
}

function mergeActiveGame(local?: CloudActiveGameCheckpoint, cloud?: CloudActiveGameCheckpoint): CloudActiveGameCheckpoint | undefined {
  if (local === undefined) return cloud === undefined ? undefined : structuredClone(cloud);
  if (cloud === undefined) return structuredClone(local);
  return structuredClone(local.updatedAtMs >= cloud.updatedAtMs ? local : cloud);
}

function firstLinkMerge(local: CloudSnapshot, cloud: CloudSnapshot, _todayId: string): CloudSnapshot {
  const lm = local.meta;
  const cm = cloud.meta;
  const mergedMeta: MetaSave = {
    ...lm,
    achievements: unionStrings(cm.achievements, lm.achievements),
    stats: {
      original: mergeModeStatsFirst(lm.stats.original, cm.stats.original),
      winnable: mergeModeStatsFirst(lm.stats.winnable, cm.stats.winnable),
    },
    daily: {
      algorithmVersion: Math.max(lm.daily.algorithmVersion, cm.daily.algorithmVersion),
      records: mergeDailyRecordsFirst(lm.daily.records, cm.daily.records),
    },
    weekly: mergeWeekly(lm.weekly, cm.weekly),
    progression: {
      startedAttempts: unionStrings(cm.progression.startedAttempts, lm.progression.startedAttempts),
      completedAttempts: unionStrings(cm.progression.completedAttempts, lm.progression.completedAttempts),
      receipts: mergeReceipts(cm.progression.receipts, lm.progression.receipts),
    },
    standard: {
      selectedDifficulty: lm.standard.selectedDifficulty,
      recentSeeds: unionStrings(cm.standard.recentSeeds, lm.standard.recentSeeds),
      completed: {
        onboarding: unionStrings(cm.standard.completed.onboarding, lm.standard.completed.onboarding),
        easy: unionStrings(cm.standard.completed.easy, lm.standard.completed.easy),
        medium: unionStrings(cm.standard.completed.medium, lm.standard.completed.medium),
        hard: unionStrings(cm.standard.completed.hard, lm.standard.completed.hard),
      },
      masteryCreditedSeeds: unionStrings(cm.standard.masteryCreditedSeeds, lm.standard.masteryCreditedSeeds),
      onboardingWins: Math.max(lm.standard.onboardingWins, cm.standard.onboardingWins),
    },
    standardWinStreak: {
      current: Math.max(lm.standardWinStreak.current, cm.standardWinStreak.current),
      best: Math.max(lm.standardWinStreak.best, cm.standardWinStreak.best),
    },
    mastery: mergeMasteryFirst(lm.mastery, cm.mastery),
    futurePrestige: {
      mediumSeeds: unionStrings(cm.futurePrestige.mediumSeeds, lm.futurePrestige.mediumSeeds),
      hardSeeds: unionStrings(cm.futurePrestige.hardSeeds, lm.futurePrestige.hardSeeds),
      onTimeDailyDates: unionStrings(cm.futurePrestige.onTimeDailyDates, lm.futurePrestige.onTimeDailyDates),
    },
  };
  const raw: CloudSnapshot = {
    schemaVersion: CLOUD_SNAPSHOT_VERSION,
    meta: normalizeMetaSave(mergedMeta),
    ...(mergeActiveGame(local.activeGame, cloud.activeGame) === undefined ? {} : { activeGame: mergeActiveGame(local.activeGame, cloud.activeGame) }),
  };
  return normalizeCloudSnapshot(raw)!;
}

function threeWayMerge(base: CloudSnapshot, local: CloudSnapshot, cloud: CloudSnapshot, _todayId: string): CloudSnapshot {
  const bm = base.meta;
  const lm = local.meta;
  const cm = cloud.meta;
  const mergedMeta: MetaSave = {
    ...lm,
    achievements: unionStrings(cm.achievements, lm.achievements),
    stats: {
      original: mergeModeStatsThreeWay(bm.stats.original, lm.stats.original, cm.stats.original),
      winnable: mergeModeStatsThreeWay(bm.stats.winnable, lm.stats.winnable, cm.stats.winnable),
    },
    daily: {
      algorithmVersion: Math.max(lm.daily.algorithmVersion, cm.daily.algorithmVersion),
      records: mergeDailyRecordsThreeWay(bm.daily.records, lm.daily.records, cm.daily.records),
    },
    weekly: mergeWeekly(lm.weekly, cm.weekly),
    progression: {
      startedAttempts: unionStrings(cm.progression.startedAttempts, lm.progression.startedAttempts),
      completedAttempts: unionStrings(cm.progression.completedAttempts, lm.progression.completedAttempts),
      receipts: mergeReceipts(cm.progression.receipts, lm.progression.receipts),
    },
    standard: {
      selectedDifficulty: lm.standard.selectedDifficulty,
      recentSeeds: unionStrings(cm.standard.recentSeeds, lm.standard.recentSeeds),
      completed: {
        onboarding: unionStrings(cm.standard.completed.onboarding, lm.standard.completed.onboarding),
        easy: unionStrings(cm.standard.completed.easy, lm.standard.completed.easy),
        medium: unionStrings(cm.standard.completed.medium, lm.standard.completed.medium),
        hard: unionStrings(cm.standard.completed.hard, lm.standard.completed.hard),
      },
      masteryCreditedSeeds: unionStrings(cm.standard.masteryCreditedSeeds, lm.standard.masteryCreditedSeeds),
      onboardingWins: Math.max(lm.standard.onboardingWins, cm.standard.onboardingWins),
    },
    standardWinStreak: {
      current: Math.max(lm.standardWinStreak.current, cm.standardWinStreak.current),
      best: Math.max(lm.standardWinStreak.best, cm.standardWinStreak.best),
    },
    mastery: mergeMasteryThreeWay(bm.mastery, lm.mastery, cm.mastery),
    futurePrestige: {
      mediumSeeds: unionStrings(cm.futurePrestige.mediumSeeds, lm.futurePrestige.mediumSeeds),
      hardSeeds: unionStrings(cm.futurePrestige.hardSeeds, lm.futurePrestige.hardSeeds),
      onTimeDailyDates: unionStrings(cm.futurePrestige.onTimeDailyDates, lm.futurePrestige.onTimeDailyDates),
    },
  };
  const activeGame = mergeActiveGame(local.activeGame, cloud.activeGame);
  const raw: CloudSnapshot = {
    schemaVersion: CLOUD_SNAPSHOT_VERSION,
    meta: normalizeMetaSave(mergedMeta),
    ...(activeGame === undefined ? {} : { activeGame }),
  };
  return normalizeCloudSnapshot(raw)!;
}

export function mergeCloudSnapshots(input: CloudMergeInput): CloudSnapshot {
  const local = normalizeCloudSnapshot(input.local);
  if (local === null) throw new Error('Local cloud snapshot must be valid.');
  const cloud = input.cloud === null ? null : normalizeCloudSnapshot(input.cloud);
  if (cloud === null) return local;
  const base = input.base === null ? null : normalizeCloudSnapshot(input.base);
  return base === null
    ? firstLinkMerge(local, cloud, input.todayId)
    : threeWayMerge(base, local, cloud, input.todayId);
}
