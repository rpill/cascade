# Cascade: Yandex Cloud runtime migration — design

Date: 2026-09-21  
Status: awaiting user review  
Supersedes runtime section of: `docs/superpowers/specs/2026-09-21-pikabu-gamepush-stateless-bridge-design.md`

## 1. Goal

Remove Supabase from Cascade completely while preserving the already working Pikabu + GamePush backend behavior.

The final Pikabu backend path is:

```text
Cascade browser
  -> Yandex API Gateway
  -> private Yandex Cloud Function (Node.js 22)
  -> GamePush Server API
```

The migration is successful when:

- there is no Supabase runtime, database, CLI dependency, config, migration or Edge Function left in the project;
- the browser-facing HTTP contract remains the same (`/v1/session`, `/v1/profile`, `/v1/leaderboards/:board`);
- GamePush profile, Unique Values mapping and all four leaderboard flows keep their current semantics;
- Pikabu signed identity remains the only public identity source;
- no server secret enters the Vite/browser bundle;
- the deployed function can run at zero cost while usage stays inside the current Yandex serverless free tiers and paid logging is disabled;
- local/offline play remains unaffected by backend outages.

## 2. Constraints and decisions already fixed

### 2.1 Product/backend decisions

The migration does **not** redesign the cloud model. The following are already accepted and must remain unchanged:

- Pikabu SDK provides native auth, signed data, public name/avatar, ads and lifecycle.
- Guest mode remains local-only for profile writes.
- `localStorage` remains the immediate/local source of progress.
- GamePush stores the persistent cloud profile in player field `cascadeProfile`.
- GamePush Unique Values maps verified Pikabu ID to GamePush player ID using tag `pikabuId`.
- GamePush JS SDK is loaded only for invisible first-account provisioning when mapping is absent.
- Daily leaderboard keeps first-result immutability.
- GamePush is eventually consistent; profile and leaderboard code must preserve the already implemented propagation handling.
- Four GamePush leaderboards are used:
  - `cascadeStandard`
  - `cascadeDaily`
  - `cascadeDailyStreak`
  - `cascadeMastery`

### 2.2 Hosting choice

Use Yandex Cloud rather than Cloudflare because backend availability from Russia is a product requirement.

Use:

- Yandex API Gateway as the public HTTPS endpoint;
- Yandex Cloud Functions with Node.js 22 as the private runtime;
- a service account with permission to invoke the private function from API Gateway;
- ordinary function environment variables for server configuration/secrets;
- no Lockbox, database, Object Storage, YDB, Redis, VPS or Serverless Container.

The explicit reason for not using Lockbox is the user's requirement to keep the initial backend capable of remaining free. The accepted trade-off is that users with sufficient Yandex Cloud permissions to inspect/edit the function version can see its environment configuration.

## 3. Cost model and zero-cost boundary

The design targets **zero rubles at the expected launch volume**, not an unconditional guarantee that Yandex Cloud can never charge money.

As verified against Yandex Cloud documentation on 2026-09-21, the current monthly free allowances relevant to this architecture are:

- API Gateway: first **100,000 requests/month**;
- Cloud Functions: first **1,000,000 invocations/month** and **10 GB×hour/month** of execution;
- outgoing internet traffic: the current serverless pricing provides a free allowance before paid traffic begins;
- Cloud Logging also has a free allowance, but logging is still a billable service category and is not part of the normal production design.

Because every normal backend HTTP request crosses both Gateway and Function, **API Gateway's 100,000 requests/month is the practical zero-cost request ceiling** for this design at current pricing. Free-tier usage is aggregated at billing-account scope, so other resources tied to the same billing account can consume part of the allowance.

The function must also avoid unrelated billable services.

To preserve the zero-cost target:

- no provisioned function instances;
- 128 MB function memory initially;
- no Lockbox;
- no database;
- no API Gateway access log shipping;
- no Cloud Function execution log shipping in normal production deployment (`--no-logging`);
- no Smart Web Security profile;
- no custom networking resources;
- no paid persistent observability stack.

Temporary logging may be enabled manually for debugging and then disabled again. Logging is explicitly treated as potentially billable.

The project should document the current free-tier thresholds, but code must not depend on those thresholds being permanent. A billing notification/budget warning is recommended operationally, not implemented in application code.

## 4. Runtime architecture

### 4.1 API Gateway

API Gateway is the only public Yandex endpoint.

The gateway uses an OpenAPI 3 specification with:

- a greedy route `/{proxy+}`;
- `x-yc-apigateway-any-method` so GET/PUT/POST/OPTIONS and future bridge methods are forwarded without duplicating routes;
- `x-yc-apigateway-integration.type = cloud_functions`;
- `payload_format_version = '2.0'`;
- a service account with `functions.functionInvoker` permission for the target function;
- no public access grant on the function itself.

