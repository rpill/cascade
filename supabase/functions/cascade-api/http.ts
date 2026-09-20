export const MAX_BODY_BYTES = 262_144;

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = 'HttpError'; }
}

export function corsHeaders(origin: string | null, allowedOriginsCsv: string): Record<string, string> {
  const allowed = new Set(allowedOriginsCsv.split(',').map((value) => value.trim()).filter(Boolean));
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  };
  if (origin !== null && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...Object.fromEntries(new Headers(headers)) },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

interface WindowState { startMs: number; reads: number; writes: number }
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly readsPerMinute: number;
  private readonly writesPerMinute: number;
  constructor(readsPerMinute = 120, writesPerMinute = 60) { this.readsPerMinute = readsPerMinute; this.writesPerMinute = writesPerMinute; }
  check(key: string, kind: 'read' | 'write', nowMs = Date.now()): boolean {
    const minuteMs = 60_000;
    let state = this.windows.get(key);
    if (state === undefined || nowMs - state.startMs >= minuteMs) {
      state = { startMs: nowMs, reads: 0, writes: 0 };
      this.windows.set(key, state);
    }
    if (kind === 'read') {
      if (state.reads >= this.readsPerMinute) return false;
      state.reads += 1;
      return true;
    }
    if (state.writes >= this.writesPerMinute) return false;
    state.writes += 1;
    return true;
  }
}

export function requestIpHint(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}
