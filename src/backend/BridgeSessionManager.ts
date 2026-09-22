import type {
  BackendIdentityProvider,
  BackendSessionProvider,
} from '../platform/services.ts';

const REFRESH_HEADROOM_MS = 30_000;

type CachedSession = { readonly token: string; readonly expiresAtMs: number };

type SessionResponse = { readonly token: string; readonly expiresAtMs: number };

function isSessionResponse(value: unknown): value is SessionResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return typeof raw.token === 'string' && raw.token.length > 0 && Number.isFinite(raw.expiresAtMs);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; }
  catch { return text; }
}

export class BridgeSessionManager implements BackendSessionProvider {
  private readonly baseUrl: string;
  private readonly identity: BackendIdentityProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly nowMs: () => number;
  private cached: CachedSession | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(options: {
    readonly baseUrl: string;
    readonly identity: BackendIdentityProvider;
    readonly fetchImpl?: typeof fetch;
    readonly nowMs?: () => number;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.identity = options.identity;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  invalidate(): void {
    this.cached = null;
    this.inFlight = null;
  }

  async getToken(): Promise<string> {
    if (!this.identity.isAuthorized()) throw new Error('Authorized backend identity is required.');
    if (this.cached !== null && this.cached.expiresAtMs - this.nowMs() > REFRESH_HEADROOM_MS) return this.cached.token;
    if (this.inFlight !== null) return this.inFlight;
    const pending = this.bootstrap();
    this.inFlight = pending;
    try { return await pending; }
    finally { if (this.inFlight === pending) this.inFlight = null; }
  }

  private async postSession(body: Record<string, unknown>): Promise<{ readonly response: Response; readonly body: unknown }> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { response, body: await readResponseBody(response) };
  }

  private acceptSession(body: unknown): string {
    if (!isSessionResponse(body)) throw new Error('Backend returned an invalid bridge session.');
    if (body.expiresAtMs <= this.nowMs()) throw new Error('Backend returned an expired bridge session.');
    this.cached = { token: body.token, expiresAtMs: body.expiresAtMs };
    return body.token;
  }

  private async bootstrap(): Promise<string> {
    const assertion = await this.identity.getAssertion();
    if (assertion === null || assertion.provider !== 'pikabu' || !assertion.value) throw new Error('Pikabu identity assertion is required.');

    const result = await this.postSession({ signedData: assertion.value });
    if (!result.response.ok) {
      throw new Error(`Bridge session request failed with status ${result.response.status}.`);
    }
    return this.acceptSession(result.body);
  }
}