A separate root `/` route may return a small health/identity response or be forwarded to the same function. It is not a gameplay API and is optional.

API Gateway must not perform account authentication. Pikabu assertion verification and bridge-session verification stay in application code, preserving current behavior and making the backend portable.

### 4.2 Cloud Function

The function runtime is Node.js 22.

The Yandex entry point is a thin adapter only. It:

1. receives API Gateway payload format 2.0;
2. reconstructs a standard Web `Request`:
   - method from `requestContext.http.method`;
   - path from `rawPath`;
   - query from `rawQueryString`;
   - headers from gateway headers;
   - body from `body`, decoding Base64 when required;
   - source IP exposed to the existing request-IP helper through a forwarded header if needed;
3. calls the runtime-independent `createCascadeHandler(request)`;
4. converts the returned Web `Response` into API Gateway response shape:
   - `statusCode`;
   - `headers`;
   - string `body`;
   - `isBase64Encoded: false` for current JSON/empty responses.

No business rule may live in this adapter.

### 4.3 Business layer

Move the current backend business files from:

```text
supabase/functions/cascade-api/
```

to:

```text
server/cascade-api/
```

Expected runtime-independent modules remain:

```text
auth.ts
gamepush.ts
http.ts
leaderboards.ts
profile.ts
session.ts
validation.ts
handler.ts
```

`handler.ts` exports `createCascadeHandler` and contains routing/business composition. It must not reference `Deno`, Yandex SDKs, Supabase APIs or Node-only request objects.

The current Web API primitives (`Request`, `Response`, `Headers`, `fetch`, Web Crypto) are retained because Node.js 22 provides them and the existing tests already exercise them.

## 5. HTTP contract remains unchanged

The browser continues using one base URL and the current REST paths.

### Session

```http
POST /v1/session
```

Responsibilities remain:

- verify Pikabu signed data with `PIKABU_GAME_SECRET`;
- resolve/create Pikabu -> GamePush mapping;
- perform first-login provisioning when required;
- issue short-lived bridge session JWT.

### Profile

```http
GET /v1/profile
PUT /v1/profile
```

Semantics remain exactly as in the current GamePush implementation, including the propagation-grace behavior added after GamePush eventual consistency was measured in production smoke testing.

### Leaderboards

```http
GET  /v1/leaderboards/{board}
POST /v1/leaderboards/{board}
```

The GamePush records remain:

```text
cascadeStandard
  bestStreak

cascadeDaily
  moves
  elapsedMs
  completedAt

cascadeDailyStreak
  currentStreak
  bestStreak

cascadeMastery
  masteryRank
  masteryPoints
```

The working admin-read path remains based on GamePush leaderboard/variant/admin-record APIs. The migration must not revert to the previously rejected synthetic `score` model or player-side `FetchTop` assumption.

## 6. Environment configuration

The Cloud Function version receives these variables through Yandex Function environment configuration.

Required secrets:

```text
PIKABU_GAME_SECRET
GAMEPUSH_API_SECRET
BRIDGE_SESSION_SECRET
```

Required non-secret server configuration:

```text
GAMEPUSH_PROJECT_ID=30632
CASCADE_ALLOWED_ORIGINS=<comma-separated exact origins>
GAMEPUSH_LEADERBOARD_STANDARD_ID=<real GamePush ID>
GAMEPUSH_LEADERBOARD_DAILY_ID=<real GamePush ID>
GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID=<real GamePush ID>
GAMEPUSH_LEADERBOARD_MASTERY_ID=<real GamePush ID>
```

Optional:

```text
GAMEPUSH_API_URL=https://api.gamepush.com/gs/api/graphql
```

### 6.1 No guessed leaderboard IDs

Production code must remove fallback leaderboard IDs.

The runtime must fail fast during cold start/version initialization if any required leaderboard ID is absent or invalid. This prevents silently talking to a deleted/recreated GamePush table.

`GAMEPUSH_PROJECT_ID` may remain explicitly required as well rather than silently defaulting to `30632`; the deployment template will provide `30632`.

### 6.2 Local deployment environment file

Add a gitignored local file template for deployment, for example:

```text
server/yandex/.env.deploy.local
```

with a committed `.example` file that contains variable names but no secrets.

Deployment tooling may read the local file and pass values to `yc serverless function version create --environment ...` so secrets do not have to be typed repeatedly. The real local file must be in `.gitignore`.

The browser `.env.pikabu.example` changes only its backend URL example:

```text
VITE_BACKEND_URL=https://<gateway-domain>
```

The public GamePush project ID/token used for invisible provisioning remain browser-visible as before.

## 7. Build and package

