# Pikabu + GamePush Stateless Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pikabu Postgres/Supabase backend with a database-free stateless bridge that trusts Pikabu identity, stores Cascade cloud state and leaderboards in GamePush, preserves local-first play, and leaves Yandex unchanged.

**Architecture:** Pikabu remains the only visible platform/auth/ads SDK. The browser talks to a small Edge Function using a short-lived bridge session; the Edge Function verifies Pikabu signed data, resolves `pikabuId -> GamePush ownerId` through GamePush Unique Values, and performs all GamePush Server API profile/leaderboard operations. Browser progress stays immediate in localStorage, and profile synchronization keeps the existing semantic BASE/LOCAL/CLOUD merge while removing Postgres revisions/CAS.

**Tech Stack:** TypeScript 5.9, Phaser 4, Vite 7, Node test runner, Supabase Edge Functions/Deno as temporary runtime, GamePush GraphQL Server API, Pikabu SDK.

**Spec:** `docs/superpowers/specs/2026-09-21-pikabu-gamepush-stateless-bridge-design.md`

## Global Constraints

- Pikabu is the only user-facing identity/auth source; no GamePush login/code/account UI.
- Yandex storage/auth/leaderboards/ads behavior must remain unchanged.
- No Postgres tables, migrations, RPC, profile rows, leaderboard rows, or DB CAS in the new Pikabu backend path.
- Browser code must never contain `PIKABU_GAME_SECRET`, `GAMEPUSH_API_SECRET`, or `BRIDGE_SESSION_SECRET`.
- GamePush project ID is `30632`.
- GamePush Unique Values mapping tag is `pikabuId`; lookup is by verified Pikabu ID and returns `ownerId`.
- GamePush player custom field is `cascadeProfile : String` containing normalized `CloudSnapshot` JSON.
- Bridge session JWT claims are `iss="cascade-bridge"`, `aud="cascade-pikabu"`, `sub=<GamePush player id>`, `pid=<verified Pikabu id>`, `iat`, `exp`, with a 30-minute lifetime.
- Daily first official result remains immutable; replay must not improve the Daily leaderboard.
- Backend/GamePush failure must never block local play or local saves.
- Do not apply `cascade-patch-gamepush-pikabu-phase1.zip` as a platform replacement; only reuse its lazy GamePush SDK loader shape for provisioning.

## Review Focus

- **Old local cloud-state format:** existing `version: 1` `CloudSyncState` must migrate without dropping pending profile or leaderboard work.
- **Concurrent first login:** two devices racing to create `pikabuId` must both end up on the mapping winner, never overwrite it.
- **Expired/tampered bridge session:** one transparent refresh is allowed; repeated 401 must stop rather than loop.
- **Corrupt GamePush `cascadeProfile`:** bridge must return an error and preserve the local copy instead of overwriting corrupted remote state.
- **Daily receipt partial failure:** if receipt creation succeeds but record publication fails, retry of the exact same receipt must republish; a different receipt must be treated as replay.

---

### Task 1: Pin the GamePush Server API contract and add a focused server adapter

**Files:**
- Create: `scripts/gamepush-contract-introspection.ps1`
- Create: `supabase/functions/cascade-api/gamepush.ts`
- Create: `tests/gamepush-backend.test.ts`
- Create after live capture: `docs/contracts/gamepush-server-api-30632.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `GAMEPUSH_API_SECRET`, project `30632`, GamePush GraphQL endpoint `https://api.gamepush.com/gs/api/graphql`.
- Produces:

```ts
export interface GamePushPlatformAuth {
  readonly playerData: string;
  readonly platform: string;
  readonly platformKey: string;
}

export interface GamePushPublicPlayer {
  readonly id: number;
  readonly name: string;
  readonly avatar: string;
}

export interface GamePushLeaderboardRow {
  readonly rank: number;
  readonly playerId: number;
  readonly name: string;
  readonly avatar: string;
  readonly score: number;
}

export interface GamePushBackend {
  findPikabuMapping(pikabuId: string): Promise<number | null>;
  createPikabuMapping(ownerId: number, pikabuId: string): Promise<'created' | 'exists'>;
  resolvePlatformPlayer(auth: GamePushPlatformAuth): Promise<GamePushPublicPlayer>;
  readCascadeProfile(playerId: number): Promise<string | null>;
  writeCascadeProfile(playerId: number, serialized: string): Promise<void>;
  syncVerifiedIdentity(playerId: number, name: string, avatar: string): Promise<void>;
  fetchTop(tag: string, variant: string, limit: number): Promise<readonly GamePushLeaderboardRow[]>;
  fetchPlayerRating(playerId: number, tag: string, variant: string): Promise<GamePushLeaderboardRow | null>;
  publishRecord(playerId: number, tag: string, variant: string, score: number): Promise<void>;
  createUniqueValue(ownerId: number, tag: string, value: string): Promise<'created' | 'exists'>;
  findUniqueValue(ownerId: number, tag: string): Promise<string | null>;
}
```

- [ ] **Step 1: Add a live introspection script that never prints the secret**

