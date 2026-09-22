import { normalizeCloudSnapshot, type CloudSnapshot } from '../cloud/CloudSnapshot.ts';
import type { PendingProfileOperation } from '../cloud/CloudSyncState.ts';
import { BackendClient } from './BackendClient.ts';

export type CloudProfileLoad = { readonly profile: CloudSnapshot | null };
export type CloudProfileSaveResult = { readonly profile: CloudSnapshot };

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
    const body = await this.client.request<{ profile: unknown }>('/v1/profile');
    return { profile: normalizeProfile(body.profile, true) };
  }

  async save(operation: PendingProfileOperation): Promise<CloudProfileSaveResult> {
    const body = await this.client.request<{ profile: unknown }>('/v1/profile', {
      method: 'PUT',
      body: JSON.stringify({ base: operation.base, profile: operation.profile }),
    });
    return { profile: normalizeProfile(body.profile, false) };
  }
}
