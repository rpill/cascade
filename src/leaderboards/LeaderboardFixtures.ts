import { lifetimeMasteryPoints, type GlobalLeaderboardMode } from './LeaderboardConfig.ts';
import type { LeaderboardLoadResult, LeaderboardMetric, LeaderboardRow } from './LeaderboardService.ts';
import type { MetaSave } from '../meta/MetaSave.ts';
import { getDailyStreaks } from '../meta/DailyStreak.ts';

const NAMES = [
  'JadePhoenix','MoonRiver','Arashi','SilentKoi','PlumBlossom','MoriFox','LanternCat','CedarMist','Akari','TeaGarden',
  'NorthWind','MossStone','Sora','PaperCrane','Kitsune','Hana','BambooRain','Yuki','MapleInk','CloudPine',
  'RiverBell','NekoMori','AmberTea','NightLotus',
] as const;

const MASTERY_RANKS = ['novice','player','tactician','expert','master','grandmaster'] as const;

function standardRows(): LeaderboardRow[] {
  return NAMES.map((publicName, index) => ({
    rank: index + 1,
    publicName,
    value: Math.max(1, 38 - index),
    metric: { kind: 'standard' as const, bestStreak: Math.max(1, 38 - index) },
  }));
}

function dailyRows(): LeaderboardRow[] {
  return NAMES.map((publicName, index) => ({
    rank: index + 1,
    publicName,
    value: 118_000 + index * 13_000 + (index % 3) * 7_000,
    metric: {
      kind: 'daily' as const,
      moves: 34 + index + Math.floor(index / 4),
      elapsedMs: 118_000 + index * 13_000 + (index % 3) * 7_000,
    },
  }));
}

function streakRows(): LeaderboardRow[] {
  return NAMES.map((publicName, index) => {
    const current = Math.max(1, 31 - index);
    return {
      rank: index + 1,
      publicName,
      value: current,
      metric: { kind: 'streak' as const, current, best: current + 4 + (index % 7) },
    };
  });
}

const FIXTURE_RANKS = ['grandmaster','master','expert','tactician','player','novice'] as const;
function masteryRows(): LeaderboardRow[] {
  return NAMES.map((publicName, index) => ({
    rank: index + 1,
    publicName,
    value: 0,
    metric: {
      kind: 'mastery' as const,
      rank: FIXTURE_RANKS[Math.min(FIXTURE_RANKS.length - 1, Math.floor(index / 4))]!,
      points: Math.max(12, 960 - index * 37),
    },
  }));
}

function fixtureRows(mode: GlobalLeaderboardMode): LeaderboardRow[] {
  if (mode === 'winnable') return standardRows();
  if (mode === 'daily') return dailyRows();
  if (mode === 'streak') return streakRows();
  return masteryRows();
}

function compareMetrics(a: LeaderboardMetric, b: LeaderboardMetric): number {
  if (a.kind !== b.kind) return 0;
  if (a.kind === 'standard' && b.kind === 'standard') return b.bestStreak - a.bestStreak;
  if (a.kind === 'daily' && b.kind === 'daily') {
    const aRanked = a.moves > 0 && a.elapsedMs > 0;
    const bRanked = b.moves > 0 && b.elapsedMs > 0;
    if (aRanked !== bRanked) return aRanked ? -1 : 1;
    if (!aRanked) return 0;
    return a.moves - b.moves || a.elapsedMs - b.elapsedMs;
  }
  if (a.kind === 'streak' && b.kind === 'streak') return b.current - a.current || b.best - a.best;
  if (a.kind === 'mastery' && b.kind === 'mastery') {
    return MASTERY_RANKS.indexOf(b.rank) - MASTERY_RANKS.indexOf(a.rank) || b.points - a.points;
  }
  return 0;
}

export function createLocalLeaderboardPlayerEntry(
  mode: GlobalLeaderboardMode,
  state: MetaSave,
  dailyId?: string,
): LeaderboardRow | null {
  if (mode === 'winnable') {
    const bestStreak = state.standardWinStreak.best;
    return bestStreak > 0
      ? { rank: 0, publicName: 'Вы', value: bestStreak, metric: { kind: 'standard', bestStreak } }
      : null;
  }
  if (mode === 'daily') {
    if (!dailyId) return null;
    const record = state.daily.records[dailyId];
    if (record?.bestMoves === undefined || record.bestMovesTimeMs === undefined) {
      return { rank: 0, publicName: 'Вы', value: 0, metric: { kind: 'daily', moves: 0, elapsedMs: 0 } };
    }
    return {
      rank: 0,
      publicName: 'Вы',
      value: record.bestMovesTimeMs,
      metric: { kind: 'daily', moves: record.bestMoves, elapsedMs: record.bestMovesTimeMs },
    };
  }
  if (mode === 'streak') {
    if (!dailyId) return null;
    const streak = getDailyStreaks(state.daily.records, dailyId);
    return {
      rank: 0,
      publicName: 'Вы',
      value: streak.current,
      metric: { kind: 'streak', current: streak.current, best: streak.best },
    };
  }
  const points = lifetimeMasteryPoints(state);
  return {
    rank: 0,
    publicName: 'Вы',
    value: points,
    metric: { kind: 'mastery', rank: state.mastery.rank, points },
  };
}

export function createLeaderboardFixtureResult(
  mode: GlobalLeaderboardMode,
  _dailyId?: string,
  playerEntry: LeaderboardRow | null = null,
): Extract<LeaderboardLoadResult, { status: 'ready' }> {
  const candidates = [...fixtureRows(mode), ...(playerEntry === null ? [] : [playerEntry])]
    .sort((a, b) => compareMetrics(a.metric, b.metric) || a.publicName.localeCompare(b.publicName));
  const ranked = candidates.map((entry, index) => ({ ...entry, rank: index + 1 }));
  const rankedPlayer = playerEntry === null ? null : ranked.find((entry) => entry.publicName === playerEntry.publicName) ?? null;
  return { status: 'ready', authorized: true, entries: ranked.slice(0, 20), playerEntry: rankedPlayer };
}

export function leaderboardFixturesEnabled(locationLike?: { hostname?: string; search?: string } | null): boolean {
  const location = locationLike ?? (typeof window === 'undefined' ? null : window.location);
  if (location === null) return false;
  const params = new URLSearchParams(location.search ?? '');
  if (params.get('leaderboardFixtures') === '0') return false;
  if (params.get('leaderboardFixtures') === '1') return true;
  const hostname = (location.hostname ?? '').toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