The Cloud Function package should contain a **single bundled CommonJS entry file** plus only metadata required by Yandex.

Add `esbuild` as a development dependency and build:

```text
server/yandex/index.ts
  -> dist/yandex-function/index.js
```

Target:

```text
platform=node
target=node22
format=cjs
```

Reasons:

- avoids shipping project `node_modules`;
- avoids depending on Yandex ESM loader behavior;
- keeps package very small;
- allows the runtime-independent TypeScript modules to be imported normally during development/tests;
- produces a conventional Yandex entry point `index.handler`.

The bundle must contain no Vite/browser configuration and no secrets.

## 8. Deployment resources

The migration introduces exactly three Yandex resources:

1. **Cloud Function** — e.g. `cascade-api`.
2. **Service account** — e.g. `cascade-api-gateway-invoker`.
3. **API Gateway** — e.g. `cascade-api`.

The service account receives only the minimum role needed to invoke the function.

The function itself should remain private. Do not run `allow-unauthenticated-invoke` on it.

The API Gateway is intentionally public because it is the browser API endpoint; application-level session/auth rules protect writes.

## 9. Deployment workflow

Provide repository tooling for a Windows/PowerShell user.

The intended workflow is:

```text
pnpm backend:build:yandex
pnpm backend:test
<one deployment PowerShell script or documented yc commands>
```

The first deployment may require one-time creation of the function, service account and gateway. Subsequent deployments create a new function version and update/reuse the gateway spec.

The deployment script must:

- stop on missing `yc` CLI;
- stop on missing required local env values;
- never print secret values;
- build before deployment;
- deploy Node.js 22 / 128 MB / no provisioned instances;
- disable Yandex logging by default to protect the zero-cost goal;
- apply the API Gateway specification with the resolved function/service-account IDs;
- print the resulting public gateway domain;
- never write server secrets into `VITE_*` files.

Infrastructure creation should be idempotent where practical, but this is a small single-project deployment script, not a full Terraform system.

## 10. Supabase removal

After the Yandex runtime is implemented and local tests pass, remove:

```text
supabase/
```

including:

- Edge Function source at the old path;
- old Postgres migrations;
- old Supabase backend tests/config/temp files.

Also remove from `package.json`:

```text
supabase devDependency
backend:start -> supabase start
supabase:serve
```

Replace with Yandex/backend scripts.

All tests importing `../supabase/functions/cascade-api/...` must be updated to `../server/cascade-api/...`.

A regression test must explicitly assert that production source/package configuration no longer references:

```text
supabase
SUPABASE_
/rest/v1/
/rpc/
```

except in historical docs/specs that intentionally describe the migration.

Because this migration deletes and moves files, the final user patch must **not** be a plain overlay only. It must include an apply script that copies new files and removes the obsolete Supabase tree/renamed backend paths safely.

## 11. Client changes

The gameplay client should change as little as possible.

`BackendClient`, `CloudProfileService`, `BackendLeaderboards`, Pikabu session handling, merge coordinator and offline fallback remain unchanged unless a test exposes a runtime-specific assumption.

Primary client change:

```text
.env.pikabu.example
VITE_BACKEND_URL:
  Supabase Edge Function URL
  -> Yandex API Gateway base URL
```

No Yandex Cloud SDK is added to the browser.

## 12. Rate limiting and abuse boundary

The existing in-memory `FixedWindowRateLimiter` is preserved as a **soft per-instance abuse guard**, not a globally authoritative quota. Serverless instances can scale independently and cold starts reset memory.

Security must not depend on this limiter. The actual trust boundary remains:

- Pikabu signature verification;
- bridge-session signature/expiry;
- server-side GamePush API secret;
- validation of request bodies;
- first-result receipt logic for Daily.

A globally consistent rate-limit store is explicitly out of scope because it would add persistent infrastructure and violate the no-database/free-start goal.

If abuse becomes real after launch, API Gateway native rate limiting can be evaluated separately without changing the HTTP contract.

## 13. Error handling and observability

The existing public error behavior remains:

- 400 for invalid payloads;
- 401 for missing/expired/invalid account session;
- 404 for unknown API path/board;
- 405 for unsupported method;
- 413 for oversized body;
- 429 for the soft limiter;
- 500 for unexpected backend failures without exposing secrets/upstream bodies.

The Yandex adapter may include a request ID in internal error logging when temporary logging is enabled, but production responses must not expose:

- GamePush API secret;
- Pikabu secret;
- bridge signing secret;
- raw GamePush auth envelope;
- full signed Pikabu JWT.

Normal production deployment keeps paid logging disabled. Debug deployment instructions must explain how to enable it temporarily.

## 14. Testing strategy

### 14.1 Existing backend contract tests

