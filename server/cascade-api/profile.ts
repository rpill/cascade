import { mergeCloudSnapshots } from '../../src/cloud/CloudMerge.ts';
import { normalizeCloudSnapshot, type CloudSnapshot } from '../../src/cloud/CloudSnapshot.ts';
import { HttpError, jsonResponse, readJsonBody } from './http.ts';
import type { CascadeStore } from './store.ts';
import { parseProfilePutBody } from './validation.ts';

function parseRemoteProfile(serialized: string | null): CloudSnapshot | null {
  if (serialized === null || serialized === '') return null;
  try {
    const normalized = normalizeCloudSnapshot(JSON.parse(serialized) as unknown);
    if (normalized === null) throw new Error('invalid snapshot');
    return normalized;
  } catch {
    throw new HttpError(502, 'Stored cloud profile is malformed.');
  }
}

function normalizedProfile(value: unknown, label: string): CloudSnapshot {
  const normalized = normalizeCloudSnapshot(value);
  if (normalized === null) throw new HttpError(400, `Invalid ${label} cloud profile.`);
  return normalized;
}

export async function handleGetProfile(pikabuId: string, store: CascadeStore): Promise<Response> {
  const profile = parseRemoteProfile(await store.readProfile(pikabuId));
  return jsonResponse({ profile });
}

export async function handlePutProfile(
  request: Request,
  pikabuId: string,
  store: CascadeStore,
  now = new Date(),
): Promise<Response> {
  let parsed;
  try { parsed = parseProfilePutBody(await readJsonBody(request)); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid profile request.');
  }
  const base = parsed.base === null ? null : normalizedProfile(parsed.base, 'base');
  const local = normalizedProfile(parsed.profile, 'local');
  const todayId = now.toISOString().slice(0, 10);
  const cloud = parseRemoteProfile(await store.readProfile(pikabuId));
  const merged = mergeCloudSnapshots({ base, local, cloud, todayId });
  await store.writeProfile(pikabuId, JSON.stringify(merged), now.getTime());
  return jsonResponse({ profile: merged });
}