Create `scripts/gamepush-contract-introspection.ps1` with the endpoint/project headers and one introspection query that captures root fields plus `FetchUniqueValuesInput`, `CreateUniqueValueInput`, `UniqueValue`, `FindPlayerByIDInput`, `UpdatePlayerInput`, and every input/output type referenced by `GetPlayer`, `FetchTop`, `FetchPlayerRating`, and `PlayerPublishRecord`. The script must write JSON only to the path passed through `-OutFile` and must fail if `$env:GAMEPUSH_API_SECRET` is empty.

Use this shell contract:

```powershell
param([string]$OutFile = "docs/contracts/gamepush-server-api-30632.json")
if (-not $env:GAMEPUSH_API_SECRET) { throw "GAMEPUSH_API_SECRET is not set" }
$headers = @{
  "Content-Type" = "application/json"
  "X-API-Secret" = $env:GAMEPUSH_API_SECRET
  "X-Project-ID" = "30632"
}
$query = @'
query CascadeContract {
  __schema {
    queryType { fields { name args { name type { kind name ofType { kind name } } } type { kind name ofType { kind name } } } }
    mutationType { fields { name args { name type { kind name ofType { kind name } } } type { kind name ofType { kind name } } } }
    types {
      name kind
      inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
      fields { name type { kind name ofType { kind name ofType { kind name } } } }
      possibleTypes { name }
    }
  }
}
'@
$body = @{ query = $query } | ConvertTo-Json -Depth 30
$response = Invoke-RestMethod -Uri "https://api.gamepush.com/gs/api/graphql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
$dir = Split-Path -Parent $OutFile
if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$response.data.__schema | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 $OutFile
```

- [ ] **Step 2: Run the introspection once and verify the already-proven unique-value contract**

Run:

```powershell
pwsh -File scripts/gamepush-contract-introspection.ps1 -OutFile docs/contracts/gamepush-server-api-30632.json
```

Expected captured contract includes these exact facts already observed in the spike:

```text
FetchUniqueValuesInput(projectId:Int!, ownerId:Int, tag:String, value:String, limit:Int, offset:Int)
CreateUniqueValueInput(ownerId:Int!, tag:String!, value:String!, projectId:Int!)
UniqueValue(id:String!, ownerId:Int!, tag:String!, value:String!, projectId:Int!)
FindPlayerByIDInput(projectId:Int!, id:Int!)
UpdatePlayerInput(id:Int!, name:String!, avatar:String!, projectId:Int!, credentials:String!, state:Any!)
```

Also verify the captured root schema contains `GetPlayer`, `FetchTop`, `FetchPlayerRating`, and `PlayerPublishRecord`. If any of those names differ, stop this task and update the adapter method only to the actual captured name before continuing; do not guess an alias.

- [ ] **Step 3: Write failing adapter tests around the exact transport behavior**

Create `tests/gamepush-backend.test.ts` with a fake `fetch` that asserts:

```ts
assert.equal(headers.get('x-api-secret'), 'secret');
assert.equal(headers.get('x-project-id'), '30632');
assert.equal(headers.has('authorization'), false);
```

Add cases for:

```ts
findPikabuMapping('42')          // returns ownerId from UniqueValue
findPikabuMapping('missing')     // returns null
createPikabuMapping(17, '42')    // returns 'created'
createPikabuMapping conflict     // returns 'exists' after refetch
readCascadeProfile(17)           // returns exact cascadeProfile string or null
writeCascadeProfile(17, json)    // preserves unrelated state from the fetched player
syncVerifiedIdentity(...)        // preserves credentials/state while changing only verified public identity
Problem union                    // throws GamePushApiError with stable code/status classification
```

- [ ] **Step 4: Run the new tests and verify they fail before implementation**

Run:

```bash
node --test tests/gamepush-backend.test.ts
```

Expected: FAIL because `supabase/functions/cascade-api/gamepush.ts` does not exist.

- [ ] **Step 5: Implement the GraphQL adapter with one transport helper and explicit union parsing**

Implement one `GamePushGraphqlBackend` class. All query strings stay in this file. `FetchUniqueValues` must filter by `projectId: 30632`, `tag: "pikabuId"`, `value: <verified id>`, `limit: 2`; more than one returned mapping is treated as backend corruption. Player reads use the exact captured GamePush player operation; mapped-player updates must read the full player first and preserve credentials/state/unrelated custom fields before writing `cascadeProfile` or verified identity.

Use one error type:

```ts
export class GamePushApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid' | 'auth' | 'conflict' | 'unavailable',
    readonly details?: unknown,
  ) { super(message); this.name = 'GamePushApiError'; }
}
```

- [ ] **Step 6: Run adapter tests**

Run:

```bash
node --test tests/gamepush-backend.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/gamepush-contract-introspection.ps1 docs/contracts/gamepush-server-api-30632.json supabase/functions/cascade-api/gamepush.ts tests/gamepush-backend.test.ts .gitignore
git commit -m "feat: add GamePush server adapter contract"
```

---

### Task 2: Add bridge-session JWTs and `/v1/session`

**Files:**
- Create: `supabase/functions/cascade-api/session.ts`
- Create: `tests/bridge-session.test.ts`
- Modify: `supabase/functions/cascade-api/auth.ts`
- Modify: `supabase/functions/cascade-api/validation.ts`
- Modify: `supabase/functions/cascade-api/index.ts`

