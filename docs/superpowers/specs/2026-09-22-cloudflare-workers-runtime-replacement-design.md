# Cascade: Cloudflare Workers runtime replacement — design

Date: 2026-09-22  
Status: awaiting user review  
Supersedes runtime/hosting sections of:
- `docs/superpowers/specs/2026-09-21-yandex-cloud-runtime-migration-design.md`
- `docs/superpowers/specs/2026-09-21-pikabu-gamepush-stateless-bridge-design.md`

## 1. Goal

Replace the not-yet-deployed Yandex Cloud runtime with a Cloudflare Worker while preserving the already extracted runtime-neutral Cascade backend and the current browser HTTP contract.

Final Pikabu backend path:

```text
Cascade browser / Pikabu
  -> Cloudflare Worker (`workers.dev` initially)
  -> GamePush Server API
```

The replacement is successful when:

- Supabase remains completely absent;
- Yandex Cloud runtime/config/deploy code is removed from the active project;
- there is no API Gateway, Cloud Function, service account, Lockbox, database, KV, D1, R2, Queue, Durable Object or other persistent Cloudflare service;
- the browser-facing REST contract remains unchanged (`/v1/session`, `/v1/profile`, `/v1/leaderboards/:board`);
- GamePush profile, Pikabu↔GamePush mapping, Daily first-result immutability and all four leaderboard flows preserve their existing semantics;
- server secrets are stored only as Cloudflare Worker secrets, never in `wrangler.jsonc`, Vite env or the browser bundle;
- the Worker stays on the Workers Free plan; no paid Workers plan is required for launch;
- local/offline play still works when the backend is unavailable;
- the accepted product risk is documented: some Russian ISPs may make Cloudflare connectivity unreliable.

## 2. Decisions and constraints already fixed

### 2.1 Backend/product behavior does not change

The runtime replacement must not redesign cloud persistence or account behavior:

- Pikabu SDK remains the public identity source and provides signed data, public name/avatar, ads and lifecycle.
- Guest mode remains local-only for cloud profile writes.
- `localStorage` remains the immediate/local progress source.
- GamePush remains the only persistent backend store used by Cascade.
- GamePush player field `cascadeProfile` stores the cloud profile.
- GamePush Unique Values maps verified Pikabu ID to GamePush player ID under tag `pikabuId`.
- GamePush JS SDK is used only for invisible first-account provisioning when the mapping is absent.
- The bridge continues issuing its own short-lived stateless session token after Pikabu verification.
- Daily leaderboard keeps first-result immutability.
- GamePush eventual consistency behavior and the existing client propagation grace remain unchanged.
- Four GamePush leaderboards remain:
  - `cascadeStandard`
  - `cascadeDaily`
  - `cascadeDailyStreak`
  - `cascadeMastery`

### 2.2 Hosting decision

Use Cloudflare Workers Free as the stateless bridge runtime.

Use only:

- one Worker;
- the default `workers.dev` hostname initially;
- Worker secrets for secret values;
- plain Worker vars for non-secret values.

Do **not** use:

- KV;
- D1;
- R2;
- Durable Objects;
- Queues;
- Workflows;
- Hyperdrive;
- Pages Functions;
- custom Cloudflare DNS/domain during the initial migration;
- paid Workers plan.

The choice intentionally trades some Russia-access reliability for much simpler deployment and no required payment card/billing setup.

## 3. Free-plan boundary and failure behavior

As checked against Cloudflare documentation on 2026-09-22, Workers Free currently provides:

- 100,000 Worker requests per day;
- 10 ms CPU time per HTTP request;
- 128 MB memory;
- 50 subrequests per invocation;
- no charge for waiting on outbound `fetch()` calls because network wait time is not CPU time.

When the Free daily request allowance is exhausted, requests fail rather than automatically becoming paid usage. The Worker must stay on the Free plan; this project must not contain automation that upgrades the account to Workers Paid.

The practical technical risk is the 10 ms CPU budget. The bridge performs JWT/HMAC verification, JSON parsing and small merge/validation operations, plus outbound GamePush fetches. Network wait does not count toward CPU, but auth-heavy requests can approach the Free CPU ceiling. Therefore real deployed smoke testing must explicitly exercise:

- session verification;
- profile GET/PUT;
- leaderboard GET/POST;
- first-login provisioning path when available.

If the Worker consistently returns Cloudflare resource-limit error `1102`, that is a release blocker for the Free-runtime design. Do not silently upgrade to a paid plan; reassess runtime/CPU work first.

Cloudflare access from Russia is an accepted operational risk. Backend failures must continue to degrade to local/offline play rather than corrupt local progress.

## 4. Runtime architecture

### 4.1 Worker entry point

Create a thin Worker adapter, for example:

```text
server/cloudflare/worker.ts
```

It exports the standard Worker module shape:

```ts
export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // build runtime config from env
    // call runtime-neutral Cascade handler
  },
};
```

The adapter must contain no GamePush/profile/leaderboard business rules.

Its responsibilities are only:

1. receive the native Worker `Request`;
2. create/obtain validated runtime configuration from Worker env bindings;
3. invoke the runtime-independent Cascade handler;
4. return its Web `Response` unchanged except for adapter-level unexpected-error protection if needed.

