const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAILY_ID_RE = /^\d{4}-\d{2}-\d{2}$/;
export const BACKEND_BOARD_KEYS = ['standard', 'daily', 'daily-streak', 'mastery'] as const;
export type BackendBoardKey = typeof BACKEND_BOARD_KEYS[number];

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function validateBoardKey(value: unknown): BackendBoardKey {
  if (typeof value !== 'string' || !BACKEND_BOARD_KEYS.includes(value as BackendBoardKey)) throw new Error('Unsupported leaderboard board.');
  return value as BackendBoardKey;
}

export function validateDailyId(value: unknown): string {
  if (typeof value !== 'string' || !DAILY_ID_RE.test(value)) throw new Error('Invalid Daily id.');
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error('Invalid Daily id.');
  return value;
}

export interface ProfilePutBody {
  readonly base: unknown;
  readonly profile: unknown;
}

export function parseProfilePutBody(value: unknown): ProfilePutBody {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid profile body.');
  const raw = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(raw, 'base')) throw new Error('Missing base profile.');
  if (raw.base !== null && (typeof raw.base !== 'object' || Array.isArray(raw.base))) throw new Error('Invalid base profile.');
  if (raw.profile === undefined) throw new Error('Missing profile.');
  return { base: raw.base, profile: raw.profile };
}

export type BackendSubmitBody =
  | { readonly operationId: string; readonly kind: 'standard'; readonly bestStreak: number }
  | { readonly operationId: string; readonly kind: 'daily'; readonly dailyId: string; readonly moves: number; readonly elapsedMs: number; readonly completedOnTime: boolean; readonly attemptId?: string }
  | { readonly operationId: string; readonly kind: 'streak'; readonly todayId: string }
  | { readonly operationId: string; readonly kind: 'mastery'; readonly profile: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLeaderboardLimit(value: string | null, fallback = 20): number {
  if (value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) throw new Error('Leaderboard limit must be between 1 and 100.');
  return parsed;
}

export function parseLeaderboardSubmitBody(
  board: BackendBoardKey,
  value: unknown,
  serverTodayId = new Date().toISOString().slice(0, 10),
): BackendSubmitBody {
  if (!isRecord(value) || !isUuid(value.operationId) || typeof value.kind !== 'string') throw new Error('Invalid leaderboard submission.');
  const expectedKind = board === 'daily-streak' ? 'streak' : board;
  if (value.kind !== expectedKind) throw new Error('Leaderboard route and submission kind do not match.');

  if (board === 'standard') {
    if (!Number.isSafeInteger(value.bestStreak) || (value.bestStreak as number) < 1 || (value.bestStreak as number) > 1_000_000) throw new Error('Invalid Standard streak.');
    return { operationId: value.operationId, kind: 'standard', bestStreak: value.bestStreak as number };
  }
  if (board === 'daily') {
    const dailyId = validateDailyId(value.dailyId);
    if (dailyId > serverTodayId) throw new Error('Future Daily results are not accepted.');
    if (!Number.isSafeInteger(value.moves) || (value.moves as number) < 1 || (value.moves as number) > 9999) throw new Error('Invalid Daily moves.');
    if (!Number.isSafeInteger(value.elapsedMs) || (value.elapsedMs as number) < 1 || (value.elapsedMs as number) > 99_999_999) throw new Error('Invalid Daily elapsed time.');
    if (typeof value.completedOnTime !== 'boolean') throw new Error('Invalid Daily completion flag.');
    if (value.attemptId !== undefined && (typeof value.attemptId !== 'string' || !/^[A-Za-z0-9_~\-]{1,100}$/.test(value.attemptId))) throw new Error('Invalid Daily attempt id.');
    return {
      operationId: value.operationId,
      kind: 'daily',
      dailyId,
      moves: value.moves as number,
      elapsedMs: value.elapsedMs as number,
      completedOnTime: value.completedOnTime,
      ...(value.attemptId === undefined ? {} : { attemptId: value.attemptId }),
    };
  }
  if (board === 'daily-streak') {
    const todayId = validateDailyId(value.todayId);
    if (todayId > serverTodayId) throw new Error('Future Daily streak anchors are not accepted.');
    return { operationId: value.operationId, kind: 'streak', todayId };
  }
  if (!isRecord(value.profile)) throw new Error('Invalid Mastery profile.');
  return { operationId: value.operationId, kind: 'mastery', profile: value.profile };
}
