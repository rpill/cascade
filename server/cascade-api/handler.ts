import { FixedWindowRateLimiter, HttpError, corsHeaders, jsonResponse, requestIpHint } from './http.ts';
import { handleLeaderboardRead, handleLeaderboardSubmit } from './leaderboards.ts';
import { handleGetProfile, handlePutProfile } from './profile.ts';
import { BridgeSessionError, handleSession, verifyBridgeSession, type BridgeClaims } from './session.ts';
import type { CascadeStore } from './store.ts';

export interface CascadeHandlerDependencies {
  readonly store: CascadeStore;
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly allowedOrigins: string;
  readonly limiter?: FixedWindowRateLimiter;
}

async function resolveBridgeClaims(request: Request, secret: string, required: boolean): Promise<BridgeClaims | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    if (required) throw new HttpError(401, 'Authorization is required.');
    return null;
  }
  try { return await verifyBridgeSession(authorization.slice(7), secret); }
  catch (error) { throw new HttpError(401, error instanceof BridgeSessionError ? error.message : 'Invalid authorization.'); }
}

export function createCascadeHandler(dependencies: CascadeHandlerDependencies): (request: Request) => Promise<Response> {
  const limiter = dependencies.limiter ?? new FixedWindowRateLimiter();
  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname || '/';
    if (path === '/v1/session') {
      if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      if (!limiter.check(`ip:${requestIpHint(request)}`, 'write')) throw new HttpError(429, 'Too many requests.');
      return handleSession(request, { pikabuSecret: dependencies.pikabuSecret, bridgeSecret: dependencies.bridgeSecret, store: dependencies.store });
    }
    if (path === '/v1/profile') {
      const claims = await resolveBridgeClaims(request, dependencies.bridgeSecret, true) as BridgeClaims;
      const kind = request.method === 'GET' ? 'read' : 'write';
      if (!limiter.check(`account:${claims.pikabuId}`, kind)) throw new HttpError(429, 'Too many requests.');
      if (request.method === 'GET') return handleGetProfile(claims.pikabuId, dependencies.store);
      if (request.method === 'PUT') return handlePutProfile(request, claims.pikabuId, dependencies.store);
      throw new HttpError(405, 'Method not allowed.');
    }
    const match = path.match(/^\/v1\/leaderboards\/([^/]+)$/);
    if (match) {
      const board = decodeURIComponent(match[1]!);
      if (request.method !== 'GET' && request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      const submitting = request.method === 'POST';
      const claims = await resolveBridgeClaims(request, dependencies.bridgeSecret, submitting);
      const rateKey = claims ? `account:${claims.pikabuId}` : `ip:${requestIpHint(request)}`;
      if (!limiter.check(rateKey, submitting ? 'write' : 'read')) throw new HttpError(429, 'Too many requests.');
      return submitting
        ? handleLeaderboardSubmit(board, request, claims, dependencies.store)
        : handleLeaderboardRead(board, url, claims, dependencies.store);
    }
    throw new HttpError(404, 'Not found.');
  }
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const cors = corsHeaders(origin, dependencies.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const response = await route(request);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : 'Internal server error.';
      return jsonResponse({ error: message }, status, cors);
    }
  };
}
