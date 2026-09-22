# Cloudflare Workers Runtime Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the not-yet-deployed Yandex Cloud adapter/deployment layer with one Cloudflare Worker on Workers Free while preserving the runtime-neutral Cascade backend and the existing `/v1/...` browser contract.

**Architecture:** Keep `server/cascade-api/*` as the sole backend business core. Add a thin Cloudflare module-worker adapter under `server/cloudflare/`, configure only non-secret Worker vars in `wrangler.jsonc`, declare the three required Worker secrets there, and use Wrangler for local dry-run/deploy. Remove only Yandex **Cloud** runtime/deploy artifacts; keep the unrelated `yandex-dev-proxy` and Yandex Games platform tooling.

**Tech Stack:** TypeScript 5.9, Node.js 22 test runner, Cloudflare Workers module syntax, Web `Request`/`Response`/Crypto APIs, Wrangler 4.x resolved and pinned by `pnpm-lock.yaml`, GamePush GraphQL, Vite/Phaser browser build.

**Spec:** `docs/superpowers/specs/2026-09-22-cloudflare-workers-runtime-replacement-design.md`

## Global Constraints

- Supabase remains completely absent.
- GamePush remains the only persistent backend store used by Cascade.
- Keep the browser REST contract unchanged: `POST /v1/session`, `GET|PUT /v1/profile`, `GET|POST /v1/leaderboards/:board`.
- Keep GamePush profile, mapping, Daily first-result immutability, eventual-consistency handling, and all four leaderboard score orders unchanged.
- Use one Cloudflare Worker, `workers.dev` initially, Workers Free only.
- Do not add KV, D1, R2, Durable Objects, Queues, Workflows, Hyperdrive, Pages Functions, custom DNS/domain, or a paid Workers plan.
- Do not enable `nodejs_compat`; the backend must remain Web-API-native.
- Secrets are exactly `PIKABU_GAME_SECRET`, `GAMEPUSH_API_SECRET`, and `BRIDGE_SESSION_SECRET`; none may appear in `wrangler.jsonc`, Vite env, source, smoke output, or browser bundle.
- All four GamePush leaderboard IDs must be explicit runtime configuration. Never guess the recreated Mastery ID and never add fallback IDs.
- Known IDs: `cascadeStandard=100307`, `cascadeDaily=100308`, `cascadeDailyStreak=100312`; `cascadeMastery` must come from the operator's actual recreated board configuration before the deploy config task can complete.
- Development CORS may explicitly allow `http://localhost:5173,http://127.0.0.1:5173`; production must add the actual Pikabu origin and must never use `*`.
- The user's untracked `server/yandex/.env.deploy.local` may contain live secrets. Never print, copy into source, archive, or silently delete it.
- Preserve `scripts/yandex-dev-proxy.mjs`, `scripts/yandex-dev-proxy-lib.mjs`, `yandex:dev`, and Yandex Games-specific tests; they are unrelated to Yandex Cloud hosting.
- Consistent Cloudflare CPU error `1102` during real bridge requests is a release blocker; do not solve it by enabling Workers Paid automatically.

## Review Focus

1. **Worker isolate reuse / rate limiter:** repeated requests in one isolate must reuse one `createCascadeHandler` instance rather than rebuilding the in-memory limiter on every request. Task 1 adds a test proving runtime construction happens once per worker instance.
2. **Missing secret/config:** a missing binding must return controlled HTTP 500 without reflecting the missing key/value to the caller. Task 1 pins this behavior.
3. **CORS abuse:** allowed origin gets exact ACAO; arbitrary origin and `*` are never reflected; preflight stays 204. Task 1 and Task 4 cover this.
4. **Runtime deletion collateral damage:** removing Yandex Cloud code must not delete Yandex Games local proxy/tooling or the operator's untracked `.env.deploy.local`. Task 5 adds source-contract tests and the patch apply script handles the local file explicitly.
5. **Deploy config drift:** Wrangler deploy must fail before upload if required secrets are absent, and there must be no hidden leaderboard fallback. Task 2 declares `secrets.required`; Task 3 source tests inspect every leaderboard ID/config path.

---

### Task 1: Cloudflare runtime config and thin Worker adapter

**Files:**
- Create: `server/cloudflare/config.ts`
- Create: `server/cloudflare/worker.ts`
- Create: `tests/cloudflare-runtime-config.test.ts`
- Create: `tests/cloudflare-worker.test.ts`
- Read only: `server/cascade-api/handler.ts`
- Read only: `server/cascade-api/gamepush.ts`

**Interfaces:**
- Consumes: `GamePushGraphqlBackend`, `GamePushLeaderboardIds`, and `createCascadeHandler(dependencies)` from `server/cascade-api/*`.
- Produces: `CloudflareEnv`, `CloudflareRuntimeConfig`, `loadCloudflareRuntimeConfig(env)`, `createCloudflareWorker()`, and the default Worker export `{ fetch(request, env) }`.

- [ ] **Step 1: Write failing runtime-config tests**

Create `tests/cloudflare-runtime-config.test.ts` covering exact parsing and fail-closed validation:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCloudflareRuntimeConfig } from '../server/cloudflare/config.ts';

const complete = {
  PIKABU_GAME_SECRET: 'pikabu-secret',
  GAMEPUSH_API_SECRET: 'gamepush-secret',
  BRIDGE_SESSION_SECRET: 'bridge-secret',
  GAMEPUSH_PROJECT_ID: '30632',
  GAMEPUSH_API_URL: 'https://api.gamepush.com/gs/api/graphql',
  GAMEPUSH_LEADERBOARD_STANDARD_ID: '100307',
  GAMEPUSH_LEADERBOARD_DAILY_ID: '100308',
  GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID: '100312',
  GAMEPUSH_LEADERBOARD_MASTERY_ID: '100999',
  CASCADE_ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
};