**Interfaces:**
- Consumes: `verifyPikabuSignedData`, `GamePushBackend`, `PIKABU_GAME_SECRET`, `BRIDGE_SESSION_SECRET`.
- Produces:

```ts
export interface BridgeClaims {
  readonly gamePushPlayerId: number;
  readonly pikabuId: string;
  readonly name: string;
  readonly avatar: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface SessionRequestBody {
  readonly signedData: string;
  readonly provisioning?: {
    readonly playerData: string;
    readonly platform: string;
    readonly platformKey: string;
  };
}
```

HTTP success:

```json
{ "token": "<bridge jwt>", "expiresAtMs": 1790000000000 }
```

HTTP provisioning required:

```json
{ "code": "PROVISIONING_REQUIRED" }
```

- [ ] **Step 1: Write failing JWT/session tests**

Add tests for valid signing/verification, wrong HMAC, wrong `iss`, wrong `aud`, expired `exp`, missing `sub`/`pid`, guest Pikabu token, existing mapping, missing mapping, provisioning path, and concurrent create conflict followed by re-fetch of the mapping winner.

The race assertion must be explicit:

```ts
assert.equal(result.gamePushPlayerId, existingWinnerOwnerId);
assert.notEqual(result.gamePushPlayerId, losingProvisionedPlayerId);
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/bridge-session.test.ts tests/pikabu-signed-data.test.ts
```

Expected: FAIL because session functions/routes are absent.

- [ ] **Step 3: Extract generic HS256 helpers without weakening Pikabu verification**

Keep Pikabu verification strict to `alg === 'HS256'`. Add bridge JWT encoding/signing/verification helpers that require:

```ts
iss === 'cascade-bridge'
aud === 'cascade-pikabu'
Number.isSafeInteger(sub) && sub > 0
typeof pid === 'string' && pid.length > 0
exp > nowSeconds
```

Do not reuse the Pikabu token as a bridge token.

- [ ] **Step 4: Implement `handleSession`**

Flow:

```text
verify signedData
-> findPikabuMapping(verified.id)
-> mapping found: sync verified name/avatar, issue 30-minute bridge JWT
-> mapping missing + no provisioning: 409 PROVISIONING_REQUIRED
-> mapping missing + provisioning: resolvePlatformPlayer(auth), attempt create mapping
-> create conflict: refetch mapping and use winner
-> sync verified name/avatar
-> issue bridge JWT
```

Ignore any browser-supplied GamePush numeric player ID; the accepted request schema must not contain one.

- [ ] **Step 5: Route `/v1/session` and switch account-scoped auth to bridge JWTs**

`POST /v1/session` verifies Pikabu signed data. Profile/leaderboard account endpoints call `verifyBridgeSession()` instead of `verifyPikabuSignedData()` directly. Public leaderboard GET continues to work without Authorization.

Keep the existing origin allowlist and fixed-window limiter. Rate-limit `/v1/session` by IP before mapping is known; after bridge verification, rate-limit account-scoped reads/writes by `claims.pikabuId`. Add assertions that blocked origins receive no permissive CORS header and rate limits return 429 without calling GamePush.

- [ ] **Step 6: Run tests**

```bash
node --test tests/bridge-session.test.ts tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/cascade-api/auth.ts supabase/functions/cascade-api/session.ts supabase/functions/cascade-api/validation.ts supabase/functions/cascade-api/index.ts tests/bridge-session.test.ts tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts
git commit -m "feat: add Pikabu bridge sessions"
```

---

### Task 3: Add lazy GamePush provisioning to the Pikabu client without replacing Pikabu

**Files:**
- Create: `src/platform/GamePushConfig.ts`
- Create: `src/platform/GamePushProvisioning.ts`
- Create: `tests/gamepush-provisioning.test.ts`
- Modify: `src/platform/services.ts`
- Modify: `src/platform/pikabu.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.pikabu.example`
- Modify: `.github/workflows/deploy-pikabu.yml`
- Modify: `tests/pikabu-platform.test.ts`
- Modify: `tests/pikabu-build-paths.test.ts`
- Modify: `tests/platform-target.test.ts`

**Interfaces:**
- Produces:

```ts
export interface BackendProvisioningAuth {
  readonly playerData: string;
  readonly platform: string;
  readonly platformKey: string;
}

export interface BackendProvisioningProvider {
  getAuth(): Promise<BackendProvisioningAuth | null>;
}
```

`PlatformServices` gains:

```ts
readonly backendProvisioning?: BackendProvisioningProvider;
```

- [ ] **Step 1: Write failing provisioning tests**

