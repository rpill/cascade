import type { D1DatabaseLike } from './d1.ts';

export interface CloudflareEnv {
  readonly DB?: D1DatabaseLike;
  readonly PIKABU_GAME_SECRET?: string;
  readonly BRIDGE_SESSION_SECRET?: string;
  readonly CASCADE_ALLOWED_ORIGINS?: string;
}

export interface CloudflareRuntimeConfig {
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly allowedOrigins: string;
}

function requiredString(env: CloudflareEnv, name: keyof CloudflareEnv): string {
  const raw = env[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw new Error(`${String(name)} is required.`);
  return value;
}

export function loadCloudflareRuntimeConfig(env: CloudflareEnv): CloudflareRuntimeConfig {
  return {
    pikabuSecret: requiredString(env, 'PIKABU_GAME_SECRET'),
    bridgeSecret: requiredString(env, 'BRIDGE_SESSION_SECRET'),
    allowedOrigins: requiredString(env, 'CASCADE_ALLOWED_ORIGINS'),
  };
}
