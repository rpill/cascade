# Yandex Cloud Runtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Supabase completely and run the existing Pikabu/GamePush stateless bridge behind Yandex API Gateway + a private Node.js 22 Yandex Cloud Function without changing the browser REST contract.

**Architecture:** Move the runtime-independent backend modules from `supabase/functions/cascade-api/` to `server/cascade-api/`, make Yandex environment/configuration explicit, and add a thin API Gateway payload-v2 adapter in `server/yandex/`. Build that adapter to one CommonJS `index.js` bundle with esbuild, deploy it as a private Cloud Function, and expose only the API Gateway. GamePush remains the only persistent backend; the browser keeps using `VITE_BACKEND_URL` and the existing `/v1/*` paths.

**Tech Stack:** TypeScript 5.9, Node.js 22 Web APIs, esbuild, Yandex Cloud Functions, Yandex API Gateway OpenAPI 3 extensions, PowerShell + `yc` CLI, GamePush Server GraphQL API, Pikabu SDK.

**Spec:** `docs/superpowers/specs/2026-09-21-yandex-cloud-runtime-migration-design.md`

## Global Constraints

- Supabase must be absent from active runtime source, package dependencies, active scripts, and deployment instructions when this plan is complete.
- Preserve the public browser contract: `POST /v1/session`, `GET|PUT /v1/profile`, `GET|POST /v1/leaderboards/:board`.
- Preserve current GamePush profile, Unique Values mapping, first-Daily-result immutability, eventual-consistency handling, and the four existing leaderboard record schemas.
- Pikabu remains the only visible identity provider; GamePush SDK remains invisible first-provisioning only.
- Keep guest/local play fully functional when the backend is unavailable.
- Yandex Cloud Function runtime is Node.js 22, 128 MB, no provisioned instances, and logging disabled by default.
- API Gateway is public; Cloud Function remains private and is invoked through a service account with `functions.functionInvoker` only.
- Do not add Lockbox, YDB, Object Storage, Redis, Serverless Containers, Smart Web Security, VPC resources, or any other persistent infrastructure.
- Server secrets stay only in function environment variables and local gitignored deployment config; no server secret may enter any `VITE_*` variable or `dist/` bundle.
- `GAMEPUSH_PROJECT_ID` and all four GamePush leaderboard IDs are required runtime configuration. No fallback/guessed leaderboard IDs are permitted.
- Keep the existing in-memory `FixedWindowRateLimiter` only as a soft per-instance guard; do not introduce global rate-limit storage.
- Final user delivery must be an apply-script patch because the migration deletes/moves files.

## Review Focus

- API Gateway event with a Base64 body must reconstruct exactly the same bytes before JSON/body validation; pin this in the Yandex adapter tests in Task 3.
- `Origin`, `Authorization`, `Content-Type`, and caller source IP must survive Gateway -> Function -> Web `Request`; pin these headers in Task 3.
- Missing/blank/non-integer/zero/negative GamePush IDs must fail function initialization before any request reaches GamePush; pin this in Task 2.
- API Gateway root/greedy routing must preserve `/v1/...` paths and query strings without an old `/cascade-api` prefix; pin the generated OpenAPI structure in Task 5.
- Removing Supabase must not remove the rollback ability of an already-deployed old endpoint: client backend base URL remains configuration-only and no persistent data moves; pin the active-source removal test while preserving historical migration docs in Task 7.

---

## File Structure After Migration

```text
server/
  cascade-api/
    auth.ts              # Pikabu signed-data verification
    gamepush.ts          # GamePush GraphQL backend + leaderboard/admin APIs
    handler.ts           # REST routing + dependency composition only
    http.ts              # HTTP errors, JSON/CORS/body limit, soft limiter
    leaderboards.ts      # board read/submit semantics
    profile.ts           # profile read/write + merge contract
    session.ts           # provisioning/mapping + bridge JWT
    validation.ts        # request/domain validation
  yandex/
    adapter.ts           # API Gateway payload v2 <-> Web Request/Response
    config.ts            # strict process.env parsing, no defaults for required IDs
    index.ts             # Yandex `index.handler` entry point and cold-start wiring
    gateway.openapi.yaml.template
    .env.deploy.example

scripts/
  build-yandex-function.mjs
  render-yandex-gateway.mjs
  deploy-yandex-backend.ps1
  yandex-backend-smoke.mjs

dist/yandex-function/
  index.js               # generated CommonJS bundle, ignored/generated

tests/
  backend-runtime-location.test.mjs
  yandex-runtime-config.test.ts
  yandex-adapter.test.ts
  yandex-function-build.test.mjs
  yandex-gateway-config.test.mjs
  yandex-deploy-script.test.mjs
  supabase-removal.test.mjs
  yandex-backend-smoke-script.test.mjs
```

Historical specs/plans under `docs/superpowers/` may continue mentioning Supabase because they document superseded architecture. Active runtime/setup docs must not.

---

### Task 1: Relocate the backend business layer and remove Deno-specific routing/runtime coupling

**Files:**
- Create by moving: `server/cascade-api/auth.ts`
- Create by moving: `server/cascade-api/gamepush.ts`
- Create by moving: `server/cascade-api/http.ts`
- Create by moving: `server/cascade-api/leaderboards.ts`
- Create by moving: `server/cascade-api/profile.ts`
- Create by moving: `server/cascade-api/session.ts`
- Create by moving: `server/cascade-api/validation.ts`
- Create: `server/cascade-api/handler.ts`
- Modify: `tests/pikabu-signed-data.test.ts`
- Modify: `tests/backend-validation.test.ts`
- Modify: `tests/gamepush-backend.test.ts`
- Modify: `tests/gamepush-leaderboard-contract.test.ts`
- Modify: `tests/backend-leaderboard-contract.test.ts`
- Modify: `tests/bridge-session.test.ts`
- Modify: `tests/gamepush-profile-contract.test.ts`
- Create: `tests/backend-runtime-location.test.mjs`
- Leave in place until Task 7: `supabase/functions/cascade-api/*`

**Interfaces:**
- Consumes: existing `GamePushBackend`, `BridgeClaims`, profile and leaderboard handlers unchanged in behavior.
- Produces: `createCascadeHandler(dependencies: CascadeHandlerDependencies): (request: Request) => Promise<Response>` from `server/cascade-api/handler.ts`; every backend test imports only from `server/cascade-api/*` after this task.

- [ ] **Step 1: Write the failing location/runtime test**