Test that GamePush SDK is not loaded during Pikabu platform initialization, is loaded only after `backendProvisioning.getAuth()`, waits for `gp.player.ready`, and returns only `_authInfo`, `platform.type`, and `platform.tag` normalized to strings. Test SDK load failure returns `null` and does not alter Pikabu `auth`, `ads`, `ready`, `playerStorage`, or `backendIdentity`.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/gamepush-provisioning.test.ts tests/pikabu-platform.test.ts tests/platform-target.test.ts
```

Expected: FAIL because provisioning provider does not exist.

- [ ] **Step 3: Reuse only the lazy loader shape from the rejected phase-1 patch**

Create a provisioning-only SDK interface:

```ts
interface ProvisioningGamePushSdk {
  readonly player: { readonly ready: Promise<unknown>; readonly _authInfo?: unknown };
  readonly platform: { readonly type?: unknown; readonly tag?: unknown };
}
```

Keep the fallback source list and 15-second timeout from the phase-1 loader. Do not expose `login`, ads, leaderboards, profile writes, lifecycle, or GamePush `player.id` through this helper.

- [ ] **Step 4: Keep Pikabu as the selected platform**

`src/platform/index.ts` must still select `initializePikabuPlatform()` for `VITE_PLATFORM_TARGET=pikabu`. The test must explicitly reject any `initializeGamePushPlatform()` selection.

- [ ] **Step 5: Wire public GamePush config only**

Add to `.env.pikabu.example` and CI:

```env
VITE_GAMEPUSH_PROJECT_ID=30632
VITE_GAMEPUSH_PUBLIC_TOKEN=c5GdZPx08oVCDei4Opc5DJDx68TZDUEb
```

The test must continue to reject `GAMEPUSH_API_SECRET`, `PIKABU_GAME_SECRET`, and `BRIDGE_SESSION_SECRET` in browser env files.

- [ ] **Step 6: Run tests and Pikabu build**

```bash
node --test tests/gamepush-provisioning.test.ts tests/pikabu-platform.test.ts tests/pikabu-build-paths.test.ts tests/platform-target.test.ts
pnpm build:pikabu
```

Expected: PASS; build still initializes Pikabu, not GamePush, as the product platform.

- [ ] **Step 7: Commit**

```bash
git add src/platform/GamePushConfig.ts src/platform/GamePushProvisioning.ts src/platform/services.ts src/platform/pikabu.ts src/vite-env.d.ts .env.pikabu.example .github/workflows/deploy-pikabu.yml tests/gamepush-provisioning.test.ts tests/pikabu-platform.test.ts tests/pikabu-build-paths.test.ts tests/platform-target.test.ts
git commit -m "feat: add hidden GamePush provisioning for Pikabu"
```

---

### Task 4: Add client bridge-session management and authenticated request refresh

**Files:**
- Create: `src/backend/BridgeSessionManager.ts`
- Create: `tests/bridge-session-manager.test.ts`
- Modify: `src/platform/services.ts`
- Modify: `src/backend/BackendClient.ts`
- Modify: `tests/backend-client.test.ts`

**Interfaces:**
- Consumes: `BackendIdentityProvider`, optional `BackendProvisioningProvider`, backend base URL.
- Produces:

```ts
export interface BackendSessionProvider {
  getToken(): Promise<string>;
  invalidate(): void;
}

export class BridgeSessionManager implements BackendSessionProvider {
  constructor(options: {
    baseUrl: string;
    identity: BackendIdentityProvider;
    provisioning?: BackendProvisioningProvider;
    fetchImpl?: typeof fetch;
    nowMs?: () => number;
  });
  getToken(): Promise<string>;
  invalidate(): void;
}
```

- [ ] **Step 1: Write failing session-manager tests**

Cover: guest rejects before network, one `/v1/session` call shared by concurrent requests, cached token reused until within 30 seconds of expiry, `PROVISIONING_REQUIRED` invokes provisioning once then retries session with the provisioning envelope, provisioning unavailable fails without looping, and `invalidate()` forces fresh Pikabu signed data.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/bridge-session-manager.test.ts tests/backend-client.test.ts
```

Expected: FAIL because manager does not exist and `BackendClient` still sends Pikabu signed data directly.

- [ ] **Step 3: Implement `BridgeSessionManager`**

POST body shape:

```ts
{ signedData: assertion.value }
```

or, only after 409 provisioning required:

```ts
{
  signedData: assertion.value,
  provisioning: { playerData, platform, platformKey }
}
```

Cache only `{token, expiresAtMs}` in memory; do not put bridge tokens in localStorage.

Define `BackendSessionProvider` in `src/platform/services.ts` and add `readonly backendSession?: BackendSessionProvider` to `PlatformServices`; Yandex/unavailable services leave it undefined. `BridgeSessionManager` implements that interface.

- [ ] **Step 4: Change `BackendClient` authorization semantics**

`BackendClient` now accepts a `BackendSessionProvider | null`. For `authorized: true`, set `Authorization: Bearer <bridge token>`. On a 401 response, invalidate once, obtain one fresh token, and retry the exact request once. A second 401 surfaces as `BackendHttpError`; no recursive retry.

Public requests with `authorized: false` send no Authorization header and never initialize a session.

- [ ] **Step 5: Run tests**

```bash
node --test tests/bridge-session-manager.test.ts tests/backend-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/backend/BridgeSessionManager.ts src/platform/services.ts src/backend/BackendClient.ts tests/bridge-session-manager.test.ts tests/backend-client.test.ts
git commit -m "feat: manage short-lived bridge sessions"
```

---

### Task 5: Replace profile revision/CAS with GamePush-backed BASE/LOCAL/CLOUD merge

**Files:**
- Modify: `supabase/functions/cascade-api/profile.ts`
- Modify: `supabase/functions/cascade-api/validation.ts`
- Create: `tests/gamepush-profile-contract.test.ts`
- Modify: `src/backend/CloudProfileService.ts`
- Modify: `src/cloud/CloudSyncState.ts`
- Modify: `src/cloud/CloudSyncCoordinator.ts`
- Modify: `tests/cloud-sync-state.test.ts`
- Modify: `tests/cloud-sync-coordinator.test.ts`
- Modify: `tests/backend-client.test.ts`