test('parses all Worker bindings into Cascade runtime config', () => {
  const config = loadCloudflareRuntimeConfig(complete);
  assert.equal(config.gamePushProjectId, 30632);
  assert.deepEqual(config.leaderboardIds, {
    cascadeStandard: 100307,
    cascadeDaily: 100308,
    cascadeDailyStreak: 100312,
    cascadeMastery: 100999,
  });
});

test('rejects a missing secret binding', () => {
  assert.throws(
    () => loadCloudflareRuntimeConfig({ ...complete, GAMEPUSH_API_SECRET: '' }),
    /GAMEPUSH_API_SECRET is required/,
  );
});

test('rejects non-positive leaderboard ids', () => {
  assert.throws(
    () => loadCloudflareRuntimeConfig({ ...complete, GAMEPUSH_LEADERBOARD_MASTERY_ID: '0' }),
    /GAMEPUSH_LEADERBOARD_MASTERY_ID must be a positive integer/,
  );
});
```

- [ ] **Step 2: Run config tests and verify RED**

Run:

```bash
node --test tests/cloudflare-runtime-config.test.ts
```

Expected: FAIL because `server/cloudflare/config.ts` does not exist.

- [ ] **Step 3: Implement minimal Worker config loader**

Create `server/cloudflare/config.ts` with no `process.env` and no Node APIs:

```ts
import type { GamePushLeaderboardIds } from '../cascade-api/gamepush.ts';

export interface CloudflareEnv {
  readonly PIKABU_GAME_SECRET?: string;
  readonly GAMEPUSH_API_SECRET?: string;
  readonly BRIDGE_SESSION_SECRET?: string;
  readonly GAMEPUSH_PROJECT_ID?: string;
  readonly GAMEPUSH_API_URL?: string;
  readonly GAMEPUSH_LEADERBOARD_STANDARD_ID?: string;
  readonly GAMEPUSH_LEADERBOARD_DAILY_ID?: string;
  readonly GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID?: string;
  readonly GAMEPUSH_LEADERBOARD_MASTERY_ID?: string;
  readonly CASCADE_ALLOWED_ORIGINS?: string;
}

export interface CloudflareRuntimeConfig {
  readonly pikabuSecret: string;
  readonly gamePushApiSecret: string;
  readonly bridgeSecret: string;
  readonly gamePushProjectId: number;
  readonly gamePushApiUrl?: string;
  readonly leaderboardIds: GamePushLeaderboardIds;
  readonly allowedOrigins: string;
}

