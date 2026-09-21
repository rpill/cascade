import {
  DAILY_LEADERBOARD_NAME,
  DAILY_STREAK_LEADERBOARD_NAME,
  MASTERY_LEADERBOARD_NAME,
  STANDARD_LEADERBOARD_NAME,
  encodeDailyLeaderboardScore,
} from '../leaderboards/LeaderboardConfig.ts';
import type {
  PlatformLeaderboardEntry,
  PlatformLeaderboardReadOptions,
  PlatformLeaderboardSubmissionContext,
  PlatformLeaderboards,
} from './services.ts';

export interface GamePushLeaderboardPlayer {
  readonly id?: string | number;
  readonly name?: string;
  readonly avatar?: string;
  readonly position?: number;
  readonly [key: string]: unknown;
}

export interface GamePushLeaderboardFetchResult {
  readonly players?: readonly GamePushLeaderboardPlayer[];
  readonly topPlayers?: readonly GamePushLeaderboardPlayer[];
  readonly player?: GamePushLeaderboardPlayer | null;
}

export interface GamePushLeaderboardApi {
  fetchScoped(query: {
    readonly tag: string;
    readonly variant: string;
    readonly order: 'ASC' | 'DESC';
    readonly limit: number;
    readonly withMe: 'none' | 'first' | 'last';
  }): Promise<GamePushLeaderboardFetchResult>;
  fetchPlayerRatingScoped(query: {
    readonly tag: string;
    readonly variant: string;
  }): Promise<GamePushLeaderboardFetchResult>;
  publishRecord(query: {
    readonly tag: string;
    readonly variant: string;
    readonly record: Readonly<Record<string, number>>;
    readonly override?: boolean;
  }): Promise<unknown>;
}

type BoardKind = 'standard' | 'daily' | 'mastery';

interface BoardDefinition {
  readonly kind: BoardKind;
  readonly tag: string;
  readonly order: 'ASC' | 'DESC';
}

const BOARDS: Readonly<Record<string, BoardDefinition>> = {
  [STANDARD_LEADERBOARD_NAME]: { kind: 'standard', tag: 'cascadeStandard', order: 'DESC' },
  [DAILY_LEADERBOARD_NAME]: { kind: 'daily', tag: 'cascadeDaily', order: 'ASC' },
  [MASTERY_LEADERBOARD_NAME]: { kind: 'mastery', tag: 'cascadeMastery', order: 'DESC' },
};

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function requiredPositiveInteger(value: unknown): number | null {
  const number = safeInteger(value);
  return number !== null && number > 0 ? number : null;
}

function playerIdentity(player: GamePushLeaderboardPlayer): { id: string; name: string; avatar?: string } {
  const id = player.id === undefined ? '' : String(player.id);
  const name = typeof player.name === 'string' ? player.name : '';
  const avatar = typeof player.avatar === 'string' ? player.avatar.trim() : '';
  return { id, name, ...(avatar ? { avatar } : {}) };
}

function scoreForPlayer(
  board: BoardDefinition,
  player: GamePushLeaderboardPlayer,
  scopeKey: string | undefined,
): number | null {
  if (board.kind === 'standard') return requiredPositiveInteger(player.bestStreak);
  if (board.kind === 'mastery') return requiredPositiveInteger(player.masteryPoints);
  if (!scopeKey) return null;
  const moves = requiredPositiveInteger(player.moves);
  const elapsedMs = requiredPositiveInteger(player.elapsedMs);
  if (moves === null || elapsedMs === null) return null;
  try { return encodeDailyLeaderboardScore(scopeKey, moves, elapsedMs); }
  catch { return null; }
}

function normalizePlayer(
  board: BoardDefinition,
  player: GamePushLeaderboardPlayer,
  scopeKey: string | undefined,
): PlatformLeaderboardEntry | null {
  const rank = requiredPositiveInteger(player.position);
  const score = scoreForPlayer(board, player, scopeKey);
  if (rank === null || score === null) return null;
  const identity = playerIdentity(player);
  return {
    rank,
    score,
    playerId: identity.id,
    publicName: identity.name,
    ...(identity.avatar ? { avatarUrl: identity.avatar } : {}),
  };
}

function variantFor(board: BoardDefinition, scopeKey: string | undefined): string | null {
  if (board.kind === 'daily') return scopeKey?.trim() || null;
  return 'global';
}

export class GamePushLeaderboards implements PlatformLeaderboards {
  readonly available = true;
  private readonly api: GamePushLeaderboardApi;
  private readonly nowMs: () => number;

  constructor(api: GamePushLeaderboardApi, nowMs: () => number = () => Date.now()) {
    this.api = api;
    this.nowMs = nowMs;
  }

  async getEntries(technicalName: string, options: PlatformLeaderboardReadOptions): Promise<PlatformLeaderboardEntry[]> {
    if (technicalName === DAILY_STREAK_LEADERBOARD_NAME) return [];
    const board = BOARDS[technicalName];
    if (!board) return [];
    const variant = variantFor(board, options.scopeKey);
    if (variant === null) return [];
    const limit = Math.max(1, Math.min(100, Math.trunc(options.quantityTop)));
    const result = await this.api.fetchScoped({
      tag: board.tag,
      variant,
      order: board.order,
      limit,
      withMe: 'none',
    });
    const players = result.topPlayers ?? result.players ?? [];
    return players
      .map((player) => normalizePlayer(board, player, options.scopeKey))
      .filter((entry): entry is PlatformLeaderboardEntry => entry !== null);
  }

  async getPlayerEntry(technicalName: string, options?: { readonly scopeKey?: string }): Promise<PlatformLeaderboardEntry | null> {
    if (technicalName === DAILY_STREAK_LEADERBOARD_NAME) return null;
    const board = BOARDS[technicalName];
    if (!board) return null;
    const variant = variantFor(board, options?.scopeKey);
    if (variant === null) return null;
    const result = await this.api.fetchPlayerRatingScoped({ tag: board.tag, variant });
    return result.player ? normalizePlayer(board, result.player, options?.scopeKey) : null;
  }

  async setScore(
    technicalName: string,
    score: number,
    context?: PlatformLeaderboardSubmissionContext,
  ): Promise<void> {
    if (technicalName === DAILY_STREAK_LEADERBOARD_NAME) return;
    const board = BOARDS[technicalName];
    if (!board) return;

    if (board.kind === 'standard') {
      const bestStreak = context?.kind === 'standard' ? context.bestStreak : score;
      if (!Number.isSafeInteger(bestStreak) || bestStreak <= 0) return;
      await this.api.publishRecord({
        tag: board.tag,
        variant: 'global',
        record: { bestStreak },
      });
      return;
    }

    if (board.kind === 'mastery') {
      if (!Number.isSafeInteger(score) || score <= 0) return;
      await this.api.publishRecord({
        tag: board.tag,
        variant: 'global',
        record: { masteryPoints: score },
      });
      return;
    }

    if (context?.kind !== 'daily') return;
    const moves = Math.round(context.moves);
    const elapsedMs = Math.round(context.elapsedMs);
    if (!Number.isSafeInteger(moves) || moves <= 0 || !Number.isSafeInteger(elapsedMs) || elapsedMs <= 0) return;
    const completedAt = Math.round(this.nowMs());
    await this.api.publishRecord({
      tag: board.tag,
      variant: context.dailyId,
      record: { moves, elapsedMs, completedAt },
    });
  }
}
