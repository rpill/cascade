export interface VerifiedPikabuPlayer {
  readonly id: string;
  readonly name?: string;
  readonly avatar?: string;
  readonly isAuthorized: boolean;
}

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new AuthError('Invalid JWT base64url segment.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { throw new AuthError('Invalid JWT base64url segment.'); }
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonSegment(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not object');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Invalid JWT JSON segment.');
  }
}

function normalizedOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function normalizedAvatar(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch { return undefined; }
}

export async function verifyPikabuSignedData(
  token: string,
  secret: string,
  requireAuthorized = true,
): Promise<VerifiedPikabuPlayer> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new AuthError('Invalid JWT shape.');
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const header = decodeJsonSegment(headerB64);
  if (header.alg !== 'HS256') throw new AuthError('Pikabu token must use HS256.');
  if (!secret) throw new AuthError('Pikabu game secret is not configured.');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureBytes = decodeBase64Url(signatureB64);
  const signature = new Uint8Array(signatureBytes.byteLength);
  signature.set(signatureBytes);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature.buffer,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new AuthError('Invalid Pikabu token signature.');

  const payload = decodeJsonSegment(payloadB64);
  const rawId = payload.id;
  if ((typeof rawId !== 'string' && typeof rawId !== 'number') || String(rawId).trim().length === 0 || String(rawId).trim().length > 256) {
    throw new AuthError('Pikabu token is missing a valid player id.');
  }
  if (typeof payload.isAuthorized !== 'boolean') throw new AuthError('Pikabu token authorization flag is invalid.');
  if (requireAuthorized && payload.isAuthorized !== true) throw new AuthError('Authorized Pikabu player is required.');

  const name = normalizedOptionalString(payload.name, 100);
  const avatar = normalizedAvatar(payload.avatar);
  return {
    id: String(rawId).trim(),
    ...(name === undefined ? {} : { name }),
    ...(avatar === undefined ? {} : { avatar }),
    isAuthorized: payload.isAuthorized,
  };
}