**Interfaces:**
- New profile transport:

```ts
export type CloudProfileLoad = { readonly profile: CloudSnapshot | null };
export type CloudProfileSaveResult = { readonly profile: CloudSnapshot };
```

- New pending profile state:

```ts
export interface PendingProfileOperation {
  readonly kind: 'profile';
  readonly base: CloudSnapshot | null;
  readonly profile: CloudSnapshot;
}
```

- New HTTP PUT body:

```ts
{ base: CloudSnapshot | null, profile: CloudSnapshot }
```

- [ ] **Step 1: Write failing server profile tests**

Cover empty profile GET, valid read, corrupt `cascadeProfile`, normal BASE/LOCAL/CLOUD merge, one read-back reconciliation race, and second-race final read behavior. The corrupt-profile test must assert `writeCascadeProfile` was never called.

- [ ] **Step 2: Write failing client migration/coordinator tests**

Add a `CloudSyncState` migration test from persisted v1:

```ts
{
  version: 1,
  revision: 9,
  base,
  pendingProfile: { kind:'profile', operationId:uuid, expectedRevision:9, profile },
  pendingLeaderboards: [],
  retryAttempt: 1
}
```

Expected normalized v2:

```ts
{
  version: 2,
  base,
  pendingProfile: { kind:'profile', base, profile },
  pendingLeaderboards: [],
  retryAttempt: 1
}
```

Keep existing in-flight-local-change tests, but assert follow-up pending work uses `{base: savedProfile, profile: reconciledLocal}` rather than a revision.

- [ ] **Step 3: Run profile/sync tests and verify failure**

```bash
node --test tests/gamepush-profile-contract.test.ts tests/cloud-sync-state.test.ts tests/cloud-sync-coordinator.test.ts tests/backend-client.test.ts
```

Expected: FAIL on the old revision contract.

- [ ] **Step 4: Implement server profile GET/PUT using `GamePushBackend`**

GET:

```text
read cascadeProfile string -> null or normalizeCloudSnapshot(JSON.parse(value)) -> { profile }
```

PUT:

```text
normalize base/local
read latest cloud
merged = mergeCloudSnapshots({ base, local, cloud, todayId: server UTC YYYY-MM-DD })
write merged
read back
if readBack != merged:
  reconciled = mergeCloudSnapshots({ base: cloud, local: merged, cloud: readBack, todayId })
  write reconciled
  read one final time
return final normalized profile
```

Never replace malformed remote JSON with local data automatically.

- [ ] **Step 5: Simplify `CloudProfileService`**

`load()` reads `{profile}`. `save(operation)` sends `{base: operation.base, profile: operation.profile}` and returns `{profile}`. Remove all `revision`, `expectedRevision`, 409-conflict handling, and `CloudProfileSaveResult.status` branching.

- [ ] **Step 6: Migrate `CloudSyncState` to version 2**

Keep leaderboard queue fields unchanged. Accept v1 and v2 on read; save only v2. Remove `revision` from the state shape. Preserve retry/backoff timestamps and pending leaderboard operations during migration.

- [ ] **Step 7: Simplify `CloudSyncCoordinator` while preserving local-first behavior**

Normal sync:

```text
load remote
merge(state.base, current local, remote.profile)
apply merged locally
stage { base: remote.profile, profile: merged }
save
accept returned profile as new base
if local changed in flight, stage follow-up { base: returned, profile: reconciled }
```

Pending replay sends its stored `{base, profile}` directly; transport failure keeps it pending.

- [ ] **Step 8: Run profile/sync tests**

```bash
node --test tests/gamepush-profile-contract.test.ts tests/cloud-sync-state.test.ts tests/cloud-sync-coordinator.test.ts tests/cloud-merge.test.ts tests/cloud-snapshot.test.ts tests/backend-client.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/cascade-api/profile.ts supabase/functions/cascade-api/validation.ts src/backend/CloudProfileService.ts src/cloud/CloudSyncState.ts src/cloud/CloudSyncCoordinator.ts tests/gamepush-profile-contract.test.ts tests/cloud-sync-state.test.ts tests/cloud-sync-coordinator.test.ts tests/backend-client.test.ts
git commit -m "refactor: move cloud profile sync to GamePush"
```

---

### Task 6: Wire one shared bridge session into Pikabu gameplay without touching Yandex