Workers already use the Web `Request`, `Response`, `Headers`, `fetch` and Web Crypto APIs used by the extracted backend, so no API-Gateway event reconstruction layer is needed.

### 4.2 Runtime-neutral backend

Keep the already extracted business layer under:

```text
server/cascade-api/
```

Expected modules remain runtime-neutral, including:

```text
auth.ts
gamepush.ts
http.ts
leaderboards.ts
profile.ts
session.ts
validation.ts
handler.ts
config.ts
```

The business layer must not reference:

- `Deno`;
- Supabase APIs;
- Yandex SDK/event types;
- Cloudflare KV/D1/R2/DO APIs;
- browser globals such as `window`/`localStorage`.

Cloudflare-specific env typing/wiring stays in `server/cloudflare/`.

## 5. HTTP contract remains unchanged

The browser keeps a single backend base URL and the existing paths.

### Session

```http
POST /v1/session
```

Still performs:

- Pikabu signed-data verification with `PIKABU_GAME_SECRET`;
- Pikabu -> GamePush mapping resolution;
- first-login GamePush provisioning when mapping is missing;
- short-lived bridge session issuance.

### Profile

```http
GET /v1/profile
PUT /v1/profile
```

Semantics remain unchanged, including GamePush eventual-consistency handling and client propagation grace.

### Leaderboards

```http
GET  /v1/leaderboards/{board}
POST /v1/leaderboards/{board}
```

GamePush score order remains exactly:

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

Numeric leaderboard IDs remain explicit runtime configuration. There must be no guessed/hardcoded fallback IDs anywhere in production or smoke code.

## 6. Cloudflare configuration

### 6.1 `wrangler.jsonc`

Add a root config, initially similar in responsibility to:

```text
wrangler.jsonc
```

It declares:

- Worker name: `cascade-api`;
- entry point: `server/cloudflare/worker.ts`;
- a current compatibility date pinned in source control;
- `workers_dev = true`;
- non-secret vars only.

Non-secret bindings:

```text
GAMEPUSH_PROJECT_ID=30632
GAMEPUSH_API_URL=https://api.gamepush.com/gs/api/graphql
GAMEPUSH_LEADERBOARD_STANDARD_ID=<explicit>
GAMEPUSH_LEADERBOARD_DAILY_ID=<explicit>
GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID=<explicit>
GAMEPUSH_LEADERBOARD_MASTERY_ID=<explicit>
CASCADE_ALLOWED_ORIGINS=<explicit list>
```

Known confirmed IDs remain:

```text
cascadeStandard     100307
cascadeDaily        100308
cascadeDailyStreak  100312
```

The recreated Mastery ID must remain supplied from the real configured value; never infer it.

Because the Pikabu production origin is not yet final, local origins may be present during development. Production release must add the actual Pikabu origin and must not use `*` for credentialed/authenticated API access.

### 6.2 Worker secrets

These values are never committed:

```text
PIKABU_GAME_SECRET
GAMEPUSH_API_SECRET
BRIDGE_SESSION_SECRET
```

Set them interactively with Wrangler:

```powershell
pnpm exec wrangler secret put PIKABU_GAME_SECRET
pnpm exec wrangler secret put GAMEPUSH_API_SECRET
pnpm exec wrangler secret put BRIDGE_SESSION_SECRET
```

Do not create a committed `.env` containing them.

For local Worker development, if a `.dev.vars` file is introduced, it must be gitignored and represented only by a safe `.dev.vars.example` with placeholders. The migration should prefer not to require persistent local secret files when interactive Wrangler commands are sufficient.

## 7. Build and dependency strategy

Use Wrangler's normal bundling pipeline for the Worker. Do not keep the Yandex-specific `scripts/build-yandex-function.mjs` bundle path.

Add Wrangler as a development dependency and package scripts with narrow responsibilities, for example:

```text
backend:dev:cloudflare
backend:deploy:cloudflare
backend:smoke:cloudflare
```

The existing browser builds remain:

```text
pnpm build
pnpm build:pikabu
```

The Worker build/deploy must never pull `PIKABU_GAME_SECRET`, `GAMEPUSH_API_SECRET` or `BRIDGE_SESSION_SECRET` into Vite build-time variables.

If Cloudflare type packages are needed, prefer the minimum supported typing setup. Do not enable broad `nodejs_compat` unless an actual backend dependency requires Node APIs; the current runtime-neutral backend should run on Web APIs directly.

## 8. Client configuration

The frontend change is only the backend base URL.

Development/release config must point `VITE_CASCADE_BACKEND_URL` at the deployed Worker, initially:

```text
https://cascade-api.<account-subdomain>.workers.dev
```

No Cloudflare API token or Worker secret enters Vite env.

`BackendClient` request paths, session refresh behavior, timeout behavior and offline fallback remain unchanged.

## 9. Removal of Yandex-specific implementation

Remove active Yandex runtime/deploy artifacts introduced by the previous migration, including their tests/config where present:

```text
server/yandex/
scripts/build-yandex-function.mjs
scripts/deploy-yandex-backend.ps1
scripts/render-yandex-gateway.mjs
scripts/smoke-yandex-backend.mjs
Yandex-specific generated Gateway/OpenAPI/config files
Yandex-only package scripts
tests that only validate Yandex adapter/deployment behavior
```

Do not remove the historical Yandex design/plan documents; they remain project history and are superseded by this spec.

The user's local untracked `server/yandex/.env.deploy.local` may contain real secrets. The migration patch must **not silently destroy or expose it**. If an apply script encounters it, it should leave it in place or explicitly warn. After the three Worker secrets have been uploaded successfully, the user can delete that local Yandex env file manually.

No Yandex resource was successfully created during the failed deployment attempts, so no cloud cleanup is required as part of the migration.

## 10. CORS and security

The Worker must preserve the existing CORS allowlist behavior:

- allow only exact origins configured in `CASCADE_ALLOWED_ORIGINS`;
- support preflight `OPTIONS`;
- never reflect arbitrary `Origin` values;
- do not use `*` for authenticated endpoints;
- preserve required request headers such as authorization/content type.

Security invariants remain:

- Pikabu signed data is verified server-side;
- raw client GamePush player IDs are never trusted as identity;
- GamePush admin API secret is server-only;
- bridge session secret is server-only;
- all GamePush numeric leaderboard IDs are configuration, not user input;
- malformed/expired bridge sessions remain rejected;
- guest clients cannot write cloud profile data merely by knowing the endpoint.

## 11. Smoke and release verification

### 11.1 Local/source verification

Before deployment:

```text
pnpm test
pnpm build
pnpm build:pikabu
```

Add focused Worker tests that prove:

- native Worker Request reaches the runtime-neutral handler;
- env bindings are converted to the exact runtime config;
- missing required binding fails closed with a controlled server error and does not leak the missing secret value;
- CORS/preflight behavior is preserved;
- no Yandex/Supabase runtime import remains in active server code;
- no fallback leaderboard IDs remain.

### 11.2 Cloudflare deploy verification

First-time operator flow:

```powershell
pnpm exec wrangler login
pnpm exec wrangler secret put PIKABU_GAME_SECRET
pnpm exec wrangler secret put GAMEPUSH_API_SECRET
pnpm exec wrangler secret put BRIDGE_SESSION_SECRET
pnpm backend:deploy:cloudflare
```

Deployment output must provide the `workers.dev` URL.

Run a non-mutating Worker smoke first:

- unknown route -> controlled 404;
- unauthorized protected request -> controlled 401;
- allowed local/Pikabu Origin gets expected CORS headers;
- disallowed Origin is not granted CORS access.

Then run the already-existing GamePush smoke with all four explicit leaderboard IDs, followed by real authenticated Pikabu bridge checks.

### 11.3 CPU/free-plan release gate

During real Worker testing, inspect Cloudflare Worker errors/observability enough to establish that normal bridge requests are not consistently hitting CPU error `1102`.

A consistent CPU-limit failure blocks release on Workers Free. The response is **not** to automatically enable Workers Paid. Profile the request path and reassess hosting if necessary.

## 12. Rollback

The runtime-neutral backend makes rollback straightforward.

Before changing the production Pikabu frontend backend URL:

- keep the previous frontend build/config available;
- validate Worker smoke and authenticated flows independently.

If Worker access from Russian networks proves unacceptable before release, do not mutate GamePush data model or restore Supabase. Replace only the thin runtime adapter/hosting layer again.

GamePush remains the source of persistent profile/leaderboard state throughout, so changing runtime host does not require data migration.

## 13. Out of scope

This migration does not:

- change Cascade game rules/UI;
- redesign profile schema;
- redesign leaderboards;
- add paid hosting;
- add Cloudflare storage products;
- add a custom domain;
- solve Russian ISP blocking at the application layer;
- introduce analytics/log storage;
- change Pikabu ad integration;
- change GamePush eventual-consistency policy.

## 14. Acceptance checklist

The implementation is complete only when all of the following are true:

- [ ] `server/cascade-api` remains the sole business/backend core.
- [ ] Cloudflare Worker adapter exists and contains no business rules.
- [ ] `wrangler.jsonc` contains only non-secret configuration.
- [ ] three server secrets are configured through Worker secrets.
- [ ] all four leaderboard IDs are explicit; no fallbacks exist.
- [ ] Yandex runtime/deploy code is removed from active project code.
- [ ] Supabase remains absent.
- [ ] browser build contains no backend secret.
- [ ] existing REST paths remain unchanged.
- [ ] local test suite passes.
- [ ] browser normal and Pikabu builds pass.
- [ ] Worker deploy succeeds on Workers Free.
- [ ] non-mutating Worker smoke succeeds.
- [ ] GamePush smoke succeeds with explicit IDs.
- [ ] authenticated Pikabu session/profile/leaderboard E2E succeeds.
- [ ] normal Worker requests do not consistently hit Cloudflare CPU limit `1102`.
- [ ] production Pikabu origin is present in CORS allowlist before release.
- [ ] `VITE_CASCADE_BACKEND_URL` points to the deployed Worker.