Create `tests/backend-runtime-location.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const modules = [
  'auth.ts',
  'gamepush.ts',
  'http.ts',
  'leaderboards.ts',
  'profile.ts',
  'session.ts',
  'validation.ts',
  'handler.ts',
];

test('backend business layer lives under server/cascade-api and is runtime independent', () => {
  for (const name of modules) {
    const path = `server/cascade-api/${name}`;
    assert.equal(existsSync(path), true, `${path} must exist`);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bDeno\b/);
    assert.doesNotMatch(source, /supabase/i);
  }
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test tests/backend-runtime-location.test.mjs
```

Expected: FAIL because `server/cascade-api/*` does not exist yet.

- [ ] **Step 3: Move pure backend modules and split `index.ts` into `handler.ts`**

Move the seven pure modules byte-for-byte first. Replace old `index.ts` routing code with `server/cascade-api/handler.ts` containing only routing/dependency composition. Keep the current public error/CORS/limiter behavior, but remove all `Deno` declarations, environment reads, defaults, and `Deno.serve(...)`.

The path resolution in the new handler must be direct:

```ts
const url = new URL(request.url);
const path = url.pathname || '/';
```

Do **not** keep this Supabase-specific rewrite:

```ts
url.pathname.replace(/^.*\/cascade-api/, '')
```

The exported interface remains:

```ts
export interface CascadeHandlerDependencies {
  readonly gamePush: GamePushBackend;
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly allowedOrigins: string;
  readonly limiter?: FixedWindowRateLimiter;
}

export function createCascadeHandler(
  dependencies: CascadeHandlerDependencies,
): (request: Request) => Promise<Response>;
```

- [ ] **Step 4: Update all backend test imports to `server/cascade-api/*`**

Examples:

```ts
import { verifyPikabuSignedData } from '../server/cascade-api/auth.ts';
import { createCascadeHandler } from '../server/cascade-api/handler.ts';
import { FixedWindowRateLimiter } from '../server/cascade-api/http.ts';
```

Update source-reading assertions too:

```ts
const handlers = readFileSync('server/cascade-api/leaderboards.ts', 'utf8');
const handler = readFileSync('server/cascade-api/handler.ts', 'utf8');
```

Do not change expected GamePush record shapes or Daily semantics while moving imports.

- [ ] **Step 5: Run backend contract tests**

Run:

```bash
node --test \
  tests/backend-runtime-location.test.mjs \
  tests/pikabu-signed-data.test.ts \
  tests/backend-validation.test.ts \
  tests/gamepush-backend.test.ts \
  tests/gamepush-leaderboard-contract.test.ts \
  tests/backend-leaderboard-contract.test.ts \
  tests/bridge-session.test.ts \
  tests/gamepush-profile-contract.test.ts
```

Expected: PASS; no test imports `supabase/functions/cascade-api`.

- [ ] **Step 6: Commit**

```bash
git add server/cascade-api tests/backend-runtime-location.test.mjs tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts tests/gamepush-backend.test.ts tests/gamepush-leaderboard-contract.test.ts tests/backend-leaderboard-contract.test.ts tests/bridge-session.test.ts tests/gamepush-profile-contract.test.ts
git commit -m "refactor: isolate cascade backend runtime"
```

---

### Task 2: Add strict Yandex runtime configuration with no guessed GamePush IDs

**Files:**
- Create: `server/yandex/config.ts`
- Modify: `server/cascade-api/gamepush.ts`
- Modify: `tests/gamepush-backend.test.ts`
- Create: `tests/yandex-runtime-config.test.ts`
- Modify later in Task 3: `server/yandex/index.ts`

**Interfaces:**
- Consumes: process-style environment `Readonly<Record<string, string | undefined>>`.
- Produces:

```ts
export interface YandexRuntimeConfig {
  readonly pikabuSecret: string;
  readonly gamePushApiSecret: string;
  readonly bridgeSecret: string;
  readonly gamePushProjectId: number;
  readonly allowedOrigins: string;
  readonly gamePushApiUrl?: string;
  readonly leaderboardIds: {
    readonly cascadeStandard: number;
    readonly cascadeDaily: number;
    readonly cascadeDailyStreak: number;
    readonly cascadeMastery: number;
  };
}

export function loadYandexRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): YandexRuntimeConfig;
```

- [ ] **Step 1: Write failing config tests**

Create `tests/yandex-runtime-config.test.ts` with these exact cases:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadYandexRuntimeConfig } from '../server/yandex/config.ts';

const complete = {
  PIKABU_GAME_SECRET: 'pikabu-secret',
  GAMEPUSH_API_SECRET: 'gamepush-secret',
  BRIDGE_SESSION_SECRET: 'bridge-secret',
  GAMEPUSH_PROJECT_ID: '30632',
  CASCADE_ALLOWED_ORIGINS: 'https://game.example',
  GAMEPUSH_LEADERBOARD_STANDARD_ID: '100307',
  GAMEPUSH_LEADERBOARD_DAILY_ID: '100308',
  GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID: '100312',
  GAMEPUSH_LEADERBOARD_MASTERY_ID: '100313',
};

test('loads explicit required Yandex backend config', () => {
  const config = loadYandexRuntimeConfig(complete);
  assert.equal(config.gamePushProjectId, 30632);
  assert.deepEqual(config.leaderboardIds, {
    cascadeStandard: 100307,
    cascadeDaily: 100308,
    cascadeDailyStreak: 100312,
    cascadeMastery: 100313,
  });
});

for (const key of Object.keys(complete)) {
  test(`rejects missing ${key}`, () => {
    const env = { ...complete, [key]: '' };
    assert.throws(() => loadYandexRuntimeConfig(env), new RegExp(key));
  });
}