Move/update the current tests so they continue to cover:

- Pikabu JWT verification;
- bridge session issue/verify/expiry;
- provisioning/mapping;
- profile normalization and merge;
- eventual-consistency grace behavior;
- Daily first-result immutability;
- leaderboard record schema and admin reads;
- CORS/body limits/routing.

### 14.2 New Yandex adapter tests

Add focused tests for API Gateway payload v2 -> Web Request -> Web Response conversion:

- GET with query string;
- POST JSON body;
- Base64 request body;
- authorization/origin/content-type headers;
- source IP propagation;
- 204 empty OPTIONS response;
- backend 4xx and 5xx response preservation.

### 14.3 Supabase-removal regression test

Add a source-level test confirming:

- no `supabase` dependency/scripts in `package.json`;
- no runtime source under `supabase/`;
- no production import path contains `supabase/functions/cascade-api`;
- `.env.pikabu.example` points at a generic Yandex Gateway URL placeholder.

### 14.4 Verification before deployment

Required local commands after implementation:

```text
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:build:yandex
pnpm gamepush:smoke
```

`gamepush:smoke` remains a direct Server API test and is intentionally independent of Yandex hosting.

### 14.5 Live Yandex smoke

After deployment, add/run a small backend-runtime smoke against the gateway that verifies at minimum:

- unknown route returns expected 404 JSON;
- CORS behavior for an allowed origin;
- unauthorized `/v1/profile` returns 401;
- `/v1/session` rejects malformed signed data cleanly.

Full successful Pikabu session/provisioning must then be tested from the real Pikabu build because it requires genuine Pikabu signed data.

## 15. Migration sequence

1. Copy/move business modules to `server/cascade-api` and make environment/runtime injection explicit.
2. Add Yandex adapter and adapter tests.
3. Add backend bundle/build tooling.
4. Add API Gateway OpenAPI spec template.
5. Add deployment config template and PowerShell deployment tooling.
6. Remove fallback GamePush leaderboard IDs.
7. Update all backend tests/imports.
8. Delete Supabase runtime/migrations/config/dependency/scripts.
9. Update `.env.pikabu.example`.
10. Run full local verification and existing GamePush smoke.
11. User creates/deploys Yandex resources with the provided tooling.
12. Run gateway smoke.
13. Point Pikabu build at gateway URL.
14. Test real Pikabu auth/provisioning/profile/leaderboards.
15. Only after live verification, delete/deactivate the old deployed Supabase Function in the Supabase dashboard if it still exists remotely.

The old remote Supabase endpoint should remain untouched until the new gateway is proven, providing a rollback path during deployment.

## 16. Rollback

Code rollback before launch is simple because the browser base URL is configuration-driven.

If the Yandex deployment fails during verification:

- keep the new code locally;
- temporarily restore `VITE_BACKEND_URL` to the old deployed Supabase Edge Function URL;
- do not change GamePush data or leaderboard configuration;
- fix Yandex deployment/runtime issues;
- switch the browser URL back when verified.

No profile migration is required in either direction because persistent player data is already in GamePush.

## 17. Explicitly rejected alternatives

### Cloudflare Workers

Rejected for this product because reliable access from Russia is a requirement.

### Keep Supabase only for Edge Functions

Rejected because the user wants zero Supabase dependency, not merely zero Supabase database usage.

### Yandex Serverless Containers

Rejected as unnecessary complexity for a small stateless bridge that already fits the Cloud Functions execution model.

### Yandex Lockbox

Rejected for the initial release because the accepted goal is a backend that can remain within free usage. Function environment variables are accepted instead.

### One generic `POST { action: ... }` endpoint

Rejected because the existing REST contract is clean and API Gateway can preserve it without client churn.

## 18. Acceptance criteria

The migration is complete only when all of the following are true:

- `supabase/` is gone from active project source;
- `supabase` is gone from package dependencies and active npm scripts;
- backend business logic lives under `server/cascade-api`;
- Yandex adapter is thin and tested;
- Node.js 22 function bundle builds reproducibly;
- API Gateway spec forwards existing paths without changing browser API semantics;
- function is private and gateway invokes it through a service account;
- production deployment requires explicit real GamePush leaderboard IDs and has no guessed ID fallbacks;
- paid Yandex logging is disabled by default;
- `pnpm test`, `pnpm build`, `pnpm build:pikabu`, backend build and GamePush smoke pass;
- live gateway smoke passes;
- real Pikabu login can create/refresh bridge session;
- first-login provisioning works without visible GamePush login UI;
- profile sync works on at least two browser sessions/devices;
- Standard, Daily, Daily Streak and Mastery reads/submits work through the gateway;
- Daily first-result behavior remains immutable;
- guest local play still works when backend is unavailable.