**Files:**
- Modify: `src/platform/pikabu.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `tests/pikabu-game-scene-wiring.test.mjs`
- Modify: `tests/auth-profile-merge-wiring.test.ts`
- Modify: `tests/platform-target.test.ts`

**Interfaces:**
- Consumes: `BridgeSessionManager`, existing `BackendIdentityProvider`, optional Pikabu `backendProvisioning`.
- Produces: one `BackendSessionProvider` shared by cloud profile and Pikabu backend leaderboards through `PlatformServices.backendSession`.

- [ ] **Step 1: Write failing wiring tests**

Assert the Pikabu adapter constructs one `BridgeSessionManager` when `VITE_BACKEND_URL` is configured, passes its `backendIdentity` and `backendProvisioning`, exposes it as `platform.backendSession`, and builds `BackendLeaderboards` with that same session. Assert `GameScene` reuses `platform.backendSession` for `CloudProfileService`. Assert Yandex initialization source remains unchanged and does not import `GamePushProvisioning`.

- [ ] **Step 2: Run wiring tests and verify failure**

```bash
node --test tests/pikabu-game-scene-wiring.test.mjs tests/auth-profile-merge-wiring.test.ts tests/platform-target.test.ts
```

- [ ] **Step 3: Create one shared Pikabu backend session inside `createPikabuPlatformServices()`**

When `VITE_BACKEND_URL` is configured, construct exactly once:

```ts
const backendSession = new BridgeSessionManager({
  baseUrl: backendUrl,
  identity: backendIdentity,
  provisioning: backendProvisioning,
});
const backendClient = new BackendClient(backendUrl, backendSession);
```

Use `backendClient` for `BackendLeaderboards` and return `backendSession` on `PlatformServices`. Construction must not perform `/v1/session`; it remains lazy until an authorized backend request actually calls `getToken()`.

- [ ] **Step 4: Reuse the same session for cloud profile sync**

In `GameScene.configureCloudSync()`, require `platform.backendIdentity`, `platform.backendSession`, and a backend URL, then construct `CloudProfileService(new BackendClient(backendUrl, platform.backendSession))`. Do not create a second `BridgeSessionManager`.

- [ ] **Step 5: Run wiring tests and builds**

```bash
node --test tests/pikabu-game-scene-wiring.test.mjs tests/auth-profile-merge-wiring.test.ts tests/platform-target.test.ts tests/pikabu-platform.test.ts
pnpm build
pnpm build:pikabu
```

Expected: PASS for both targets.

- [ ] **Step 6: Commit**

```bash
git add src/platform/pikabu.ts src/game/scenes/GameScene.ts tests/pikabu-game-scene-wiring.test.mjs tests/auth-profile-merge-wiring.test.ts tests/platform-target.test.ts
git commit -m "feat: wire bridge session into Pikabu cloud sync"
```

---

### Task 7: Replace database leaderboards with GamePush leaderboards and preserve all four product modes

**Files:**
- Rewrite: `supabase/functions/cascade-api/leaderboards.ts`
- Create: `tests/gamepush-leaderboard-contract.test.ts`
- Modify: `src/backend/BackendLeaderboards.ts`
- Modify: `tests/backend-leaderboards.test.ts`
- Modify: `tests/backend-leaderboard-contract.test.ts`
- Modify: `tests/leaderboard-competitive-modes.test.ts`
- Modify: `tests/leaderboard-config.test.ts`

**Interfaces:**
- Board mapping:

```ts
const GAMEPUSH_BOARD = {
  standard:     { tag: 'cascadeStandard',    variant: 'global' },
  daily:        { tag: 'cascadeDaily',       variant: 'YYYY-MM-DD from validated scope' },
  'daily-streak': { tag: 'cascadeDailyStreak', variant: 'global' },
  mastery:      { tag: 'cascadeMastery',     variant: 'global' },
} as const;
```

- HTTP surface:

```text
GET  /v1/leaderboards/:board
POST /v1/leaderboards/:board
```

- [ ] **Step 1: Write failing GamePush leaderboard contract tests**

Use a fake `GamePushBackend` and assert:

```text
standard read -> cascadeStandard/global
Daily read(scope=YYYY-MM-DD) -> cascadeDaily/YYYY-MM-DD
Daily streak -> cascadeDailyStreak/global
Mastery -> cascadeMastery/global
```

Public GET works without session. Authenticated GET returns `playerEntry` via `fetchPlayerRating`. POST requires bridge claims.

- [ ] **Step 2: Pin server-side score derivation tests**

Standard uses validated `bestStreak` directly. Daily computes `encodeDailyLeaderboardScore(dailyId,moves,elapsedMs)`. Mastery normalizes `MetaSave` then calls `encodeMasteryLeaderboardScore(profile)`. Daily streak reads the mapped player's current `cascadeProfile`, normalizes it, runs `getDailyStreaks(profile.meta.daily.records, todayId)`, then calls `encodeDailyStreakLeaderboardScore(current,best)`.

Do not accept arbitrary encoded `score` from the browser as authoritative.

- [ ] **Step 3: Implement Daily first-result receipt tests before publication code**

Receipt tag:

```ts
`cascadeDailyFirst:${dailyId}`
```

Receipt value:

```ts
`v1|${pikabuId}|${attemptId ?? '-'}|${moves}|${elapsedMs}|${completedOnTime ? 1 : 0}`
```

Test paths:

```text
no receipt -> create receipt -> publish score
same receipt exists -> publish/retry same score
other receipt exists -> return replay status and do not publish
receipt created, publish throws -> request throws retryable; next identical request republishes
```

- [ ] **Step 4: Run leaderboard tests and verify failure**

```bash
node --test tests/gamepush-leaderboard-contract.test.ts tests/backend-leaderboards.test.ts tests/backend-leaderboard-contract.test.ts tests/leaderboard-competitive-modes.test.ts
```

- [ ] **Step 5: Rewrite server leaderboard handlers around `GamePushBackend`**

Convert GamePush numeric score back to the existing client metric JSON:

```ts
standard      -> { bestStreak: score }
daily         -> decodeDailyLeaderboardScore(score)
daily-streak  -> decodeDailyStreakLeaderboardScore(score)
mastery       -> decodeMasteryLeaderboardScore(score)
```

Reject rows whose score cannot be decoded for the requested board/variant.

- [ ] **Step 6: Change client POST route and preserve local retry queue**

In `BackendLeaderboards`, keep `PendingLeaderboardOperation.operationId` only as a local queue key. POST to `/v1/leaderboards/${board}`. A successful replay/no-op response removes the pending operation. Keep the current rule that 4xx validation failures remove bad pending work while network/5xx errors remain retryable.

- [ ] **Step 7: Run leaderboard tests**

```bash
node --test tests/gamepush-leaderboard-contract.test.ts tests/backend-leaderboards.test.ts tests/backend-leaderboard-contract.test.ts tests/leaderboard-competitive-modes.test.ts tests/leaderboard-service.test.ts tests/leaderboard-submission-queue.test.ts tests/leaderboard-config.test.ts
```

Expected: PASS with Standard, Daily, Daily streak, and Mastery all active.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/cascade-api/leaderboards.ts src/backend/BackendLeaderboards.ts tests/gamepush-leaderboard-contract.test.ts tests/backend-leaderboards.test.ts tests/backend-leaderboard-contract.test.ts tests/leaderboard-competitive-modes.test.ts tests/leaderboard-config.test.ts
git commit -m "feat: move Pikabu leaderboards to GamePush"
```

