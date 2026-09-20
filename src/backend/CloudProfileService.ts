import { normalizeCloudSnapshot, type CloudSnapshot } from '../cloud/CloudSnapshot.ts';
import type { PendingProfileOperation } from '../cloud/CloudSyncState.ts';
import { BackendClient, BackendHttpError } from './BackendClient.ts';

export type CloudProfileLoad = {
  readonly revision: number;
  readonly profile: CloudSnapshot | null;
  readonly updatedAt: string | null;
};

export type CloudProfileSaveResult =
  | { readonly status: 'saved'; readonly revision: number; readonly profile: CloudSnapshot }
  | { readonly status: 'conflict'; readonly revision: number; readonly profile: CloudSnapshot | null };

function normalizeRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Backend returned an invalid profile revision.');
  return value as number;
}

function normalizeProfile(value: unknown, allowNull: true): CloudSnapshot | null;
function normalizeProfile(value: unknown, allowNull: false): CloudSnapshot;
function normalizeProfile(value: unknown, allowNull: boolean): CloudSnapshot | null {
  if (value === null && allowNull) return null;
  const normalized = normalizeCloudSnapshot(value);
  if (normalized === null) throw new Error('Backend returned an invalid cloud profile.');
  return normalized;
}

export class CloudProfileService {
  private readonly client: BackendClient;
  constructor(client: BackendClient) { this.client = client; }

  async load(): Promise<CloudProfileLoad> {
    const body = await this.client.request<{ revision: unknown; profile: unknown; updatedAt: unknown }>('/v1/profile');
    const revision = normalizeRevision(body.revision);
    const profile = normalizeProfile(body.profile, true);
    const updatedAt = body.updatedAt === null ? null : typeof body.updatedAt === 'string' ? body.updatedAt : (() => { throw new Error('Backend returned an invalid updatedAt value.'); })();
    return { revision, profile, updatedAt };
  }

  async save(operation: PendingProfileOperation): Promise<CloudProfileSaveResult> {
    try {
      const body = await this.client.request<{ revision: unknown; profile: unknown }>('/v1/profile', {
        method: 'PUT',
        body: JSON.stringify({
          operationId: operation.operationId,
          expectedRevision: operation.expectedRevision,
          profile: operation.profile,
        }),
      });
      return {
        status: 'saved',
        revision: normalizeRevision(body.revision),
        profile: normalizeProfile(body.profile, false),
      };
    } catch (error) {
      if (!(error instanceof BackendHttpError) || error.status !== 409 || typeof error.body !== 'object' || error.body === null || Array.isArray(error.body)) throw error;
      const body = error.body as Record<string, unknown>;
      return {
        status: 'conflict',
        revision: normalizeRevision(body.revision),
        profile: normalizeProfile(body.profile, true),
      };
    }
  }
}