for (const value of ['0', '-1', '1.5', 'abc']) {
  test(`rejects invalid leaderboard id ${value}`, () => {
    assert.throws(() => loadYandexRuntimeConfig({
      ...complete,
      GAMEPUSH_LEADERBOARD_STANDARD_ID: value,
    }), /GAMEPUSH_LEADERBOARD_STANDARD_ID/);
  });
}
```

The numeric IDs above are **test fixtures only**. They must never become runtime fallbacks.

- [ ] **Step 2: Run tests to verify RED**

```bash
node --test tests/yandex-runtime-config.test.ts
```

Expected: FAIL because `server/yandex/config.ts` does not exist.

- [ ] **Step 3: Implement strict config parsing**

Implement helpers that reject missing/blank values and require positive safe integers:

```ts
function requiredString(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredPositiveInt(env: Readonly<Record<string, string | undefined>>, name: string): number {
  const raw = requiredString(env, name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}
```

`GAMEPUSH_API_URL` is optional; if absent, pass `undefined` and let `GamePushGraphqlBackend` use its existing API default. Do not default `GAMEPUSH_PROJECT_ID` or any leaderboard ID.

- [ ] **Step 4: Remove leaderboard fallbacks from `GamePushGraphqlBackend` itself**

Delete `DEFAULT_LEADERBOARD_IDS`. Make the constructor require a complete typed map rather than merging optional overrides:

```ts
export interface GamePushLeaderboardIds {
  readonly cascadeStandard: number;
  readonly cascadeDaily: number;
  readonly cascadeDailyStreak: number;
  readonly cascadeMastery: number;
}

constructor(options: {
  readonly apiSecret: string;
  readonly projectId: number;
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
  readonly leaderboardIds: GamePushLeaderboardIds;
}) {
  if (!options.apiSecret) throw new GamePushApiError('GAMEPUSH_API_SECRET is required.', 'auth');
  if (!Number.isSafeInteger(options.projectId) || options.projectId <= 0) {
    throw new GamePushApiError('GamePush project id is invalid.', 'invalid');
  }
  for (const [tag, id] of Object.entries(options.leaderboardIds)) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new GamePushApiError(`GamePush leaderboard id for ${tag} is invalid.`, 'invalid');
    }
  }
  this.leaderboardIds = { ...options.leaderboardIds };
}
```

Validate each provided ID as a positive safe integer in the constructor too, so tests/direct callers cannot bypass `loadYandexRuntimeConfig`. Update `tests/gamepush-backend.test.ts` helper constructors to pass fixture IDs explicitly. Add a regression assertion that source no longer contains `DEFAULT_LEADERBOARD_IDS` or the deleted guessed values `100309`/`100310`.

- [ ] **Step 5: Run config and GamePush backend tests**

```bash
node --test tests/yandex-runtime-config.test.ts tests/gamepush-backend.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/yandex/config.ts server/cascade-api/gamepush.ts tests/yandex-runtime-config.test.ts tests/gamepush-backend.test.ts
git commit -m "feat: require explicit Yandex backend config"
```

---

### Task 3: Add the thin API Gateway payload-v2 adapter and Node.js handler entry point

**Files:**
- Create: `server/yandex/adapter.ts`
- Create: `server/yandex/index.ts`
- Create: `tests/yandex-adapter.test.ts`
- Modify only if a test exposes a true runtime assumption: `server/cascade-api/http.ts`

**Interfaces:**
- Consumes: API Gateway payload-format-v2-like event and `createCascadeHandler`.
- Produces:

```ts
export interface YandexHttpEventV2 {
  readonly rawPath?: string;
  readonly rawQueryString?: string;
  readonly headers?: Record<string, string | undefined>;
  readonly body?: string | null;
  readonly isBase64Encoded?: boolean;
  readonly requestContext?: {
    readonly http?: {
      readonly method?: string;
      readonly sourceIp?: string;
    };
  };
}

export interface YandexHttpResult {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly isBase64Encoded: false;
}

export function requestFromYandexEvent(event: YandexHttpEventV2): Request;
export async function responseToYandexResult(response: Response): Promise<YandexHttpResult>;
export function createYandexHandler(webHandler: (request: Request) => Promise<Response>): (event: YandexHttpEventV2) => Promise<YandexHttpResult>;
```

`server/yandex/index.ts` exports `handler` for Yandex as `index.handler`.

- [ ] **Step 1: Write failing adapter tests**

Create tests covering all Review Focus adapter cases. Core examples:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createYandexHandler,
  requestFromYandexEvent,
} from '../server/yandex/adapter.ts';

test('reconstructs GET path, query, auth, origin and source ip', async () => {
  const request = requestFromYandexEvent({
    rawPath: '/v1/leaderboards/daily',
    rawQueryString: 'dailyId=2026-09-21&limit=20',
    headers: {
      authorization: 'Bearer token',
      origin: 'https://game.example',
      'content-type': 'application/json',
    },
    requestContext: { http: { method: 'GET', sourceIp: '203.0.113.7' } },
  });

  assert.equal(request.method, 'GET');
  assert.equal(request.url, 'https://cascade.invalid/v1/leaderboards/daily?dailyId=2026-09-21&limit=20');
  assert.equal(request.headers.get('authorization'), 'Bearer token');
  assert.equal(request.headers.get('origin'), 'https://game.example');
  assert.equal(request.headers.get('x-forwarded-for'), '203.0.113.7');
});

test('decodes Base64 request body before constructing Request', async () => {
  const json = JSON.stringify({ signedData: 'abc.def.ghi' });
  const request = requestFromYandexEvent({
    rawPath: '/v1/session',
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(json, 'utf8').toString('base64'),
    isBase64Encoded: true,
    requestContext: { http: { method: 'POST', sourceIp: '203.0.113.7' } },
  });
  assert.equal(await request.text(), json);
});
```

Also test:
- plain POST body;
- adapter preserves backend 400/401/404/500 status/body;
- 204 response becomes empty `body: ''`;
- missing method defaults to a safe non-mutating value or throws before business logic; choose one behavior and pin it (recommended: throw `Invalid Yandex HTTP event: method is missing.`).

- [ ] **Step 2: Run adapter tests to verify RED**

```bash
node --test tests/yandex-adapter.test.ts
```

Expected: FAIL because adapter module does not exist.

- [ ] **Step 3: Implement the adapter**

Use a synthetic origin because `Request` requires an absolute URL and business routing only reads path/query:

```ts
const path = event.rawPath?.startsWith('/') ? event.rawPath : `/${event.rawPath ?? ''}`;
const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
const url = `https://cascade.invalid${path}${query}`;
```

Copy all event headers into `Headers`. If `requestContext.http.sourceIp` exists and the incoming headers do not already contain `x-forwarded-for`, set it. For GET/HEAD do not attach a body. Decode Base64 with `Buffer.from(event.body, 'base64')`; plain request bodies remain UTF-8 strings.

Convert `Response` with:

```ts
const headers = Object.fromEntries(response.headers.entries());
return {
  statusCode: response.status,
  headers,
  body: response.status === 204 ? '' : await response.text(),
  isBase64Encoded: false,
};
```

No auth, GamePush, routing, or CORS business logic belongs in this file.

- [ ] **Step 4: Implement cold-start wiring in `server/yandex/index.ts`**

Wire dependencies once at module initialization:

```ts
import { GamePushGraphqlBackend } from '../cascade-api/gamepush.ts';
import { createCascadeHandler } from '../cascade-api/handler.ts';
import { createYandexHandler } from './adapter.ts';
import { loadYandexRuntimeConfig } from './config.ts';