---

### Task 8: Keep Pikabu ads/lifecycle native and remove accidental GamePush product ownership

**Files:**
- Modify: `src/platform/pikabu.ts`
- Modify: `tests/pikabu-platform.test.ts`
- Modify: `tests/pikabu-game-scene-wiring.test.mjs`
- Delete if present from the working branch: `src/platform/gamepush.ts`
- Delete if present from the working branch: `src/platform/GamePushLeaderboards.ts`
- Delete if present from the working branch: `tests/gamepush-platform.test.ts`
- Delete if present from the working branch: `tests/gamepush-leaderboards.test.ts`

**Interfaces:**
- Pikabu remains owner of `auth`, `ready`, pause/lifecycle, fullscreen/rewarded ads through `sdk.ads.fullscreen` / `sdk.ads.rewarded`.
- GamePush helper exposes provisioning auth only.

- [ ] **Step 1: Add source-level regression tests**

Assert Pikabu adapter source contains `sdk.auth.openAuthDialog`, `sdk.player.getSignedData`, and `sdk.gameStarted`, and does not contain `gp.player.login`, `gp.player.set`, `gp.player.sync`, `gp.leaderboard`, or `gp.ads`.

- [ ] **Step 2: Add/finish native Pikabu ad typing and tests**

Extend `PikabuSdk` with the documented Pikabu ad surface:

```ts
type PikabuAdResult = { rendered: true } | { rendered: false; reason: string };
type PikabuRewardedResult = PikabuAdResult & { reward: boolean };
interface PikabuAdApi { readonly isSupported: boolean; canShow(): Promise<boolean>; show(): Promise<PikabuAdResult>; }
interface PikabuRewardedAdApi { readonly isSupported: boolean; canShow(): Promise<boolean>; show(): Promise<PikabuRewardedResult>; }
interface PikabuAdsApi { readonly fullscreen: PikabuAdApi; readonly rewarded: PikabuRewardedAdApi; }
```

For `PlatformAds.showInterstitial()`, require `isSupported && await canShow()`, set the shared platform pause before `show()`, clear it in `finally`, and return `result.rendered === true`. Test unavailable/error paths return `false`. Do not call GamePush ads.

- [ ] **Step 3: Run platform tests**

```bash
node --test tests/pikabu-platform.test.ts tests/pikabu-game-scene-wiring.test.mjs tests/platform-target.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A src/platform tests/pikabu-platform.test.ts tests/pikabu-game-scene-wiring.test.mjs tests/platform-target.test.ts
git commit -m "refactor: keep Pikabu as product platform"
```

---

### Task 9: Remove Postgres backend runtime and DB-only tests/configuration

**Files:**
- Delete: `supabase/functions/cascade-api/db.ts`
- Delete: `supabase/migrations/20260920000100_cascade_backend.sql`
- Delete: `supabase/migrations/20260921000100_service_role_rpc_grants.sql`
- Delete: `supabase/tests/cascade_backend.sql`
- Delete: `tests/backend-service-role-rpc-grants.test.mjs`
- Modify: `package.json`
- Modify: `docs/PIKABU_BACKEND_SETUP.md`
- Modify: `.env.pikabu.example`
- Modify: `tests/backend-validation.test.ts`

**Interfaces:**
- Supabase remains only an Edge Function runtime; no runtime code imports a DB client or service-role Postgres endpoint.

- [ ] **Step 1: Add a no-DB production-path regression test**

Create/extend a source contract test that scans `supabase/functions/cascade-api` and fails on:

```text
BackendDb
/rest/v1/
/rpc/
SUPABASE_SERVICE_ROLE_KEY
expectedRevision
cascade_profiles
cascade_leaderboard
```