function requiredString(env: CloudflareEnv, name: keyof CloudflareEnv): string {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredPositiveInt(env: CloudflareEnv, name: keyof CloudflareEnv): number {
  const raw = requiredString(env, name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function loadCloudflareRuntimeConfig(env: CloudflareEnv): CloudflareRuntimeConfig {
  const gamePushApiUrl = env.GAMEPUSH_API_URL?.trim();
  return {
    pikabuSecret: requiredString(env, 'PIKABU_GAME_SECRET'),
    gamePushApiSecret: requiredString(env, 'GAMEPUSH_API_SECRET'),
    bridgeSecret: requiredString(env, 'BRIDGE_SESSION_SECRET'),
    gamePushProjectId: requiredPositiveInt(env, 'GAMEPUSH_PROJECT_ID'),
    ...(gamePushApiUrl ? { gamePushApiUrl } : {}),
    allowedOrigins: requiredString(env, 'CASCADE_ALLOWED_ORIGINS'),
    leaderboardIds: {
      cascadeStandard: requiredPositiveInt(env, 'GAMEPUSH_LEADERBOARD_STANDARD_ID'),
      cascadeDaily: requiredPositiveInt(env, 'GAMEPUSH_LEADERBOARD_DAILY_ID'),
      cascadeDailyStreak: requiredPositiveInt(env, 'GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID'),
      cascadeMastery: requiredPositiveInt(env, 'GAMEPUSH_LEADERBOARD_MASTERY_ID'),
    },
  };
}
```

- [ ] **Step 4: Run config tests and verify GREEN**

Run the same test command. Expected: all tests pass.

- [ ] **Step 5: Write failing Worker adapter tests**

Create `tests/cloudflare-worker.test.ts`. Test through a factory so module-level runtime caching is observable without GamePush network calls:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareWorker, type CloudflareWorkerRuntimeFactory } from '../server/cloudflare/worker.ts';
import type { CloudflareEnv } from '../server/cloudflare/config.ts';

const env = {
  PIKABU_GAME_SECRET: 'pikabu-secret',
  GAMEPUSH_API_SECRET: 'gamepush-secret',
  BRIDGE_SESSION_SECRET: 'bridge-secret',
  GAMEPUSH_PROJECT_ID: '30632',
  GAMEPUSH_API_URL: 'https://api.gamepush.com/gs/api/graphql',
  GAMEPUSH_LEADERBOARD_STANDARD_ID: '100307',
  GAMEPUSH_LEADERBOARD_DAILY_ID: '100308',
  GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID: '100312',
  GAMEPUSH_LEADERBOARD_MASTERY_ID: '100999',
  CASCADE_ALLOWED_ORIGINS: 'https://allowed.example',
} satisfies CloudflareEnv;

test('reuses one Cascade handler within one Worker isolate', async () => {
  let builds = 0;
  const factory: CloudflareWorkerRuntimeFactory = () => {
    builds += 1;
    return async () => new Response('ok');
  };
  const worker = createCloudflareWorker(factory);
  await worker.fetch(new Request('https://worker.test/a'), env);
  await worker.fetch(new Request('https://worker.test/b'), env);
  assert.equal(builds, 1);
});

test('missing runtime binding fails closed without leaking config names', async () => {
  const worker = createCloudflareWorker();
  const response = await worker.fetch(
    new Request('https://worker.test/__cascade_missing_route__'),
    { ...env, GAMEPUSH_API_SECRET: '' },
  );
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.equal(text.includes('GAMEPUSH_API_SECRET'), false);
  assert.deepEqual(JSON.parse(text), { error: 'Internal server error.' });
});
```

Add one integration-style adapter test using the real handler for CORS/OPTIONS without any GamePush call:

```ts
test('real Worker adapter preserves exact CORS and OPTIONS behavior', async () => {
  const worker = createCloudflareWorker();
  const response = await worker.fetch(new Request('https://worker.test/v1/profile', {
    method: 'OPTIONS',
    headers: { Origin: 'https://allowed.example' },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://allowed.example');
});
```

- [ ] **Step 6: Run Worker tests and verify RED**

```bash
node --test tests/cloudflare-worker.test.ts
```

Expected: FAIL because `server/cloudflare/worker.ts` does not exist.

- [ ] **Step 7: Implement thin Worker adapter with isolate-local handler cache**

Create `server/cloudflare/worker.ts`:

```ts
import { GamePushGraphqlBackend } from '../cascade-api/gamepush.ts';
import { createCascadeHandler } from '../cascade-api/handler.ts';
import { loadCloudflareRuntimeConfig, type CloudflareEnv } from './config.ts';

export type CloudflareWorkerRuntimeFactory = (
  env: CloudflareEnv,
) => (request: Request) => Promise<Response>;

function buildRuntime(env: CloudflareEnv): (request: Request) => Promise<Response> {
  const config = loadCloudflareRuntimeConfig(env);
  const gamePush = new GamePushGraphqlBackend({
    apiSecret: config.gamePushApiSecret,
    projectId: config.gamePushProjectId,
    ...(config.gamePushApiUrl ? { endpoint: config.gamePushApiUrl } : {}),
    leaderboardIds: config.leaderboardIds,
  });
  return createCascadeHandler({
    gamePush,
    pikabuSecret: config.pikabuSecret,
    bridgeSecret: config.bridgeSecret,
    allowedOrigins: config.allowedOrigins,
  });
}

export function createCloudflareWorker(factory: CloudflareWorkerRuntimeFactory = buildRuntime) {
  let runtime: ((request: Request) => Promise<Response>) | undefined;
  return {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
      try {
        runtime ??= factory(env);
        return await runtime(request);
      } catch {
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
    },
  };
}

export default createCloudflareWorker();
```

- [ ] **Step 8: Run Worker tests and backend regression suite**

Run:

```bash
node --test tests/cloudflare-runtime-config.test.ts tests/cloudflare-worker.test.ts tests/backend-*.test.ts tests/backend-*.test.mjs tests/bridge-session.test.ts tests/gamepush-*.test.ts tests/pikabu-signed-data.test.ts
```

Expected: all pass; no GamePush network request is made by the Worker adapter tests.

- [ ] **Step 9: Commit Task 1**

```bash
git add server/cloudflare tests/cloudflare-runtime-config.test.ts tests/cloudflare-worker.test.ts
git commit -m "feat: add Cloudflare Worker runtime adapter"
```

---

### Task 2: Wrangler config, required secrets, and package scripts

**Files:**
- Create: `wrangler.jsonc`
- Create: `tests/cloudflare-wrangler-config.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `server/cloudflare/worker.ts` from Task 1.
- Produces: source-of-truth Worker config, required-secret declaration, Cloudflare build/dev/deploy scripts, and locked Wrangler dependency.

- [ ] **Step 1: Obtain the exact recreated Mastery leaderboard ID before writing deploy config**

Use the operator's already-configured numeric `GAMEPUSH_LEADERBOARD_MASTERY_ID` from their current local deployment settings. Do **not** read or print the three secret values. If the numeric Mastery ID is not available in conversation or operator output, ask only for that non-secret integer. Never infer `100313` or any other value.

This task cannot be marked complete until `wrangler.jsonc` contains the real numeric Mastery ID as a string.

- [ ] **Step 2: Write failing Wrangler source-contract test**

Create `tests/cloudflare-wrangler-config.test.mjs` that parses JSONC after stripping comments/trailing commas or, more simply, validates the required exact source fragments. It must assert all of the following:

```js
assert.match(source, /"name"\s*:\s*"cascade-api"/);
assert.match(source, /"main"\s*:\s*"server\/cloudflare\/worker\.ts"/);
assert.match(source, /"compatibility_date"\s*:\s*"2026-09-22"/);
assert.match(source, /"workers_dev"\s*:\s*true/);
assert.doesNotMatch(source, /nodejs_compat/);
assert.match(source, /"required"[\s\S]*"PIKABU_GAME_SECRET"[\s\S]*"GAMEPUSH_API_SECRET"[\s\S]*"BRIDGE_SESSION_SECRET"/);
assert.match(source, /"GAMEPUSH_PROJECT_ID"\s*:\s*"30632"/);
assert.match(source, /"GAMEPUSH_LEADERBOARD_STANDARD_ID"\s*:\s*"100307"/);
assert.match(source, /"GAMEPUSH_LEADERBOARD_DAILY_ID"\s*:\s*"100308"/);
assert.match(source, /"GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID"\s*:\s*"100312"/);
assert.match(source, new RegExp(`"GAMEPUSH_LEADERBOARD_MASTERY_ID"\\s*:\\s*"${expectedMasteryId}"`));
assert.match(source, /"CASCADE_ALLOWED_ORIGINS"\s*:\s*"http:\/\/localhost:5173,http:\/\/127\.0\.0\.1:5173"/);
assert.doesNotMatch(source, /pikabu-secret|gamepush-secret|bridge-secret/i);
```

Read `expectedMasteryId` in the test from the exact committed config value rather than duplicating a guessed constant; separately assert it is a positive integer and is not one of the old known-stale fallback IDs.

Also assert `package.json` contains:

```text
backend:dev:cloudflare   -> wrangler dev
backend:build:cloudflare -> wrangler deploy --dry-run --outdir dist/cloudflare-worker
backend:deploy:cloudflare-> wrangler deploy
```

and no `backend:*:yandex` script remains.

- [ ] **Step 3: Run test and verify RED**

```bash
node --test tests/cloudflare-wrangler-config.test.mjs
```

Expected: FAIL because `wrangler.jsonc` and scripts do not exist yet.

- [ ] **Step 4: Add Wrangler and source config**

Run:

```bash
pnpm add -D wrangler
```

Create `wrangler.jsonc` with the actual Mastery ID from Step 1:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cascade-api",
  "main": "server/cloudflare/worker.ts",
  "compatibility_date": "2026-09-22",
  "workers_dev": true,
  "secrets": {
    "required": [
      "PIKABU_GAME_SECRET",
      "GAMEPUSH_API_SECRET",
      "BRIDGE_SESSION_SECRET"
    ]
  },
  "vars": {
    "GAMEPUSH_PROJECT_ID": "30632",
    "GAMEPUSH_API_URL": "https://api.gamepush.com/gs/api/graphql",
    "GAMEPUSH_LEADERBOARD_STANDARD_ID": "100307",
    "GAMEPUSH_LEADERBOARD_DAILY_ID": "100308",
    "GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID": "100312",
    "CASCADE_ALLOWED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173"
  }
}
```

Before saving the file, add `GAMEPUSH_LEADERBOARD_MASTERY_ID` to the `vars` object with the exact positive decimal string obtained in Step 1. The file must not be written, tested, or committed with a stand-in value.

Update `package.json`:

```json
"backend:dev:cloudflare": "wrangler dev",
"backend:build:cloudflare": "wrangler deploy --dry-run --outdir dist/cloudflare-worker",
"backend:deploy:cloudflare": "wrangler deploy",
"backend:smoke:cloudflare": "node scripts/cloudflare-backend-smoke.mjs"
```

Update `backend:test` to include `tests/cloudflare-*.test.ts tests/cloudflare-*.test.mjs` and remove Yandex Cloud test globs after Task 5 deletes those files.

Add to `.gitignore`:

```text
.dev.vars
.dev.vars.*
.env
.env.local
.env.*.local
/dist/cloudflare-worker/
.wrangler/
```

Do not add a committed `.dev.vars` containing secrets.

- [ ] **Step 5: Run source-contract test and Wrangler dry-run**

```bash
node --test tests/cloudflare-wrangler-config.test.mjs
pnpm backend:build:cloudflare
```

Expected: source test passes; Wrangler bundles `server/cloudflare/worker.ts` successfully without `nodejs_compat` and without deploying.

If Wrangler refuses dry-run solely because `secrets.required` validates remote secrets even in dry-run, use `wrangler deploy --dry-run --outdir dist/cloudflare-worker` with the documented local dry-run mechanism that does not publish; do not weaken `secrets.required` in committed config merely to make dry-run green.

- [ ] **Step 6: Commit Task 2**

```bash
git add wrangler.jsonc package.json pnpm-lock.yaml .gitignore tests/cloudflare-wrangler-config.test.mjs
git commit -m "build: configure Cloudflare Worker"
```

---

### Task 3: Enforce no secret/fallback leakage in active source and browser build config

**Files:**
- Create: `tests/cloudflare-security-contract.test.mjs`
- Modify: `.env.pikabu.example`
- Modify: `tests/backend-config-vite-env.test.mjs` if its assertions still mention the Yandex Gateway placeholder.

**Interfaces:**
- Consumes: `wrangler.jsonc` and the existing frontend `VITE_BACKEND_URL`/backend client config path.
- Produces: regression coverage that secrets and leaderboard fallbacks cannot leak into browser/runtime config.

- [ ] **Step 1: Write failing security/source-contract test**

Create `tests/cloudflare-security-contract.test.mjs` that recursively scans active source/config (exclude historical `docs/superpowers/`) and asserts:

```js
for (const forbidden of [
  'PIKABU_GAME_SECRET=',
  'GAMEPUSH_API_SECRET=',
  'BRIDGE_SESSION_SECRET=',
]) {
  assert.equal(browserConfigText.includes(forbidden), false);
}

assert.doesNotMatch(activeBackendText, /100309|100310/);
assert.doesNotMatch(wranglerText, /PIKABU_GAME_SECRET"\s*:\s*"[^\"]+"/);
assert.doesNotMatch(wranglerText, /GAMEPUSH_API_SECRET"\s*:\s*"[^\"]+"/);
assert.doesNotMatch(wranglerText, /BRIDGE_SESSION_SECRET"\s*:\s*"[^\"]+"/);
```

Also assert `.env.pikabu.example` uses a Worker-shaped example URL and contains no server secret names:

```text
VITE_BACKEND_URL=https://cascade-api.<account-subdomain>.workers.dev
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/cloudflare-security-contract.test.mjs
```

Expected: FAIL because the Pikabu example still points at `<gateway-domain>` and Yandex Cloud active paths still exist until Task 5.

- [ ] **Step 3: Update browser example only**

Change `.env.pikabu.example` to:

```dotenv
# Public browser configuration only. Never put Pikabu/GamePush server or bridge secrets in VITE_* variables.
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://cascade-api.<account-subdomain>.workers.dev
VITE_GAMEPUSH_PROJECT_ID=30632
VITE_GAMEPUSH_PUBLIC_TOKEN=c5GdZPx08oVCDei4Opc5DJDx68TZDUEb
```

Do not touch `BackendClient` request paths or session behavior.

- [ ] **Step 4: Run the security/browser config test and verify GREEN**

```bash
node --test tests/cloudflare-security-contract.test.mjs tests/backend-config-vite-env.test.mjs
```

Expected: PASS. Yandex Cloud path deletion is deliberately owned and tested separately by Task 5, so this task does not carry a known-red test forward.

- [ ] **Step 5: Commit the browser-config change**

```bash
git add .env.pikabu.example tests/cloudflare-security-contract.test.mjs tests/backend-config-vite-env.test.mjs
git commit -m "test: guard Cloudflare backend configuration"
```

---

### Task 4: Cloudflare non-mutating smoke script

**Files:**
- Create: `scripts/cloudflare-backend-smoke.mjs`
- Create: `tests/cloudflare-backend-smoke-script.test.mjs`

**Interfaces:**
- Consumes: deployed Worker base URL through `CLOUDFLARE_BACKEND_URL` or first CLI arg; optional `CLOUDFLARE_SMOKE_ORIGIN`.
- Produces: a no-write smoke command for unknown route, unauthorized profile, malformed session, preflight, allowed CORS, and disallowed CORS.

- [ ] **Step 1: Write failing source-contract test**

Create `tests/cloudflare-backend-smoke-script.test.mjs` asserting the script:

- uses `CLOUDFLARE_BACKEND_URL`;
- never contains GamePush admin secret names or `publishRecord`;
- sends only unknown-route GET, unauthorized profile GET, malformed session POST, and OPTIONS;
- verifies disallowed origin does not receive `access-control-allow-origin`;
- prints `Cloudflare backend smoke PASSED.` only at the end.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/cloudflare-backend-smoke-script.test.mjs
```

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement smoke script by adapting the proven Yandex smoke behavior**

Create `scripts/cloudflare-backend-smoke.mjs` with:

```js
const rawBaseUrl = process.env.CLOUDFLARE_BACKEND_URL ?? process.argv[2];
if (!rawBaseUrl?.trim()) {
  console.error('Usage: set CLOUDFLARE_BACKEND_URL or pass the Worker base URL as the first argument.');
  process.exit(1);
}
const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
const smokeOrigin = process.env.CLOUDFLARE_SMOKE_ORIGIN?.trim() || '';
const deniedOrigin = 'https://cascade-smoke-denied.invalid';
```

Retain the Yandex smoke's safe assertions for 404/401/malformed signed data, add:

```js
const preflight = await request('/v1/profile', {
  method: 'OPTIONS',
  headers: {
    Origin: smokeOrigin || 'http://localhost:5173',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,content-type',
  },
});
assertStatus(preflight.response.status, 204, 'preflight');

const denied = await request('/__cascade_missing_route__', {
  headers: { Origin: deniedOrigin },
});
if (denied.response.headers.get('access-control-allow-origin') !== null) {
  throw new Error('disallowed origin received CORS access');
}
```

Do not add authenticated writes to this smoke.

- [ ] **Step 4: Run smoke source test and local mock HTTP test if present**

```bash
node --test tests/cloudflare-backend-smoke-script.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add scripts/cloudflare-backend-smoke.mjs tests/cloudflare-backend-smoke-script.test.mjs package.json
git commit -m "test: add Cloudflare backend smoke"
```

---

### Task 5: Remove only Yandex Cloud hosting artifacts and keep Yandex Games tooling

**Files:**
- Delete tracked directory: `server/yandex/` (tracked files only; never delete local untracked `.env.deploy.local` in the user's project)
- Delete: `scripts/build-yandex-function.mjs`
- Delete: `scripts/deploy-yandex-backend.ps1`
- Delete: `scripts/render-yandex-gateway.mjs`
- Delete: `scripts/yandex-backend-smoke.mjs`
- Delete: `tests/yandex-adapter.test.ts`
- Delete: `tests/yandex-backend-smoke-script.test.mjs`
- Delete: `tests/yandex-deploy-script.test.mjs`
- Delete: `tests/yandex-deployment-docs.test.mjs`
- Delete: `tests/yandex-function-build.test.mjs`
- Delete: `tests/yandex-gateway-config.test.mjs`
- Delete: `tests/yandex-runtime-config.test.ts`
- Preserve: `scripts/yandex-dev-proxy.mjs`
- Preserve: `scripts/yandex-dev-proxy-lib.mjs`
- Preserve: `tests/yandex-dev-proxy.test.mjs`
- Preserve: `tests/yandex-dev-cheats.test.ts`
- Preserve: `tests/yandex-build-paths.test.ts`
- Preserve: package script `yandex:dev`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `tests/cloudflare-security-contract.test.mjs`
- Create: `tests/cloudflare-runtime-removal.test.mjs`

**Interfaces:**
- Consumes: Task 1/2 Cloudflare runtime and scripts.
- Produces: active project with Cloudflare as the only bridge host and Yandex Games dev support still intact.

- [ ] **Step 1: Write failing deletion/preservation test**

Create `tests/cloudflare-runtime-removal.test.mjs`:

```js
assert.equal(existsSync('server/yandex/adapter.ts'), false);
assert.equal(existsSync('server/yandex/config.ts'), false);
assert.equal(existsSync('server/yandex/index.ts'), false);
assert.equal(existsSync('scripts/build-yandex-function.mjs'), false);
assert.equal(existsSync('scripts/deploy-yandex-backend.ps1'), false);
assert.equal(existsSync('scripts/render-yandex-gateway.mjs'), false);
assert.equal(existsSync('scripts/yandex-backend-smoke.mjs'), false);

assert.equal(existsSync('scripts/yandex-dev-proxy.mjs'), true);
assert.equal(existsSync('scripts/yandex-dev-proxy-lib.mjs'), true);
assert.equal(existsSync('tests/yandex-dev-proxy.test.mjs'), true);
assert.equal(existsSync('tests/yandex-dev-cheats.test.ts'), true);
assert.equal(existsSync('tests/yandex-build-paths.test.ts'), true);

assert.equal(packageJson.scripts['yandex:dev'] !== undefined, true);
assert.equal(Object.keys(packageJson.scripts).some((key) => key.includes(':yandex') && key !== 'yandex:dev'), false);
```

Also assert `supabase/` remains absent.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/cloudflare-runtime-removal.test.mjs tests/cloudflare-security-contract.test.mjs
```

Expected: FAIL because Yandex Cloud runtime/deploy files still exist.

- [ ] **Step 3: Delete the tracked Yandex Cloud files and clean scripts**

Delete exactly the files listed above. Remove Yandex Cloud `backend:*:yandex` scripts and Yandex Cloud test globs from `package.json`; leave `yandex:dev` unchanged.

Remove `/dist/yandex-function/` from `.gitignore`. Keep the ignore rule for `server/yandex/.env.deploy.local` until the final delete-aware patch has been applied to the user's working copy; this prevents accidental commit if their local secret file remains behind in an otherwise-empty `server/yandex/` directory.

- [ ] **Step 4: Run deletion/security tests and verify GREEN**

```bash
node --test tests/cloudflare-runtime-removal.test.mjs tests/cloudflare-security-contract.test.mjs
```

Expected: all pass; Yandex Games proxy/tooling still exists.

- [ ] **Step 5: Run Yandex Games preservation tests**

```bash
node --test tests/yandex-dev-proxy.test.mjs tests/yandex-dev-cheats.test.ts tests/yandex-build-paths.test.ts
```

Expected: all pass. Any failure here is a regression: restore the unrelated Yandex Games support rather than weakening the tests.

- [ ] **Step 6: Commit Task 5**

```bash
git add -A server/yandex scripts package.json .gitignore tests
git commit -m "refactor: replace Yandex Cloud runtime with Workers"
```

---

### Task 6: Update active operator docs and release checklist for Cloudflare

**Files:**
- Modify: `docs/PIKABU_BACKEND_SETUP.md`
- Modify: `docs/PIKABU_HOSTING.md`
- Modify: `docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Modify: `PATCH_NOTES.md`
- Create: `tests/cloudflare-deployment-docs.test.mjs`
- Preserve historical docs: `docs/superpowers/specs/2026-09-21-yandex-cloud-runtime-migration-design.md` and its plan.

**Interfaces:**
- Consumes: Wrangler commands/scripts from Tasks 2 and 4.
- Produces: operator flow that no longer instructs creation of Yandex Cloud resources or billing configuration.

- [ ] **Step 1: Write failing docs contract test**

Create `tests/cloudflare-deployment-docs.test.mjs` asserting active docs contain:

```text
pnpm exec wrangler login
pnpm exec wrangler secret put PIKABU_GAME_SECRET
pnpm exec wrangler secret put GAMEPUSH_API_SECRET
pnpm exec wrangler secret put BRIDGE_SESSION_SECRET
pnpm backend:build:cloudflare
pnpm backend:deploy:cloudflare
pnpm backend:smoke:cloudflare
workers.dev
1102
```

and active docs do **not** instruct:

```text
yc init
yc serverless function
yc serverless api-gateway
Yandex API Gateway
backend:deploy:yandex
backend:smoke:yandex
```

The scan must exclude historical `docs/superpowers/` files.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/cloudflare-deployment-docs.test.mjs
```

Expected: FAIL because active docs still describe Yandex Cloud.

- [ ] **Step 3: Rewrite active setup/hosting/release flow**

Document this exact first deployment order:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:build:cloudflare
pnpm exec wrangler login
pnpm exec wrangler secret put PIKABU_GAME_SECRET
pnpm exec wrangler secret put GAMEPUSH_API_SECRET
pnpm exec wrangler secret put BRIDGE_SESSION_SECRET
pnpm backend:deploy:cloudflare
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.<actual-subdomain>.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='http://localhost:5173'
pnpm backend:smoke:cloudflare
```

Then require:

```powershell
$env:GAMEPUSH_LEADERBOARD_STANDARD_ID='100307'
$env:GAMEPUSH_LEADERBOARD_DAILY_ID='100308'
$env:GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID='100312'
$env:GAMEPUSH_LEADERBOARD_MASTERY_ID='<operator uses the exact value already committed in wrangler.jsonc>'
pnpm gamepush:smoke
```

In final docs, do not use the angle-bracket sentence as a runnable value. Instead instruct the operator to copy the exact numeric Mastery value from `wrangler.jsonc` into the shell variable.

Document that before production release the actual Pikabu origin must be added to `CASCADE_ALLOWED_ORIGINS`, followed by redeploy.

Document CPU error `1102` as a release blocker and explicitly say not to enable Workers Paid automatically.

- [ ] **Step 4: Run docs test and verify GREEN**

```bash
node --test tests/cloudflare-deployment-docs.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add docs CURRENT_STATE.md TECH.md PATCH_NOTES.md tests/cloudflare-deployment-docs.test.mjs
git commit -m "docs: switch Pikabu backend hosting to Cloudflare"
```

---

### Task 7: Full local verification and Wrangler dry-run package

**Files:**
- Modify only if tests expose defects in Tasks 1-6.
- Generated, untracked: `dist/cloudflare-worker/`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: locally verified Worker bundle and browser builds ready for first remote deploy.

- [ ] **Step 1: Run focused backend suite**

```bash
pnpm backend:test
```

Expected: 0 failures.

- [ ] **Step 2: Run full project suite**

```bash
pnpm test
```

Expected: 0 failures. Any pre-existing environment-specific skip must be reported by exact test name; do not silently omit a red test.

- [ ] **Step 3: Run both browser builds**

```bash
pnpm build
pnpm build:pikabu
```

Expected: both exit 0; no server secret is present in generated browser assets.

- [ ] **Step 4: Run Wrangler dry-run bundle**

```bash
pnpm backend:build:cloudflare
```

Expected: exit 0 and generated Worker bundle under `dist/cloudflare-worker/`; no publish occurs.

- [ ] **Step 5: Scan generated browser/Worker artifacts for accidental secrets and forbidden runtime imports**

Use source names, not secret values:

```bash
rg -n "PIKABU_GAME_SECRET|GAMEPUSH_API_SECRET|BRIDGE_SESSION_SECRET" dist
rg -n "supabase/functions|server/yandex|nodejs_compat" dist/cloudflare-worker
```

Expected: browser assets contain none of the three server secret binding names; Worker may contain binding **names** as config keys but never secret **values**. No Supabase/Yandex Cloud runtime import or `nodejs_compat` should appear in Worker output.

- [ ] **Step 6: Commit only real source fixes, not generated output**

If no fixes were needed, make no empty commit. If fixes were needed, commit them with a specific message and rerun Steps 1-5.

---

### Task 8: First remote Worker setup, smoke, CPU gate, and frontend URL switch

**Files:**
- Modify: `wrangler.jsonc` only if adding the real Pikabu production origin before release.
- Local only: `.env.pikabu.local` or the project's existing ignored Pikabu env file for `VITE_BACKEND_URL`.
- Do not commit or archive Worker secret values.

**Interfaces:**
- Consumes: Cloudflare account authentication, exact Worker secrets from the operator, explicit leaderboard config, Worker build from Task 7.
- Produces: live `workers.dev` endpoint and verified browser base URL.

- [ ] **Step 1: Authenticate Wrangler**

Run interactively:

```powershell
pnpm exec wrangler login
```

Expected: Wrangler confirms the intended Cloudflare account. If account selection is ambiguous, stop before deployment and resolve it; do not deploy to an arbitrary account.

- [ ] **Step 2: Upload the three secrets interactively**

Run one at a time:

```powershell
pnpm exec wrangler secret put PIKABU_GAME_SECRET
pnpm exec wrangler secret put GAMEPUSH_API_SECRET
pnpm exec wrangler secret put BRIDGE_SESSION_SECRET
```

Expected: each command confirms upload. Never pass the secret value as a CLI argument or paste it into chat/logs.

- [ ] **Step 3: Deploy Worker**

```powershell
pnpm backend:deploy:cloudflare
```

Expected: deploy succeeds on Workers Free and prints a `https://cascade-api.<actual-subdomain>.workers.dev` URL.

- [ ] **Step 4: Run non-mutating Worker smoke**

```powershell
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.<actual-subdomain>.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='http://localhost:5173'
pnpm backend:smoke:cloudflare
```

Expected:

```text
PASS unknown route
PASS unauthorized profile
PASS malformed session rejection
PASS preflight
PASS CORS allowed origin
PASS CORS denied origin
Cloudflare backend smoke PASSED.
```

- [ ] **Step 5: Run existing direct GamePush smoke with all four explicit IDs**

Set the four non-secret IDs in the shell from `wrangler.jsonc` and keep `GAMEPUSH_API_SECRET` local, then:

```powershell
pnpm gamepush:smoke
```

Expected: profile, unique values, and all four leaderboard publish/admin-read checks pass in the isolated smoke variant.

- [ ] **Step 6: Run authenticated Pikabu bridge E2E**

From the real Pikabu build/session, verify in order:

1. first login/provisioning establishes Pikabu→GamePush mapping;
2. repeat login reuses mapping;
3. profile GET/PUT succeeds and eventual-consistency grace prevents false rollback;
4. each leaderboard GET works;
5. each relevant leaderboard POST works;
6. Daily second/repeat result does not replace the first result;
7. guest/local-only play remains usable when backend requests are blocked.

Expected: no identity mismatch, no duplicate mapping, no profile rollback, no leaderboard fallback/error.

- [ ] **Step 7: Inspect Workers errors/observability for CPU limit**

Exercise session/profile/leaderboard paths repeatedly enough to catch normal-operation failures. Search Worker errors for Cloudflare resource-limit code `1102`.

Expected: normal requests do not consistently hit `1102`. If they do, stop release; do not enable Workers Paid.

- [ ] **Step 8: Add real Pikabu production origin and redeploy before release**

Replace the development-only `CASCADE_ALLOWED_ORIGINS` value with an explicit comma-separated list that includes the actual Pikabu production origin and only origins still needed for release testing. Never use `*`.

Run:

```powershell
pnpm backend:deploy:cloudflare
```

Then rerun the CORS smoke using the actual Pikabu origin.

- [ ] **Step 9: Point frontend at Worker and rebuild**

Set the ignored local Pikabu browser config:

```dotenv
VITE_BACKEND_URL=https://cascade-api.<actual-subdomain>.workers.dev
```

Run:

```powershell
pnpm build:pikabu
```

Expected: build succeeds and browser requests target the Worker without containing any server secret.

- [ ] **Step 10: Preserve, then manually retire the old local Yandex secret file**

Only after all three Worker secrets are confirmed uploaded and E2E passes, tell the operator they may manually delete:

```text
server/yandex/.env.deploy.local
```

The implementation/patch must never delete this file automatically.

---

### Task 9: Build a delete-aware patch for the user's already-migrated working copy

**Files:**
- Create outside repo: `cascade-cloudflare-workers-runtime-replacement.zip`
- Include: overlay payload of changed/new tracked files.
- Include: `apply-cloudflare-runtime-replacement.ps1`
- Include: `README.txt` and manifest.

**Interfaces:**
- Consumes: final verified branch from Tasks 1-7.
- Produces: user-applicable patch on top of their current Yandex-migration working copy, including tracked file deletions but preserving local secret files.

- [ ] **Step 1: Generate an explicit tracked-delete manifest**

The delete manifest must contain only Yandex **Cloud** files removed in Task 5. It must not contain:

```text
server/yandex/.env.deploy.local
scripts/yandex-dev-proxy.mjs
scripts/yandex-dev-proxy-lib.mjs
tests/yandex-dev-proxy.test.mjs
tests/yandex-dev-cheats.test.ts
tests/yandex-build-paths.test.ts
```

- [ ] **Step 2: Write apply-script regression test or self-test mode**

The apply script must:

1. validate the Cascade project root via `package.json` and `src/main.ts`;
2. overlay payload files;
3. delete only paths in the explicit delete manifest;
4. if `server/yandex/.env.deploy.local` exists, print a warning that it was intentionally preserved;
5. never echo file contents or secret values;
6. leave any now-empty `server/yandex/` directory alone if the local env file is present.

- [ ] **Step 3: Build ZIP and apply it to a clean reconstructed copy of the user's current Yandex-migration state**

Reconstruct that state from the last full Cascade archive plus:

1. `cascade-yandex-cloud-runtime-migration-final.zip`;
2. `cascade-yandex-gamepush-leaderboard-type-fix-overlay.zip`;
3. `cascade-yandex-first-deploy-notfound-fix-overlay.zip`.

Plant a dummy `server/yandex/.env.deploy.local` containing a sentinel value before applying the Cloudflare patch.

- [ ] **Step 4: Verify tree equivalence and secret-file preservation**

After patch application:

- tracked files must match the final implementation branch byte-for-byte;
- no unexpected tracked file is missing/extra;
- the sentinel `.env.deploy.local` must still exist unchanged;
- Yandex Games proxy files must still exist;
- Yandex Cloud adapter/deploy files must be gone.

- [ ] **Step 5: Run available test suite on the patched clean copy**

At minimum:

```bash
node --test tests/cloudflare-*.test.ts tests/cloudflare-*.test.mjs tests/backend-*.test.ts tests/backend-*.test.mjs tests/bridge-session.test.ts tests/gamepush-*.test.ts tests/pikabu-signed-data.test.ts tests/yandex-dev-proxy.test.mjs tests/yandex-dev-cheats.test.ts tests/yandex-build-paths.test.ts
```

If dependencies are available, additionally run:

```bash
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:build:cloudflare
```

- [ ] **Step 6: Deliver the ZIP only after verification**

The README must tell the user to extract beside the project and run the apply script, then run local tests/builds before Wrangler login/secrets/deploy. It must explicitly state that `server/yandex/.env.deploy.local` is intentionally preserved and can be deleted manually only after Worker secrets are uploaded and E2E passes.

---

## Self-review record

- **Spec coverage:** Worker adapter, config/secrets, Free-only constraints, CORS/security, Yandex Cloud removal, Yandex Games preservation, smoke, CPU `1102` gate, rollback posture, frontend URL switch, and secret-file preservation are each assigned to a task.
- **Placeholder scan:** no final source step permits a stand-in runtime value. Task 2 cannot write or commit `wrangler.jsonc` until the actual Mastery ID is supplied. Angle-bracket strings that remain are only examples of runtime URLs in operator documentation, never committed secret/config values.
- **Type consistency:** `CloudflareEnv` -> `loadCloudflareRuntimeConfig` -> `GamePushGraphqlBackend` -> `createCascadeHandler` names and types are consistent across Tasks 1-2.
- **Review Focus coverage:** each of the five review risks has an explicit test/task above.
- **Important scope ruling:** files named `yandex-dev-*` belong to Yandex Games development and must remain. Only Yandex Cloud Functions/API Gateway artifacts are removed.
