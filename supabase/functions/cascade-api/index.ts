import { AuthError, verifyPikabuSignedData, type VerifiedPikabuPlayer } from './auth.ts';
import { BackendDb } from './db.ts';
import { FixedWindowRateLimiter, HttpError, corsHeaders, jsonResponse, requestIpHint } from './http.ts';
import { handleLeaderboardRead, handleLeaderboardSubmit } from './leaderboards.ts';
import { handleGetProfile, handlePutProfile } from './profile.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

const limiter = new FixedWindowRateLimiter();
const db = new BackendDb();
function serverEnv(name: string): string { return Deno.env.get(name) ?? ''; }

async function resolvePlayer(request: Request, required: boolean): Promise<VerifiedPikabuPlayer | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    if (required) throw new HttpError(401, 'Authorization is required.');
    return null;
  }
  try { return await verifyPikabuSignedData(authorization.slice(7), serverEnv('PIKABU_GAME_SECRET'), true); }
  catch (error) { throw new HttpError(401, error instanceof AuthError ? error.message : 'Invalid authorization.'); }
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^.*\/cascade-api/, '') || '/';
  if (path === '/v1/profile') {
    const player = await resolvePlayer(request, true) as VerifiedPikabuPlayer;
    const kind = request.method === 'GET' ? 'read' : 'write';
    if (!limiter.check(`account:${player.id}`, kind)) throw new HttpError(429, 'Too many requests.');
    if (request.method === 'GET') return handleGetProfile(player, db);
    if (request.method === 'PUT') return handlePutProfile(request, player, db);
    throw new HttpError(405, 'Method not allowed.');
  }

  const match = path.match(/^\/v1\/leaderboards\/([^/]+)(\/submit)?$/);
  if (match) {
    const board = decodeURIComponent(match[1]!);
    const submitting = match[2] === '/submit';
    if (submitting && request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    if (!submitting && request.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    const player = await resolvePlayer(request, submitting);
    const rateKey = player ? `account:${player.id}` : `ip:${requestIpHint(request)}`;
    if (!limiter.check(rateKey, submitting ? 'write' : 'read')) throw new HttpError(429, 'Too many requests.');
    return submitting
      ? handleLeaderboardSubmit(board, request, player, db)
      : handleLeaderboardRead(board, url, player, db);
  }
  throw new HttpError(404, 'Not found.');
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, serverEnv('CASCADE_ALLOWED_ORIGINS'));
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
});
