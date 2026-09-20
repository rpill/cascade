import { normalizeMetaSave } from '../../../src/meta/MetaSave.ts';
import { lifetimeMasteryPoints } from '../../../src/leaderboards/LeaderboardConfig.ts';
import type { VerifiedPikabuPlayer } from './auth.ts';
import { BackendDb } from './db.ts';
import { HttpError, jsonResponse, readJsonBody } from './http.ts';
import {
  parseLeaderboardLimit,
  parseLeaderboardSubmitBody,
  validateBoardKey,
  validateDailyId,
  type BackendBoardKey,
} from './validation.ts';

export interface PublicLeaderboardRow {
  readonly accountId: string;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly primaryValue: number;
  readonly secondaryValue?: number | null;
  readonly context: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface PublicDailyRow {
  readonly accountId: string;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly dailyId: string;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly completedOnTime: boolean;
  readonly completedAt: string;
}

export interface PublicDailyStreakRow {
  readonly accountId: string;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly current: number;
  readonly best: number;
}

export interface BackendLeaderboardDb {
  resolveAccount(player: VerifiedPikabuPlayer): Promise<string>;
  listStandard(): Promise<readonly PublicLeaderboardRow[]>;
  listDaily(scope: string): Promise<readonly PublicDailyRow[]>;
  listDailyStreak(todayId: string, accountId?: string): Promise<readonly PublicDailyStreakRow[]>;
  listMastery(): Promise<readonly PublicLeaderboardRow[]>;
  submitDaily(
    accountId: string,
    operationId: string,
    dailyId: string,
    attemptId: string | null,
    moves: number,
    elapsedMs: number,
    completedOnTime: boolean,
  ): Promise<Record<string, unknown>>;
  upsertLeaderboard(
    accountId: string,
    operationId: string,
    boardKey: string,
    scopeKey: string,
    primaryValue: number,
    secondaryValue: number | null,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

interface BackendLeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly metric: Record<string, number | string>;
}

interface RankedEntry extends BackendLeaderboardEntry { readonly accountId: string }

function rankedFromRows(
  rows: readonly PublicLeaderboardRow[],
  metric: (row: PublicLeaderboardRow) => Record<string, number | string>,
  compare: (a: PublicLeaderboardRow, b: PublicLeaderboardRow) => number,
): RankedEntry[] {
  return [...rows].sort(compare).map((row, index) => ({
    accountId: row.accountId,
    rank: index + 1,
    playerId: row.playerId,
    publicName: row.publicName,
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    metric: metric(row),
  }));
}

function dailyRanked(rows: readonly PublicDailyRow[]): RankedEntry[] {
  return [...rows]
    .sort((a, b) => a.moves - b.moves || a.elapsedMs - b.elapsedMs || a.completedAt.localeCompare(b.completedAt) || a.accountId.localeCompare(b.accountId))
    .map((row, index) => ({
      accountId: row.accountId,
      rank: index + 1,
      playerId: row.playerId,
      publicName: row.publicName,
      ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
      metric: { dailyId: row.dailyId, moves: row.moves, elapsedMs: row.elapsedMs },
    }));
}

function streakRanked(rows: readonly PublicDailyStreakRow[]): RankedEntry[] {
  return [...rows]
    .sort((a, b) => b.current - a.current || b.best - a.best || a.accountId.localeCompare(b.accountId))
    .map((row, index) => ({
      accountId: row.accountId,
      rank: index + 1,
      playerId: row.playerId,
      publicName: row.publicName,
      ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
      metric: { current: row.current, best: row.best },
    }));
}

function publicEntry(entry: RankedEntry): BackendLeaderboardEntry {
  const { accountId: _accountId, ...rest } = entry;
  return rest;
}

export async function handleLeaderboardRead(
  boardRaw: string,
  url: URL,
  player: VerifiedPikabuPlayer | null,
  db: BackendLeaderboardDb = new BackendDb(),
): Promise<Response> {
  const board = validateBoardKey(boardRaw);
  const limit = parseLeaderboardLimit(url.searchParams.get('limit'));
  let ranked: RankedEntry[];

  if (board === 'standard') {
    ranked = rankedFromRows(
      await db.listStandard(),
      (row) => ({ bestStreak: row.primaryValue }),
      (a, b) => b.primaryValue - a.primaryValue || a.updatedAt.localeCompare(b.updatedAt) || a.accountId.localeCompare(b.accountId),
    );
  } else if (board === 'daily') {
    const scope = validateDailyId(url.searchParams.get('scope'));
    ranked = dailyRanked(await db.listDaily(scope));
  } else if (board === 'daily-streak') {
    const todayId = validateDailyId(url.searchParams.get('today'));
    ranked = streakRanked(await db.listDailyStreak(todayId));
  } else {
    ranked = rankedFromRows(
      await db.listMastery(),
      (row) => {
        const rank = typeof row.context.rank === 'string' ? row.context.rank : 'novice';
        const points = Number.isSafeInteger(row.context.points) ? row.context.points as number : 0;
        return { rank, points };
      },
      (a, b) => b.primaryValue - a.primaryValue || a.updatedAt.localeCompare(b.updatedAt) || a.accountId.localeCompare(b.accountId),
    );
  }

  let playerEntry: BackendLeaderboardEntry | null = null;
  if (player !== null) {
    const accountId = await db.resolveAccount(player);
    const own = ranked.find((entry) => entry.accountId === accountId);
    playerEntry = own === undefined ? null : publicEntry(own);
  }
  return jsonResponse({ entries: ranked.slice(0, limit).map(publicEntry), playerEntry });
}

export async function handleLeaderboardSubmit(
  boardRaw: string,
  request: Request,
  player: VerifiedPikabuPlayer | null,
  db: BackendLeaderboardDb = new BackendDb(),
  now = new Date(),
): Promise<Response> {
  const board: BackendBoardKey = validateBoardKey(boardRaw);
  if (player === null || player.isAuthorized !== true) throw new HttpError(401, 'Verified authorized player is required.');
  let parsed;
  try { parsed = parseLeaderboardSubmitBody(board, await readJsonBody(request), now.toISOString().slice(0, 10)); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid leaderboard submission.');
  }
  const accountId = await db.resolveAccount(player);

  if (parsed.kind === 'standard') {
    const result = await db.upsertLeaderboard(accountId, parsed.operationId, 'standard', 'global', parsed.bestStreak, null, { bestStreak: parsed.bestStreak });
    return jsonResponse(result);
  }
  if (parsed.kind === 'daily') {
    const result = await db.submitDaily(accountId, parsed.operationId, parsed.dailyId, parsed.attemptId ?? null, parsed.moves, parsed.elapsedMs, parsed.completedOnTime);
    return jsonResponse(result);
  }
  if (parsed.kind === 'streak') {
    const own = (await db.listDailyStreak(parsed.todayId, accountId))[0];
    return jsonResponse({ status: 'derived', metric: { current: own?.current ?? 0, best: own?.best ?? 0 } });
  }

  const profile = normalizeMetaSave(parsed.profile);
  const points = lifetimeMasteryPoints(profile);
  const ranks = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'] as const;
  const rankOrdinal = Math.max(1, ranks.indexOf(profile.mastery.rank) + 1);
  const primaryValue = rankOrdinal * 1_000_000_000 + points;
  const result = await db.upsertLeaderboard(
    accountId,
    parsed.operationId,
    'mastery',
    'global',
    primaryValue,
    points,
    { rank: profile.mastery.rank, points },
  );
  return jsonResponse(result);
}
