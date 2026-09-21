import type { BackendIdentityProvider } from '../platform/services.ts';

export class BackendHttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, message = `Backend request failed with status ${status}.`) {
    super(message);
    this.name = 'BackendHttpError';
    this.status = status;
    this.body = body;
  }
}

export class BackendClient {
  private readonly baseUrl: string;
  private readonly identity: BackendIdentityProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, identity: BackendIdentityProvider, fetchImpl?: typeof fetch, timeoutMs = 10_000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.identity = identity;
    this.fetchImpl = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = timeoutMs;
  }

  async request<T>(path: string, init: RequestInit & { readonly authorized?: boolean } = {}): Promise<T> {
    const { authorized = true, ...requestInit } = init;
    const headers = new Headers(requestInit.headers);
    if (authorized) {
      const assertion = await this.identity.getAssertion();
      if (assertion === null || !assertion.value) throw new Error('Backend identity assertion is required.');
      headers.set('authorization', `Bearer ${assertion.value}`);
    }
    if (requestInit.body !== undefined && requestInit.body !== null && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const external = requestInit.signal;
    const abortExternal = () => controller.abort();
    external?.addEventListener('abort', abortExternal, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...requestInit,
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try { body = JSON.parse(text) as unknown; }
        catch {
          if (response.ok) throw new Error('Backend returned invalid JSON.');
          body = text;
        }
      }
      if (!response.ok) throw new BackendHttpError(response.status, body);
      return body as T;
    } catch (error) {
      if (controller.signal.aborted && !external?.aborted) throw new Error('Backend request timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', abortExternal);
    }
  }
}