const config = loadYandexRuntimeConfig(process.env);
const gamePush = new GamePushGraphqlBackend({
  apiSecret: config.gamePushApiSecret,
  projectId: config.gamePushProjectId,
  ...(config.gamePushApiUrl ? { endpoint: config.gamePushApiUrl } : {}),
  leaderboardIds: config.leaderboardIds,
});

const webHandler = createCascadeHandler({
  gamePush,
  pikabuSecret: config.pikabuSecret,
  bridgeSecret: config.bridgeSecret,
  allowedOrigins: config.allowedOrigins,
});

export const handler = createYandexHandler(webHandler);
```

The current `GamePushGraphqlBackend` constructor property is `endpoint`; keep that name and do not alter GamePush request behavior for the runtime migration.

- [ ] **Step 5: Run adapter + backend tests**

```bash
node --test tests/yandex-runtime-config.test.ts tests/yandex-adapter.test.ts tests/backend-runtime-location.test.mjs tests/bridge-session.test.ts tests/gamepush-backend.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/yandex/adapter.ts server/yandex/index.ts tests/yandex-adapter.test.ts
git commit -m "feat: add Yandex Cloud Function adapter"
```

---

### Task 4: Add reproducible CommonJS function bundling and packaging

**Files:**
- Create: `scripts/build-yandex-function.mjs`
- Create: `tests/yandex-function-build.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Generated only: `dist/yandex-function/index.js`

**Interfaces:**
- Consumes: `server/yandex/index.ts`.
- Produces: a single-file CommonJS function directory whose exported property is `handler`, suitable for Yandex entrypoint `index.handler`; Yandex CLI uploads that directory directly.

- [ ] **Step 1: Write the failing build-contract test**

Create `tests/yandex-function-build.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const buildScript = readFileSync('scripts/build-yandex-function.mjs', 'utf8');

test('package exposes the Yandex backend build command', () => {
  assert.equal(packageJson.scripts['backend:build:yandex'], 'node scripts/build-yandex-function.mjs');
  assert.equal(typeof packageJson.devDependencies.esbuild, 'string');
});

test('Yandex build targets Node 22 CommonJS', () => {
  assert.match(buildScript, /platform:\s*['"]node['"]/);
  assert.match(buildScript, /target:\s*['"]node22['"]/);
  assert.match(buildScript, /format:\s*['"]cjs['"]/);
  assert.match(buildScript, /server\/yandex\/index\.ts/);
});
```

- [ ] **Step 2: Run the test to verify RED**

```bash
node --test tests/yandex-function-build.test.mjs
```

Expected: FAIL because build script/esbuild script entry do not exist.

- [ ] **Step 3: Add esbuild and package scripts**

Add only `esbuild` as a new dev dependency. Add scripts:

```json
{
  "backend:build:yandex": "node scripts/build-yandex-function.mjs",
  "backend:test": "node --test tests/backend-*.test.ts tests/backend-*.test.mjs tests/bridge-session.test.ts tests/gamepush-*.test.ts tests/pikabu-signed-data.test.ts tests/yandex-*.test.ts tests/yandex-*.test.mjs"
}
```

Do not remove Supabase scripts yet; removal is isolated in Task 7.

Run:

```bash
pnpm add -D esbuild
```

This updates `package.json` and `pnpm-lock.yaml` consistently.

- [ ] **Step 4: Implement `scripts/build-yandex-function.mjs`**

The script must:

1. delete/recreate `dist/yandex-function/`;
2. run esbuild with exactly:

```js
await build({
  entryPoints: ['server/yandex/index.ts'],
  outfile: 'dist/yandex-function/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  minify: false,
});
```

3. leave `dist/yandex-function/` containing only `index.js`;
4. never read deployment secrets or browser env files;
5. fail the process on any bundling error.

Yandex CLI accepts a local directory in `--source-path`, so do not add a ZIP dependency or shell out to platform-specific archive tooling.

- [ ] **Step 5: Add generated backend artifacts to `.gitignore`**

Add:

```gitignore
# Generated Yandex backend bundle
/dist/yandex-function/
```

- [ ] **Step 6: Run source contract + real build**

```bash
node --test tests/yandex-function-build.test.mjs
pnpm backend:build:yandex
node -e "const m=require('./dist/yandex-function/index.js'); if (typeof m.handler !== 'function') process.exit(1)"
```

Expected: all commands PASS; `dist/yandex-function/index.js` exports `handler`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore scripts/build-yandex-function.mjs tests/yandex-function-build.test.mjs
git commit -m "build: bundle Yandex backend function"
```

---

### Task 5: Add API Gateway OpenAPI template and deterministic renderer

**Files:**
- Create: `server/yandex/gateway.openapi.yaml.template`
- Create: `scripts/render-yandex-gateway.mjs`
- Create: `tests/yandex-gateway-config.test.mjs`
- Generated deployment temp file only: `dist/yandex-function/gateway.openapi.yaml`

**Interfaces:**
- Consumes: `FUNCTION_ID`, `SERVICE_ACCOUNT_ID` arguments supplied to renderer.
- Produces: OpenAPI 3 spec with public root + greedy path forwarding to the private function using payload format `2.0`.

- [ ] **Step 1: Write the failing Gateway contract test**

Create `tests/yandex-gateway-config.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = readFileSync('server/yandex/gateway.openapi.yaml.template', 'utf8');

