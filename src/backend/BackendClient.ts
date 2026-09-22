import type { BackendSessionProvider } from '../platform/services.ts';

export const DEFAULT_BACKEND_REQUEST_TIMEOUT_MS = 30_000;

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
  private readonly session: BackendSessionProvider | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, session: BackendSessionProvider | null, fetchImpl?: typeof fetch, timeoutMs = DEFAULT_BACKEND_REQUEST_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.session = session;
    this.fetchImpl = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = timeoutMs;
  }

  private async perform<T>(path: string, requestInit: RequestInit, authorization: string | null): Promise<T> {
    const headers = new Headers(requestInit.headers);
    if (authorization !== null) headers.set('authorization', `Bearer ${authorization}`);
    if (requestInit.body !== undefined && requestInit.body !== null && !headers.has('content-type')) headers.set('content-type', 'application/json');

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

  async request<T>(path: string, init: RequestInit & { readonly authorized?: boolean } = {}): Promise<T> {
    const { authorized = true, ...requestInit } = init;
    if (!authorized) return this.perform<T>(path, requestInit, null);
    if (this.session === null) throw new Error('Backend session is required.');

    const firstToken = await this.session.getToken();
    try {
      return await this.perform<T>(path, requestInit, firstToken);
    } catch (error) {
      if (!(error instanceof BackendHttpError) || error.status !== 401) throw error;
    }

    this.session.invalidate();
    const secondToken = await this.session.getToken();
    return this.perform<T>(path, requestInit, secondToken);
  }
}
