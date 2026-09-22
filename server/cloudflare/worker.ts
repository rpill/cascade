import { createCascadeHandler } from '../cascade-api/handler.ts';
import { loadCloudflareRuntimeConfig, type CloudflareEnv } from './config.ts';
import { D1CascadeStore } from './d1.ts';

export type CloudflareWorkerRuntimeFactory = (env: CloudflareEnv) => (request: Request) => Promise<Response>;

function buildRuntime(env: CloudflareEnv): (request: Request) => Promise<Response> {
  const config = loadCloudflareRuntimeConfig(env);
  if (!env.DB) throw new Error('DB is required.');
  const store = new D1CascadeStore(env.DB);
  return createCascadeHandler({ store, pikabuSecret: config.pikabuSecret, bridgeSecret: config.bridgeSecret, allowedOrigins: config.allowedOrigins });
}

export function createCloudflareWorker(factory: CloudflareWorkerRuntimeFactory = buildRuntime) {
  let runtime: ((request: Request) => Promise<Response>) | undefined;
  return {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
      try {
        runtime ??= factory(env);
        return await runtime(request);
      } catch {
        return new Response(JSON.stringify({ error: 'Internal server error.' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
      }
    },
  };
}

export default createCloudflareWorker();