test('gateway forwards root and all subpaths to private Cloud Function with payload v2', () => {
  assert.match(template, /^openapi:\s*["']?3\.0\.0/m);
  assert.match(template, /^\s*\/\{proxy\+\}:/m);
  assert.match(template, /x-yc-apigateway-any-method:/);
  assert.match(template, /type:\s*cloud_functions/);
  assert.match(template, /function_id:\s*__FUNCTION_ID__/);
  assert.match(template, /service_account_id:\s*__SERVICE_ACCOUNT_ID__/);
  assert.match(template, /payload_format_version:\s*["']?2\.0["']?/);
  assert.doesNotMatch(template, /smartWebSecurity|rateLimit|network_id|subnet/i);
});
```

Also assert an explicit `/` operation exists so health/unknown-root behavior does not depend on greedy matching.

- [ ] **Step 2: Run to verify RED**

```bash
node --test tests/yandex-gateway-config.test.mjs
```

Expected: FAIL because template does not exist.

- [ ] **Step 3: Implement the OpenAPI template**

Use this structure, with both root and greedy routes targeting the same function:

```yaml
openapi: 3.0.0
info:
  title: Cascade API
  version: 1.0.0
paths:
  /:
    x-yc-apigateway-any-method:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        service_account_id: __SERVICE_ACCOUNT_ID__
        payload_format_version: '2.0'
  /{proxy+}:
    x-yc-apigateway-any-method:
      parameters:
        - name: proxy
          in: path
          required: false
          style: simple
          explode: false
          schema:
            type: string
            default: '-'
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        service_account_id: __SERVICE_ACCOUNT_ID__
        payload_format_version: '2.0'
```

The function remains private; there is no API Gateway auth layer because Pikabu/bridge auth stays in application code.

- [ ] **Step 4: Implement deterministic renderer**

`scripts/render-yandex-gateway.mjs` accepts:

```bash
node scripts/render-yandex-gateway.mjs <function-id> <service-account-id> <output-path>
```

It must reject blank IDs, replace both placeholders everywhere, reject if either placeholder remains, and write UTF-8 YAML. It must not know or read any server secret.

- [ ] **Step 5: Extend Gateway tests to execute the renderer**

Add a test that renders with fixtures `func-test-123` and `sa-test-456`, then asserts both appear and no `__FUNCTION_ID__`/`__SERVICE_ACCOUNT_ID__` remains.

Run:

```bash
node --test tests/yandex-gateway-config.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/yandex/gateway.openapi.yaml.template scripts/render-yandex-gateway.mjs tests/yandex-gateway-config.test.mjs
git commit -m "feat: add Yandex API Gateway specification"
```

---

### Task 6: Add Windows-first, idempotent Yandex deployment tooling and local env template

**Files:**
- Create: `server/yandex/.env.deploy.example`
- Create: `scripts/deploy-yandex-backend.ps1`
- Create: `tests/yandex-deploy-script.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `server/yandex/.env.deploy.local`, authenticated `yc` CLI profile.
- Produces/reuses exactly three Yandex resources: function `cascade-api`, service account `cascade-api-gateway-invoker`, API Gateway `cascade-api`; prints the public Gateway domain and never prints secret values.

- [ ] **Step 1: Write the failing deployment-script source contract**

Create `tests/yandex-deploy-script.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/deploy-yandex-backend.ps1', 'utf8');
const example = readFileSync('server/yandex/.env.deploy.example', 'utf8');

test('deployment uses Node 22, 128 MB, private function and no logging', () => {
  assert.match(script, /--runtime\s+nodejs22/);
  assert.match(script, /--entrypoint\s+index\.handler/);
  assert.match(script, /--memory\s+128m[b]?/i);
  assert.match(script, /--no-logging/);
  assert.match(script, /api-gateway[\s\S]*--no-logging/);
  assert.doesNotMatch(script, /allow-unauthenticated-invoke/);
  assert.match(script, /functions\.functionInvoker/);
});

test('deployment example contains every required server variable and no real secret value', () => {
  for (const name of [
    'PIKABU_GAME_SECRET',
    'GAMEPUSH_API_SECRET',
    'BRIDGE_SESSION_SECRET',
    'GAMEPUSH_PROJECT_ID',
    'CASCADE_ALLOWED_ORIGINS',
    'GAMEPUSH_LEADERBOARD_STANDARD_ID',
    'GAMEPUSH_LEADERBOARD_DAILY_ID',
    'GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID',
    'GAMEPUSH_LEADERBOARD_MASTERY_ID',
  ]) assert.match(example, new RegExp(`^${name}=`, 'm'));
});
```

- [ ] **Step 2: Run to verify RED**

```bash
node --test tests/yandex-deploy-script.test.mjs
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Create `.env.deploy.example` and gitignore the real local file**

Committed example:

```env
PIKABU_GAME_SECRET=
GAMEPUSH_API_SECRET=
BRIDGE_SESSION_SECRET=
GAMEPUSH_PROJECT_ID=30632
CASCADE_ALLOWED_ORIGINS=
GAMEPUSH_LEADERBOARD_STANDARD_ID=
GAMEPUSH_LEADERBOARD_DAILY_ID=
GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID=
GAMEPUSH_LEADERBOARD_MASTERY_ID=
GAMEPUSH_API_URL=https://api.gamepush.com/gs/api/graphql
```

All leaderboard IDs are intentionally blank in the committed template. The user copies it to `.env.deploy.local` and fills the real current IDs; deployment refuses blank values.

Add to `.gitignore`:

```gitignore
server/yandex/.env.deploy.local
```

- [ ] **Step 4: Implement strict local env parsing in PowerShell**

The script must read `server/yandex/.env.deploy.local` without echoing values. Accept blank lines and lines beginning with `#`; split each data line on the first `=` only. Reject duplicate keys and missing required keys.

Required check:

```powershell
$required = @(
  'PIKABU_GAME_SECRET',
  'GAMEPUSH_API_SECRET',
  'BRIDGE_SESSION_SECRET',
  'GAMEPUSH_PROJECT_ID',
  'CASCADE_ALLOWED_ORIGINS',
  'GAMEPUSH_LEADERBOARD_STANDARD_ID',
  'GAMEPUSH_LEADERBOARD_DAILY_ID',
  'GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID',
  'GAMEPUSH_LEADERBOARD_MASTERY_ID'
)
```

For each missing/blank key, throw only the key name, never the value.

- [ ] **Step 5: Implement idempotent resource discovery/creation**

Before changing cloud resources:

```powershell
Get-Command yc -ErrorAction Stop | Out-Null
pnpm backend:build:yandex
```

Use `yc ... --format json` and parse via `ConvertFrom-Json`.

Resource flow:

1. `yc serverless function get --name cascade-api --format json`; create with `yc serverless function create --name cascade-api` only when not found.
2. `yc iam service-account get --name cascade-api-gateway-invoker --format json` if supported by the installed CLI; otherwise list/filter by exact name; create only when absent.
3. Ensure the function grants only that service account `functions.functionInvoker` using `yc serverless function add-access-binding --name cascade-api --role functions.functionInvoker --service-account-id <id>` when the binding is absent.
4. Explicitly enforce private invocation with `yc serverless function deny-unauthenticated-invoke cascade-api` before deployment.
5. Create a function version from the generated `dist/yandex-function/` directory:

```powershell
yc serverless function version create `
  --function-name cascade-api `
  --runtime nodejs22 `
  --entrypoint index.handler `
  --memory 128mb `
  --execution-timeout 30s `
  --source-path dist/yandex-function `
  --no-logging `
  --environment $environmentCsv
```

Use a 30-second function timeout because the browser already tolerates a 30-second backend request and GamePush propagation/provisioning calls can require network latency. Do not configure provisioned instances.

6. Render `dist/yandex-function/gateway.openapi.yaml` with function/service-account IDs.
7. Create or update API Gateway `cascade-api` with `--spec dist/yandex-function/gateway.openapi.yaml --no-logging`. Always pass `--no-logging` on both create and update so the gateway does not silently write paid Cloud Logging entries.
8. Read gateway JSON and print only:

```text
Yandex backend deployed.
Gateway URL: https://<domain>
```

- [ ] **Step 6: Prevent secrets from appearing in process output**

Do not assemble one comma-separated environment CSV because `CASCADE_ALLOWED_ORIGINS` itself may contain commas. Build the `yc serverless function version create` argument array with one repeated `--environment` flag per variable, for example `@('--environment', "GAMEPUSH_PROJECT_ID=$($values.GAMEPUSH_PROJECT_ID)", '--environment', "CASCADE_ALLOWED_ORIGINS=$($values.CASCADE_ALLOWED_ORIGINS)")`. Do not echo that argument array. Do not enable PowerShell tracing or `yc --debug`. If a command fails, print the command category/resource name, not any environment value.

- [ ] **Step 7: Add package deploy script**

Add:

```json
"backend:deploy:yandex": "powershell -ExecutionPolicy Bypass -File ./scripts/deploy-yandex-backend.ps1"
```

- [ ] **Step 8: Run source tests**

```bash
node --test tests/yandex-deploy-script.test.mjs tests/yandex-gateway-config.test.mjs
```

Expected: PASS.

On the user's Windows machine additionally parse-check without deploying by running the script up to its validation stage or by invoking PowerShell parser APIs if a dry-run switch is added. If adding `-ValidateOnly`, pin it in this task and have it stop before any `yc` mutation.

- [ ] **Step 9: Commit**

```bash
git add server/yandex/.env.deploy.example scripts/deploy-yandex-backend.ps1 tests/yandex-deploy-script.test.mjs .gitignore package.json
git commit -m "feat: add Yandex backend deployment workflow"
```

---

### Task 7: Remove Supabase completely and pin the removal with a regression test

**Files:**
- Delete: `supabase/` entire tree
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `tests/supabase-removal.test.mjs`
- Modify: any active test/source path still referencing `supabase/functions/cascade-api`

**Interfaces:**
- Consumes: migrated backend in `server/cascade-api` and Yandex runtime/tooling from Tasks 1-6.
- Produces: active project runtime with no Supabase package/runtime/config/path dependency.

- [ ] **Step 1: Write the failing Supabase-removal regression test before deleting anything**

Create `tests/supabase-removal.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

function walk(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

test('Supabase runtime and package dependency are gone', () => {
  assert.equal(existsSync('supabase'), false);
  assert.equal(pkg.dependencies?.supabase, undefined);
  assert.equal(pkg.devDependencies?.supabase, undefined);
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    assert.doesNotMatch(`${name} ${command}`, /supabase/i);
  }
});

test('active runtime source does not reference Supabase APIs or paths', () => {
  const files = [
    ...walk('src'),
    ...walk('server'),
    ...walk('scripts'),
    ...walk('.github'),
  ].filter((path) => /\.(?:ts|js|mjs|cjs|json|ya?ml|ps1)$/.test(path));

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /supabase|SUPABASE_|\/rest\/v1\/|\/rpc\//i, path);
  }
});
```

Do not scan historical `docs/superpowers/specs` or `docs/superpowers/plans`; they intentionally document superseded architecture.

- [ ] **Step 2: Run the test to verify RED**

```bash
node --test tests/supabase-removal.test.mjs
```

Expected: FAIL because `supabase/`, package scripts, and dependency still exist.

- [ ] **Step 3: Delete `supabase/` and remove Supabase scripts/dependency**

Delete the entire tree:

```text
supabase/
```

Remove from `package.json`:

```text
backend:start
supabase:serve
supabase devDependency
```

Keep/add Yandex scripts:

```text
backend:build:yandex
backend:test
backend:deploy:yandex
```

- [ ] **Step 4: Refresh the lockfile from `package.json`**

Run:

```bash
pnpm install --lockfile-only
```

Then verify:

```bash
! grep -i "supabase" pnpm-lock.yaml
```

Expected: no Supabase CLI packages remain.

- [ ] **Step 5: Clean obsolete Supabase ignore entries**

Remove:

```gitignore
supabase/.temp/
supabase/functions/.env
supabase/functions/.env.local
```

Retain `.env.pikabu*` ignores and the new `server/yandex/.env.deploy.local` ignore.

- [ ] **Step 6: Run removal + backend tests**

```bash
node --test tests/supabase-removal.test.mjs tests/backend-runtime-location.test.mjs
pnpm backend:test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A supabase package.json pnpm-lock.yaml .gitignore tests/supabase-removal.test.mjs server/cascade-api tests
git commit -m "refactor: remove Supabase runtime"
```

---

### Task 8: Update active client/deployment configuration and documentation for Yandex Cloud

**Files:**
- Modify: `.env.pikabu.example`
- Modify: `.github/workflows/deploy-pikabu.yml`
- Modify: `docs/PIKABU_BACKEND_SETUP.md`
- Modify: `docs/PIKABU_HOSTING.md`
- Modify: `TECH.md`
- Modify: `CURRENT_STATE.md`
- Modify: `PATCH_NOTES.md`
- Modify if needed: `docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md`
- Modify: `tests/pikabu-build-paths.test.ts`
- Create or extend: `tests/yandex-deployment-docs.test.mjs`

**Interfaces:**
- Consumes: deployed Gateway URL as public config only.
- Produces: active docs/workflow that teach only Yandex runtime deployment; frontend CI reads `vars.PIKABU_BACKEND_URL` rather than a hardcoded provider URL.

- [ ] **Step 1: Write failing active-doc/config tests**

Add assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const envExample = readFileSync('.env.pikabu.example', 'utf8');
const workflow = readFileSync('.github/workflows/deploy-pikabu.yml', 'utf8');
const setup = readFileSync('docs/PIKABU_BACKEND_SETUP.md', 'utf8');

test('Pikabu public backend URL is a Yandex Gateway placeholder', () => {
  assert.match(envExample, /VITE_BACKEND_URL=https:\/\/<gateway-domain>/);
  assert.doesNotMatch(envExample, /supabase/i);
});

test('Pikabu CI gets backend URL from repository variable', () => {
  assert.match(workflow, /VITE_BACKEND_URL:\s*\$\{\{\s*vars\.PIKABU_BACKEND_URL\s*\}\}/);
  assert.doesNotMatch(workflow, /supabase/i);
});

test('active backend setup documents Yandex only', () => {
  assert.match(setup, /Yandex API Gateway/);
  assert.match(setup, /pnpm backend:deploy:yandex/);
  assert.doesNotMatch(setup, /Supabase CLI|supabase functions|supabase secrets/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
node --test tests/yandex-deployment-docs.test.mjs tests/pikabu-build-paths.test.ts
```

Expected: FAIL on current Supabase URL/setup text.

- [ ] **Step 3: Update `.env.pikabu.example`**

Use exactly:

```env
# Public browser configuration only. Never put Pikabu/GamePush server or bridge secrets in VITE_* variables.
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://<gateway-domain>
VITE_GAMEPUSH_PROJECT_ID=30632
VITE_GAMEPUSH_PUBLIC_TOKEN=c5GdZPx08oVCDei4Opc5DJDx68TZDUEb
```

Do not overwrite `.env.pikabu.local`; it is user-local and must be updated manually after live Gateway deployment.

- [ ] **Step 4: Update Pikabu deployment workflow**

Replace the hardcoded Supabase URL with:

```yaml
VITE_BACKEND_URL: ${{ vars.PIKABU_BACKEND_URL }}
```

Keep GamePush project/public token as public build config. Do not add server secrets to GitHub Actions frontend deployment.

- [ ] **Step 5: Rewrite active backend setup documentation**

`docs/PIKABU_BACKEND_SETUP.md` must document in this order:

1. architecture: Pikabu -> Yandex API Gateway -> private Node.js 22 Function -> GamePush;
2. `yc` CLI installation/auth prerequisite;
3. copy `server/yandex/.env.deploy.example` to `.env.deploy.local` and fill secrets/current IDs;
4. `pnpm backend:test`;
5. `pnpm backend:build:yandex`;
6. `pnpm backend:deploy:yandex`;
7. copy printed Gateway URL into `.env.pikabu.local` and GitHub repository variable `PIKABU_BACKEND_URL`;
8. `pnpm backend:smoke:yandex` after Task 9 adds it;
9. real Pikabu auth/provision/profile/leaderboard acceptance;
10. only then deactivate the old remote Supabase function manually for rollback cleanup.

Include the zero-cost boundary as an operational note, not a guarantee: Gateway 100k requests/month is the practical current free request ceiling for this architecture and shared billing-account usage can consume allowances.

- [ ] **Step 6: Update active architecture docs**

Update:

- `TECH.md`: replace `supabase/functions/...` with `server/cascade-api/` + `server/yandex/`; describe Gateway/Function transport and no persistent Yandex storage.
- `CURRENT_STATE.md`: state Supabase has been removed from source/runtime and Yandex is the Pikabu bridge runtime.
- `PIKABU_HOSTING.md`: replace “Supabase project” with “Yandex backend”; final origin goes into `CASCADE_ALLOWED_ORIGINS` in `.env.deploy.local` followed by redeployment.
- `PATCH_NOTES.md`: update the current branch note to Yandex runtime or remove obsolete Supabase-specific paragraph if it is only a transient patch note.
- `GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md`: replace any active backend-host references if present; do not rewrite GamePush behavior.

Historical docs under `docs/superpowers/` remain untouched except this migration spec/plan.

- [ ] **Step 7: Run docs/config tests and frontend builds**

```bash
node --test tests/yandex-deployment-docs.test.mjs tests/pikabu-build-paths.test.ts tests/supabase-removal.test.mjs
pnpm build
pnpm build:pikabu
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add .env.pikabu.example .github/workflows/deploy-pikabu.yml docs/PIKABU_BACKEND_SETUP.md docs/PIKABU_HOSTING.md docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md TECH.md CURRENT_STATE.md PATCH_NOTES.md tests/yandex-deployment-docs.test.mjs tests/pikabu-build-paths.test.ts
git commit -m "docs: switch Pikabu backend runtime to Yandex Cloud"
```

---

### Task 9: Add live Gateway smoke tooling and run final local verification

**Files:**
- Create: `scripts/yandex-backend-smoke.mjs`
- Create: `tests/yandex-backend-smoke-script.test.mjs`
- Modify: `package.json`
- Modify: `docs/PIKABU_BACKEND_SETUP.md`
- Do not modify: `scripts/gamepush-smoke.mjs` except if a migration-only import/path broke; its direct Server API semantics must stay independent of Yandex.

**Interfaces:**
- Consumes: `YANDEX_BACKEND_URL` environment variable or one positional base URL.
- Produces: non-destructive public runtime smoke covering route/CORS/auth rejection only; successful Pikabu signed-data flow remains a manual platform acceptance test.

- [ ] **Step 1: Write failing smoke-script contract test**

Create `tests/yandex-backend-smoke-script.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/yandex-backend-smoke.mjs', 'utf8');

test('gateway smoke covers non-destructive runtime contract', () => {
  assert.match(script, /\/__cascade_missing_route__/);
  assert.match(script, /\/v1\/profile/);
  assert.match(script, /\/v1\/session/);
  assert.match(script, /Origin/i);
  assert.doesNotMatch(script, /GAMEPUSH_API_SECRET|PIKABU_GAME_SECRET|BRIDGE_SESSION_SECRET/);
});
```

- [ ] **Step 2: Run to verify RED**

```bash
node --test tests/yandex-backend-smoke-script.test.mjs
```

Expected: FAIL because script does not exist.

- [ ] **Step 3: Implement non-destructive Gateway smoke**

The script must:

1. get base URL from `process.env.YANDEX_BACKEND_URL ?? process.argv[2]` and fail clearly if absent;
2. trim trailing slash;
3. request unknown route and expect `404` JSON `{ error: 'Not found.' }`;
4. request `GET /v1/profile` without bearer token and expect `401`;
5. request `POST /v1/session` with malformed `signedData` and expect a controlled `400`/`401` according to the existing session validation contract, never `500`;
6. send an allowed test `Origin` supplied by `YANDEX_SMOKE_ORIGIN` and verify `access-control-allow-origin` equals it; if no origin env is supplied, skip only that assertion and print `SKIP CORS origin check`;
7. never perform profile writes, leaderboard submits, GamePush provisioning, or any state mutation.

Success output:

```text
PASS unknown route
PASS unauthorized profile
PASS malformed session rejection
PASS CORS allowed origin
Yandex backend smoke PASSED.
```

- [ ] **Step 4: Add package script**

```json
"backend:smoke:yandex": "node scripts/yandex-backend-smoke.mjs"
```

- [ ] **Step 5: Run all source tests and all local builds**

Run exactly:

```bash
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:build:yandex
pnpm gamepush:smoke
```

Expected:
- all project tests pass;
- default Yandex build passes;
- Pikabu build passes;
- function bundle builds and exports `handler`;
- existing direct GamePush smoke passes all profile/Unique Values/four leaderboard checks.

Do not claim the hosting migration complete if `gamepush:smoke` cannot be run because its local API secret/test-player environment is unavailable; report that as an explicit external verification gate.

- [ ] **Step 6: Scan built frontend for server secret names**

Run:

```bash
! grep -R "PIKABU_GAME_SECRET\|GAMEPUSH_API_SECRET\|BRIDGE_SESSION_SECRET\|GAMEPUSH_LEADERBOARD_" dist --exclude='index.js'
```

Prefer a narrower frontend-only output directory check if backend artifacts share `dist/`; the final implementation may place the backend bundle under `artifacts/yandex-function/` instead if that makes secret scanning unambiguous. If changing the generated directory, update Task 4/6 paths consistently before implementation continues.

- [ ] **Step 7: Commit**

```bash
git add scripts/yandex-backend-smoke.mjs tests/yandex-backend-smoke-script.test.mjs package.json docs/PIKABU_BACKEND_SETUP.md
git commit -m "test: add Yandex backend runtime smoke"
```

---

### Task 10: Deploy to Yandex Cloud and complete live acceptance without deleting the rollback endpoint first

**Files:**
- User-local only: `server/yandex/.env.deploy.local`
- User-local only: `.env.pikabu.local`
- No source edit required unless live evidence exposes a bug.

**Interfaces:**
- Consumes: authenticated `yc` CLI account/folder, real GamePush IDs/secrets, final Pikabu frontend origin.
- Produces: verified public API Gateway URL; after acceptance the old remote Supabase Function may be deactivated manually.

- [ ] **Step 1: Fill the local deployment environment**

Copy:

```powershell
Copy-Item .\server\yandex\.env.deploy.example .\server\yandex\.env.deploy.local
```

Fill all required values locally. Use current GamePush IDs from the working project configuration/dashboard. Do not paste secrets into chat, Git, `.env.pikabu.local`, or GitHub frontend variables.

- [ ] **Step 2: Deploy/redeploy Yandex backend**

```powershell
pnpm backend:deploy:yandex
```

Record the printed Gateway URL only.

Expected resource state:
- function `cascade-api` exists and is not public;
- service account `cascade-api-gateway-invoker` has `functions.functionInvoker` on that function;
- Gateway `cascade-api` is public and references that function/service account;
- latest function version is Node.js 22, 128 MB, 30s timeout, no logging.

- [ ] **Step 3: Run live non-destructive Gateway smoke**

```powershell
$env:YANDEX_BACKEND_URL="https://<actual-gateway-domain>"
$env:YANDEX_SMOKE_ORIGIN="https://<actual-pikabu-static-origin>"
pnpm backend:smoke:yandex
```

Expected: `Yandex backend smoke PASSED.`

- [ ] **Step 4: Point local Pikabu build at Gateway**

Set only the public URL in `.env.pikabu.local`:

```env
VITE_BACKEND_URL=https://<actual-gateway-domain>
```

Do not add Yandex credentials or server secrets.

- [ ] **Step 5: Run real Pikabu acceptance**

In the real Pikabu test environment, verify:

1. authorized user obtains bridge session;
2. first login provisions GamePush invisibly if mapping is missing;
3. repeated login resolves the same `pikabuId -> GamePush playerId` mapping;
4. two browser sessions/devices converge profile BASE/LOCAL/CLOUD state;
5. Standard read/submit works;
6. Daily first official result is immutable on replay;
7. Daily Streak read/submit works;
8. Mastery read/submit works;
9. no GamePush login/code UI appears;
10. backend/network failure does not block local gameplay/save; pending sync recovers after network returns.

- [ ] **Step 6: Update frontend deployment variable after acceptance**

Set GitHub repository variable `PIKABU_BACKEND_URL` to the verified Gateway URL and deploy the Pikabu static build.

- [ ] **Step 7: Preserve rollback until the new path is proven, then clean remote Supabase manually**

Only after Steps 3-6 pass, deactivate/delete the old deployed Supabase Edge Function from the Supabase dashboard/project. No GamePush data migration or cleanup is required because persistent data has never moved out of GamePush.

- [ ] **Step 8: Final branch verification**

Run again:

```bash
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:build:yandex
```

Confirm `git status --short` contains only intentional local ignored env files/artifacts and no secret-bearing tracked file.

---

## Self-Review Results

### Spec coverage

- Runtime-independent business move: Task 1.
- Explicit required environment/no guessed IDs: Task 2.
- API Gateway v2 adapter: Task 3.
- Node.js 22 CommonJS bundle: Task 4.
- Public Gateway -> private Function + service-account integration: Tasks 5-6.
- Windows/PowerShell deployment and no logging: Task 6.
- Complete Supabase deletion: Task 7.
- Client URL/workflow/docs switch: Task 8.
- Local full verification + direct GamePush smoke + live Gateway smoke: Task 9.
- Real Yandex/Pikabu acceptance, rollback, final remote Supabase cleanup: Task 10.
- No spec requirement is intentionally omitted.

### Placeholder scan

- No `TBD`, `TODO`, “implement later”, or unspecified error-handling steps remain.
- Deployment example intentionally leaves secret/current leaderboard values blank by design; the deployment validator requires the user-local file to fill them and no production fallback exists.
- Actual Yandex resource IDs/domain are runtime deployment outputs and are therefore not hardcoded in source.

### Type consistency

- `createCascadeHandler` remains the sole business HTTP handler interface from Task 1 onward.
- `YandexRuntimeConfig` from Task 2 feeds the `GamePushGraphqlBackend` + `createCascadeHandler` wiring in Task 3.
- `createYandexHandler` always returns the Yandex payload-v2 response shape consumed by the bundled `index.handler`.
- Gateway renderer/deploy script resource names and generated file paths are consistent across Tasks 5-6.

### Review Focus coverage

- Base64 body: Task 3 adapter test.
- Header/source-IP propagation: Task 3 adapter test.
- Missing/invalid explicit IDs: Task 2 config tests.
- Root/greedy path/query preservation: Tasks 3 and 5 tests.
- Full Supabase removal while keeping URL-based rollback: Tasks 7-10.
