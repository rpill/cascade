import type { VerifiedPikabuPlayer } from './auth.ts';
import type { BackendLeaderboardDb, PublicDailyRow, PublicLeaderboardRow } from './leaderboards.ts';

export interface StoredCloudProfile {
  readonly revision: number;
  readonly profile: unknown;
  readonly updated_at: string;
}

export interface ProfileRpcResult {
  readonly status: 'saved' | 'conflict';
  readonly revision: number;
  readonly profile: unknown;
}

function env(name: string): string {
  const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  const value = deno?.env?.get(name);
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export class BackendDb implements BackendLeaderboardDb {
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  constructor(baseUrl = env('SUPABASE_URL'), serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.serviceKey = serviceKey;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Database request failed (${response.status}): ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) as unknown : null;
  }

  async resolveAccount(player: VerifiedPikabuPlayer): Promise<string> {
    const value = await this.request('/rpc/cascade_resolve_account', {
      method: 'POST',
      body: JSON.stringify({
        p_provider: 'pikabu',
        p_provider_user_id: player.id,
        p_public_name: player.name ?? null,
        p_avatar_url: player.avatar ?? null,
      }),
    });
    if (typeof value !== 'string') throw new Error('Invalid account RPC response.');
    return value;
  }

  async getProfile(accountId: string): Promise<StoredCloudProfile | null> {
    const rows = await this.request(`/cloud_profiles?account_id=eq.${encodeURIComponent(accountId)}&select=revision,profile,updated_at&limit=1`) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;
    if (!Number.isSafeInteger(row.revision) || typeof row.updated_at !== 'string') throw new Error('Invalid profile DB row.');
    return { revision: row.revision as number, profile: row.profile, updated_at: row.updated_at };
  }

  async putProfile(accountId: string, operationId: string, expectedRevision: number, schemaVersion: number, profile: unknown): Promise<ProfileRpcResult> {
    const value = await this.request('/rpc/cascade_put_profile', {
      method: 'POST',
      body: JSON.stringify({
        p_account_id: accountId,
        p_operation_id: operationId,
        p_expected_revision: expectedRevision,
        p_schema_version: schemaVersion,
        p_profile: profile,
      }),
    }) as Record<string, unknown>;
    if ((value.status !== 'saved' && value.status !== 'conflict') || !Number.isSafeInteger(value.revision)) throw new Error('Invalid profile RPC response.');
    return { status: value.status, revision: value.revision as number, profile: value.profile };
  }

  async listStandard(): Promise<readonly PublicLeaderboardRow[]> {
    return this.listGenericBoard('standard');
  }

  async listMastery(): Promise<readonly PublicLeaderboardRow[]> {
    return this.listGenericBoard('mastery');
  }

  private async listGenericBoard(boardKey: string): Promise<readonly PublicLeaderboardRow[]> {
    const rows = await this.request(`/cascade_public_leaderboard_entries?board_key=eq.${encodeURIComponent(boardKey)}&scope_key=eq.global&select=account_id,player_id,public_name,avatar_url,primary_value,secondary_value,context,updated_at&order=primary_value.desc,secondary_value.asc.nullslast,updated_at.asc&limit=5000`) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        accountId: String(row.account_id ?? ''),
        playerId: String(row.player_id ?? ''),
        publicName: typeof row.public_name === 'string' && row.public_name.trim() ? row.public_name : 'Player',
        ...(typeof row.avatar_url === 'string' && row.avatar_url.trim() ? { avatarUrl: row.avatar_url } : {}),
        primaryValue: Number(row.primary_value ?? 0),
        secondaryValue: row.secondary_value === null || row.secondary_value === undefined ? null : Number(row.secondary_value),
        context: typeof row.context === 'object' && row.context !== null && !Array.isArray(row.context) ? row.context as Record<string, unknown> : {},
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
      } satisfies PublicLeaderboardRow;
    });
  }

  async listDaily(scope: string): Promise<readonly PublicDailyRow[]> {
    const rows = await this.request(`/cascade_public_daily_results?daily_id=eq.${encodeURIComponent(scope)}&select=account_id,player_id,public_name,avatar_url,daily_id,moves,elapsed_ms,completed_on_time,completed_at&order=moves.asc,elapsed_ms.asc,completed_at.asc&limit=5000`) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        accountId: String(row.account_id ?? ''),
        playerId: String(row.player_id ?? ''),
        publicName: typeof row.public_name === 'string' && row.public_name.trim() ? row.public_name : 'Player',
        ...(typeof row.avatar_url === 'string' && row.avatar_url.trim() ? { avatarUrl: row.avatar_url } : {}),
        dailyId: String(row.daily_id ?? ''),
        moves: Number(row.moves ?? 0),
        elapsedMs: Number(row.elapsed_ms ?? 0),
        completedOnTime: row.completed_on_time === true,
        completedAt: typeof row.completed_at === 'string' ? row.completed_at : '',
      } satisfies PublicDailyRow;
    });
  }

  async listDailyStreak(todayId: string, accountId?: string): Promise<readonly import('./leaderboards.ts').PublicDailyStreakRow[]> {
    const value = await this.request('/rpc/cascade_daily_streak_board', {
      method: 'POST',
      body: JSON.stringify({ p_today: todayId, ...(accountId === undefined ? {} : { p_account_id: accountId }) }),
    }) as unknown;
    if (!Array.isArray(value)) return [];
    return value.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        accountId: String(row.account_id ?? ''),
        playerId: String(row.player_id ?? ''),
        publicName: typeof row.public_name === 'string' && row.public_name.trim() ? row.public_name : 'Player',
        ...(typeof row.avatar_url === 'string' && row.avatar_url.trim() ? { avatarUrl: row.avatar_url } : {}),
        current: Number(row.current_streak ?? 0),
        best: Number(row.best_streak ?? 0),
      };
    });
  }

  async submitDaily(accountId: string, operationId: string, dailyId: string, attemptId: string | null, moves: number, elapsedMs: number, completedOnTime: boolean): Promise<Record<string, unknown>> {
    const value = await this.request('/rpc/cascade_submit_daily_result', {
      method: 'POST',
      body: JSON.stringify({
        p_account_id: accountId,
        p_operation_id: operationId,
        p_daily_id: dailyId,
        p_attempt_id: attemptId,
        p_moves: moves,
        p_elapsed_ms: elapsedMs,
        p_completed_on_time: completedOnTime,
      }),
    });
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid Daily RPC response.');
    return value as Record<string, unknown>;
  }

  async upsertLeaderboard(accountId: string, operationId: string, boardKey: string, scopeKey: string, primaryValue: number, secondaryValue: number | null, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const value = await this.request('/rpc/cascade_upsert_leaderboard_entry', {
      method: 'POST',
      body: JSON.stringify({
        p_account_id: accountId,
        p_operation_id: operationId,
        p_board_key: boardKey,
        p_scope_key: scopeKey,
        p_primary_value: primaryValue,
        p_secondary_value: secondaryValue,
        p_context: context,
      }),
    });
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid leaderboard RPC response.');
    return value as Record<string, unknown>;
  }

}