- [ ] **Step 2: Run the regression test and verify it fails on the old DB files**

```bash
node --test tests/backend-validation.test.ts
```

- [ ] **Step 3: Delete DB implementation/migrations/tests and remove DB CLI scripts that no longer describe the product**

Remove `backend:test:db`, `supabase:test`, and any documentation that instructs creating Cascade Postgres tables. Keep `supabase functions serve cascade-api --no-verify-jwt` if still useful for local Edge Function development.

- [ ] **Step 4: Rewrite backend setup docs around four secrets**

Document only:

```env
PIKABU_GAME_SECRET=...
GAMEPUSH_API_SECRET=...
GAMEPUSH_PROJECT_ID=30632
BRIDGE_SESSION_SECRET=...
CASCADE_ALLOWED_ORIGINS=...
```

Also document GamePush field `cascadeProfile` and four leaderboard tags.

- [ ] **Step 5: Run DB-removal regression test**

```bash
node --test tests/backend-validation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A supabase package.json docs/PIKABU_BACKEND_SETUP.md .env.pikabu.example tests/backend-validation.test.ts tests/backend-service-role-rpc-grants.test.mjs
git commit -m "chore: remove Cascade Postgres backend"
```

---

### Task 10: Add live GamePush contract smoke tests and release gates

**Files:**
- Create: `scripts/gamepush-smoke.mjs`
- Create: `docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md`
- Modify: `package.json`

**Interfaces:**
- Consumes server-only env vars; never runs in browser or normal CI without secrets.
- Produces npm script `gamepush:smoke`.

- [ ] **Step 1: Implement a guarded smoke-test script**

The script must refuse to run unless:

```text
GAMEPUSH_API_SECRET
GAMEPUSH_PROJECT_ID=30632
GAMEPUSH_SMOKE_PLAYER_ID
```

are set. It must use a dedicated test player and test tags/variants, never production Daily identity values.

- [ ] **Step 2: Add the release-blocking checks from the spec**

The smoke test must verify:

```text
Find/read mapped player works
cascadeProfile round-trip works and restores original value afterward
FetchUniqueValues returns expected ownerId
second CreateUniqueValue for same owner+tag does not silently replace existing receipt
cascadeStandard publish/fetch works
cascadeDaily publish/fetch works on a smoke-only variant
cascadeDailyStreak publish/fetch works
cascadeMastery publish/fetch works
leaderboard rows expose mirrored verified identity fields
```

Every mutation must restore or delete smoke-only state in `finally` where the API allows it.

- [ ] **Step 3: Add package script**

```json
"gamepush:smoke": "node scripts/gamepush-smoke.mjs"
```

- [ ] **Step 4: Run unit/build suite before the live smoke test**

```bash
pnpm test
pnpm build
pnpm build:pikabu
```

Expected: all PASS.

- [ ] **Step 5: Run live smoke test with secrets locally**

```bash
pnpm gamepush:smoke
```

Expected: PASS for mapping, profile, first-receipt immutability, and all four leaderboard tags. If duplicate Unique Value creation replaces instead of conflicts, stop release and disable Daily submission rather than changing product semantics.

- [ ] **Step 6: Commit**

```bash
git add scripts/gamepush-smoke.mjs docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md package.json
git commit -m "test: add GamePush release smoke checks"
```

---

### Task 11: Full regression, packaging, and manual Pikabu acceptance

**Files:**
- Modify only if failures reveal a scoped regression in files already touched above.
- Update: `CURRENT_STATE.md`
- Update: `PATCH_NOTES.md`

**Interfaces:**
- Produces a releasable Pikabu build with Yandex regression coverage intact.

- [ ] **Step 1: Run the complete automated suite**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Build both targets**

```bash
pnpm build
pnpm build:pikabu
```

Expected: PASS; neither bundle contains `GAMEPUSH_API_SECRET`, `PIKABU_GAME_SECRET`, or `BRIDGE_SESSION_SECRET`.

- [ ] **Step 3: Inspect the Pikabu production bundle for forbidden backend secrets/login UX**

Run:

```bash
rg -n "GAMEPUSH_API_SECRET|PIKABU_GAME_SECRET|BRIDGE_SESSION_SECRET|gp\.player\.login|secretCode" dist
```

Expected: no matches.

- [ ] **Step 4: Manual local-first/outage acceptance**

Verify guest can start/save/play with bridge unreachable; authorized player can keep playing when GamePush is unreachable; pending profile/leaderboard work retries on the next safe trigger.

- [ ] **Step 5: Manual cross-device/account acceptance**

Verify first Pikabu login provisions once, second browser resolves the same GamePush owner through `pikabuId`, profile converges, and no GamePush login UI is ever shown.

- [ ] **Step 6: Manual leaderboard acceptance**

Verify Standard, Daily, Daily streak, Mastery; Daily first result appears, repeat cannot improve it, and name/avatar come from Pikabu identity.

- [ ] **Step 7: Update project state notes**

Record that Supabase is function runtime only, GamePush is persistence/leaderboards, Pikabu is identity/platform UX, and Yandex path is unchanged.

- [ ] **Step 8: Commit final verification notes**

```bash
git add CURRENT_STATE.md PATCH_NOTES.md
git commit -m "docs: record Pikabu GamePush backend rollout"
```
