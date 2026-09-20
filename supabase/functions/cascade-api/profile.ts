import { normalizeCloudSnapshot } from '../../../src/cloud/CloudSnapshot.ts';
import type { VerifiedPikabuPlayer } from './auth.ts';
import { BackendDb } from './db.ts';
import { HttpError, jsonResponse, readJsonBody } from './http.ts';
import { parseProfilePutBody } from './validation.ts';

export async function handleGetProfile(player: VerifiedPikabuPlayer, db = new BackendDb()): Promise<Response> {
  const accountId = await db.resolveAccount(player);
  const row = await db.getProfile(accountId);
  return row === null
    ? jsonResponse({ revision: 0, profile: null, updatedAt: null })
    : jsonResponse({ revision: row.revision, profile: row.profile, updatedAt: row.updated_at });
}

export async function handlePutProfile(request: Request, player: VerifiedPikabuPlayer, db = new BackendDb()): Promise<Response> {
  let parsed;
  try { parsed = parseProfilePutBody(await readJsonBody(request)); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid profile request.');
  }
  const profile = normalizeCloudSnapshot(parsed.profile);
  if (profile === null) throw new HttpError(400, 'Invalid cloud profile.');
  const accountId = await db.resolveAccount(player);
  const result = await db.putProfile(accountId, parsed.operationId, parsed.expectedRevision, profile.schemaVersion, profile);
  return jsonResponse({ revision: result.revision, profile: result.profile }, result.status === 'conflict' ? 409 : 200);
}
