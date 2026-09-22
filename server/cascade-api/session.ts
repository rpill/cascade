import { AuthError, verifyPikabuSignedData } from './auth.ts';
import { HttpError, jsonResponse, readJsonBody } from './http.ts';
import type { CascadeStore } from './store.ts';

const BRIDGE_ISSUER = 'cascade-bridge';
const BRIDGE_AUDIENCE = 'cascade-pikabu';
const BRIDGE_LIFETIME_SECONDS = 30 * 60;

export interface BridgeClaims {
  readonly pikabuId: string;
  readonly name: string;
  readonly avatar: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface SessionRequestBody {
  readonly signedData: string;
}

export interface SessionDependencies {
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly store: CascadeStore;
  readonly nowSeconds?: () => number;
}

export interface EstablishedBridgeSession {
  readonly token: string;
  readonly expiresAtMs: number;
  readonly claims: BridgeClaims;
}

export class BridgeSessionError extends Error {
  constructor(message: string) { super(message); this.name = 'BridgeSessionError'; }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textToBase64Url(text: string): string { return bytesToBase64Url(new TextEncoder().encode(text)); }

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new BridgeSessionError('Invalid bridge JWT base64url segment.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new BridgeSessionError('Invalid bridge JWT base64url segment.');
  }
}

function decodeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not object');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BridgeSessionError) throw error;
    throw new BridgeSessionError('Invalid bridge JWT JSON.');
  }
}

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (!secret) throw new BridgeSessionError('Bridge session secret is not configured.');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

export async function signBridgeSession(
  identity: { readonly pikabuId: string; readonly name: string; readonly avatar: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ readonly token: string; readonly expiresAtMs: number }> {
  if (!identity.pikabuId || identity.pikabuId.length > 256) throw new BridgeSessionError('Invalid Pikabu player id.');
  const header = textToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = nowSeconds + BRIDGE_LIFETIME_SECONDS;
  const payload = textToBase64Url(JSON.stringify({
    iss: BRIDGE_ISSUER,
    aud: BRIDGE_AUDIENCE,
    sub: identity.pikabuId,
    pid: identity.pikabuId,
    name: identity.name,
    avatar: identity.avatar,
    iat: nowSeconds,
    exp,
  }));
  const input = `${header}.${payload}`;
  const key = await hmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return { token: `${input}.${bytesToBase64Url(new Uint8Array(signature))}`, expiresAtMs: exp * 1000 };
}

export async function verifyBridgeSession(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<BridgeClaims> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new BridgeSessionError('Invalid bridge JWT shape.');
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const header = decodeJson(headerB64);
  if (header.alg !== 'HS256') throw new BridgeSessionError('Bridge token must use HS256.');
  const key = await hmacKey(secret, ['verify']);
  const signatureBytes = base64UrlToBytes(signatureB64);
  const signature = new Uint8Array(signatureBytes.byteLength); signature.set(signatureBytes);
  const valid = await crypto.subtle.verify('HMAC', key, signature.buffer, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  if (!valid) throw new BridgeSessionError('Invalid bridge token signature.');

  const payload = decodeJson(payloadB64);
  if (payload.iss !== BRIDGE_ISSUER) throw new BridgeSessionError('Invalid bridge token issuer.');
  if (payload.aud !== BRIDGE_AUDIENCE) throw new BridgeSessionError('Invalid bridge token audience.');
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 256) throw new BridgeSessionError('Invalid bridge token sub.');
  if (typeof payload.pid !== 'string' || payload.pid.length === 0 || payload.pid.length > 256) throw new BridgeSessionError('Invalid bridge token pid.');
  if (payload.sub !== payload.pid) throw new BridgeSessionError('Bridge token identity mismatch.');
  if (!Number.isSafeInteger(payload.iat)) throw new BridgeSessionError('Invalid bridge token iat.');
  if (!Number.isSafeInteger(payload.exp) || (payload.exp as number) <= nowSeconds) throw new BridgeSessionError('Bridge token expired.');
  return {
    pikabuId: payload.pid,
    name: typeof payload.name === 'string' ? payload.name.slice(0, 100) : '',
    avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 2048) : '',
    issuedAt: payload.iat as number,
    expiresAt: payload.exp as number,
  };
}

export function parseSessionRequestBody(value: unknown): SessionRequestBody {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpError(400, 'Invalid session request.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.signedData !== 'string' || raw.signedData.length === 0 || raw.signedData.length > 16_384) throw new HttpError(400, 'Invalid Pikabu signed data.');
  return { signedData: raw.signedData };
}

export async function establishBridgeSession(body: SessionRequestBody, dependencies: SessionDependencies): Promise<EstablishedBridgeSession> {
  const player = await verifyPikabuSignedData(body.signedData, dependencies.pikabuSecret, true);
  const name = player.name ?? '';
  const avatar = player.avatar ?? '';
  const now = dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
  await dependencies.store.upsertPlayer({ pikabuId: player.id, publicName: name, avatarUrl: avatar }, now * 1000);
  const signed = await signBridgeSession({ pikabuId: player.id, name, avatar }, dependencies.bridgeSecret, now);
  const claims: BridgeClaims = { pikabuId: player.id, name, avatar, issuedAt: now, expiresAt: Math.floor(signed.expiresAtMs / 1000) };
  return { ...signed, claims };
}

export async function handleSession(request: Request, dependencies: SessionDependencies): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = parseSessionRequestBody(await readJsonBody(request));
  try {
    const session = await establishBridgeSession(body, dependencies);
    return jsonResponse({ token: session.token, expiresAtMs: session.expiresAtMs });
  } catch (error) {
    if (error instanceof AuthError || error instanceof BridgeSessionError) throw new HttpError(401, error.message);
    throw error;
  }
}
