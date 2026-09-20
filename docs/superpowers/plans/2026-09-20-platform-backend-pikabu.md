# Cascade Platform Backend + Pikabu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-independent Supabase-backed cloud/save and leaderboard path for Pikabu while keeping Yandex storage and Yandex leaderboards behaviorally unchanged.

**Architecture:** Keep the current `PlatformServices` boundary and add only the capabilities needed for backend identity, scoped leaderboard reads, and structured leaderboard submissions. Pikabu remains local-first: browser storage is always written first, then `CloudSyncCoordinator` performs BASE/LOCAL/CLOUD three-way merge against a revisioned Supabase profile; Yandex never enters that path in phase 1. Supabase Edge Functions verify Pikabu HS256 signed player data, own all service-role access, and expose a small versioned HTTP API over Postgres.

**Tech Stack:** TypeScript 5.9, Phaser 4.2, Vite 7, Node 22 built-in test runner, Pikabu Games SDK, Supabase Postgres + Edge Functions, Supabase CLI, Deno/Web APIs inside Edge Functions.

**Spec:** `docs/superpowers/specs/2026-09-20-platform-backend-pikabu-design.md`

## Global Constraints

- Target branch is `feat/platform-backend` from a clean checkpoint containing the latest Cascade fixes.
- Yandex `getData/setData`, Yandex leaderboard technical names, score encoding, auth flow, ad flow, and lifecycle behavior remain unchanged in phase 1.
- `META_SAVE_VERSION` stays `9`; cloud transport state must not be added to `MetaSave`.
- Cloud snapshot transport version starts at `1` and wraps normalized `MetaSave` plus an optional active-game checkpoint timestamp.
- Pikabu is guest-first/local-first: Standard, Daily, Mastery, local save, and active-game resume work with no backend and no authorization.
- Guest leaderboard reads are allowed when the backend is reachable; leaderboard writes and cloud profile sync require a verified authorized Pikabu identity.
- Pikabu identity writes are authorized only by server-verified `sdk.player.getSignedData()`; never trust client-supplied account/player IDs.
- Backend JWT verification accepts only `HS256` and requires `isAuthorized === true` for account-scoped writes.
- `PIKABU_GAME_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` never appear in `VITE_*`, `dist/`, logs, source-controlled env files, or browser-visible responses.
- Browser writes local state before attempting any network request; backend failure never blocks game startup or local save.
- Ongoing sync is BASE/LOCAL/CLOUD with CAS revisions; repeated sync of the same states must be idempotent and must not inflate counters.
- First official Daily ranking result is immutable per `(account_id, daily_id)`; offline first results remain pending and later replays must not replace them.
- Daily streak is derived from accepted Daily history; Mastery phase 1 derives lifetime points but is not claimed to be fully server-authoritative against a modified client.
- No realtime, WebSocket, purchases, Pikabu ads, VPS, full move-log anti-cheat, or Yandex-to-backend migration in this plan.
- Static hosting stays replaceable; GitVerse Pages Free remains only the current candidate and commercial-use confirmation is a release gate, not an implementation dependency.
- Existing client leaderboard cache remains 60 seconds; backend integration must not remove it.
- Verification baseline is `pnpm test` and `pnpm build`; backend DB tests additionally use `pnpm exec supabase test db` when Docker/local Supabase is available.

## Review Focus

1. **Pikabu player ID changes after guest authorization:** local gameplay must remain intact, cloud state must be keyed to the newly authorized identity, and no guest profile may be silently discarded. Covered in Tasks 9 and 12.
2. **Network response is lost after a successful mutation:** replay must use the same `operationId` and return the original result without double-applying profile/Daily/leaderboard mutations. Covered in Tasks 4, 6, 7, and 10.
3. **Two devices update the same profile from the same BASE:** a 409 must trigger bounded refetch/remerge/retry and converge without counter inflation or data loss. Covered in Tasks 3 and 10.
4. **Corrupted/oversized local or HTTP payloads:** invalid sync state must reset safely, invalid cloud profile must be rejected/normalized, and bodies over 256 KiB must receive 413 without entering DB logic. Covered in Tasks 2, 4, and 6.
5. **Pikabu/Supabase unavailable or misconfigured:** Pikabu build must fall back to local gameplay, Yandex must remain unaffected, leaderboard UI may show unavailable/stale data, and no startup crash is allowed. Covered in Tasks 1, 8, 9, 12, and 13.

---

## File Map

### Create

- `src/platform/index.ts` — platform-target selection; default target remains the existing Yandex path.
- `src/platform/pikabu.ts` — Pikabu SDK loading/init/auth/lifecycle and backend identity assertion.
- `src/backend/BackendClient.ts` — small fetch wrapper with auth assertion, CORS-safe headers, timeout/error parsing.
- `src/backend/CloudProfileService.ts` — revisioned profile GET/PUT client contract.
- `src/backend/BackendLeaderboards.ts` — `PlatformLeaderboards` adapter over backend HTTP API with persistent mutation retry.
- `src/cloud/CloudSnapshot.ts` — cloud snapshot types/normalization and local snapshot capture/apply helpers.
- `src/cloud/CloudMerge.ts` — pure first-link and BASE/LOCAL/CLOUD semantic merge functions.
- `src/cloud/CloudSyncState.ts` — per-authorized-identity local sync state and pending-operation persistence.
- `src/cloud/CloudSyncCoordinator.ts` — local-first sync orchestration, CAS conflict retry, backoff, online triggers.
- `tests/cloud-snapshot.test.ts` — cloud snapshot normalization and active checkpoint tests.
- `tests/cloud-merge.test.ts` — first-link/three-way/idempotence/multi-device merge tests.
- `tests/cloud-sync-state.test.ts` — corrupt storage, identity separation, pending operation durability tests.
- `tests/backend-client.test.ts` — request/auth/error/timeout client tests.
- `tests/cloud-sync-coordinator.test.ts` — first auth, CAS conflict, offline, lost-response/idempotent replay tests.
- `tests/pikabu-platform.test.ts` — Pikabu SDK adapter/auth/ready/identity tests.
- `tests/backend-leaderboards.test.ts` — public reads, scoped Daily reads, structured submissions, persistent retry tests.
- `tests/platform-target.test.ts` — Yandex default and explicit Pikabu target wiring.
- `tests/pikabu-game-scene-wiring.test.mjs` — source-level GameScene assertions for local-first authorization/sync hooks.
- `supabase/config.toml` — local Edge Function config with Supabase JWT verification disabled for Pikabu-signed/public routes.
- `supabase/migrations/20260920000100_cascade_backend.sql` — schema, indexes, RLS, atomic RPC functions.
- `supabase/tests/cascade_backend.sql` — pgTAP tests for CAS, idempotency, Daily uniqueness, ordering.
- `supabase/functions/cascade-api/index.ts` — Edge Function entry/router.
- `supabase/functions/cascade-api/auth.ts` — HS256 verification + normalized verified player payload.
- `supabase/functions/cascade-api/http.ts` — CORS, body-size, JSON/error response helpers, best-effort rate limiter.
- `supabase/functions/cascade-api/profile.ts` — profile GET/PUT handlers.
- `supabase/functions/cascade-api/leaderboards.ts` — leaderboard GET/submit handlers.
- `supabase/functions/cascade-api/db.ts` — narrow repository wrapper around Supabase service client/RPCs.
- `supabase/functions/cascade-api/validation.ts` — route/body/date/range/board validation.
- `tests/pikabu-signed-data.test.ts` — server auth verifier tests using real HS256 fixtures.
- `tests/backend-validation.test.ts` — pure request/body/board validation tests.
- `docs/PIKABU_BACKEND_SETUP.md` — local/prod Supabase, env, deploy, smoke-test instructions.
- `docs/PIKABU_HOSTING.md` — static build/publish contract and GitVerse commercial-use gate.
- `.env.pikabu.example` — public frontend config names only.

### Modify

- `src/platform/services.ts` — add optional backend identity capability, authorization storage-scope flag, scoped leaderboard reads, structured submission context.
- `src/platform/yandex.ts` — keep behavior; only satisfy additive platform interface fields/options.
- `src/game/scenes/GameScene.ts` — import target-neutral initializer, instantiate sync coordinator for backend-capable platform, trigger sync at safe boundaries, avoid old one-time profile transfer on Pikabu auth.
- `src/persistence/ActiveGameRepository.ts` — maintain a separate local timestamp for cloud checkpoint comparison while preserving the existing active-game save format/key.
- `src/leaderboards/LeaderboardService.ts` — pass scope/context to platform adapter while preserving Yandex score encoding and 60-second cache.
- `src/leaderboards/LeaderboardSubmissionQueue.ts` — carry optional structured submission context through coalesced writes without changing Yandex timing semantics.
- `src/vite-env.d.ts` — type public frontend env variables.
- `package.json` / `pnpm-lock.yaml` — add Supabase CLI dev tool and Pikabu build/test scripts; no new browser runtime dependency.
- `.gitignore` — ignore local Pikabu/Supabase secrets/env files.
- `CURRENT_STATE.md` — record Pikabu backend status and remaining production gates.
- `TECH.md` — record platform selection, cloud merge invariants, backend boundary.

---

### Task 1: Add a Target-Neutral Platform Bootstrap and Backend Identity Capability

**Files:**
- Create: `src/platform/index.ts`
- Create: `tests/platform-target.test.ts`
- Modify: `src/platform/services.ts`
- Modify: `src/platform/yandex.ts`
- Modify: `src/game/scenes/GameScene.ts:39,213`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Consumes: current `createUnavailablePlatformServices()` and `initializePlatform()` from `src/platform/yandex.ts`.
- Produces:

```ts
export interface PlatformIdentityAssertion {
  readonly provider: string;
  readonly value: string;
}

export interface BackendIdentityProvider {
  isAuthorized(): boolean;
  getAssertion(): Promise<PlatformIdentityAssertion | null>;
  localIdentityKey(): string | null;
}

export interface PlatformAuth {
  readonly playerStorageScopeChangesOnAuthorization?: boolean;
  isAuthorized(): boolean;
  requestAuthorization(): Promise<boolean>;
  onAccountSelectionClosed(listener: () => void): () => void;
}

export interface PlatformLeaderboardReadOptions {
  readonly quantityTop: number;
  readonly scopeKey?: string;
}

export type PlatformLeaderboardSubmissionContext =
  | { readonly kind: 'standard'; readonly bestStreak: number }
  | { readonly kind: 'daily'; readonly dailyId: string; readonly moves: number; readonly elapsedMs: number; readonly completedOnTime: boolean; readonly attemptId?: string }
  | { readonly kind: 'streak'; readonly todayId?: string }
  | { readonly kind: 'mastery'; readonly profile: unknown };
```

`PlatformServices` gains optional `backendIdentity?: BackendIdentityProvider`. `PlatformLeaderboards.getEntries()` uses `PlatformLeaderboardReadOptions`; `getPlayerEntry()` gains an optional `{ scopeKey?: string }`; `setScore()` gains an optional `PlatformLeaderboardSubmissionContext`. Yandex ignores the optional scope/context and sets `playerStorageScopeChangesOnAuthorization: true`.

- [ ] **Step 1: Write RED target/interface tests**

Create `tests/platform-target.test.ts` with source/runtime checks:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const services = readFileSync('src/platform/services.ts', 'utf8');
const selector = readFileSync('src/platform/index.ts', 'utf8');
const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

test('platform services expose optional backend identity without replacing player storage', () => {
  assert.match(services, /backendIdentity\?: BackendIdentityProvider/);
  assert.match(services, /playerStorageScopeChangesOnAuthorization\?: boolean/);
});

test('GameScene imports platform initialization from the target-neutral platform module', () => {
  assert.match(scene, /from '\.\.\/\.\.\/platform\/index\.ts'/);
  assert.doesNotMatch(scene, /from '\.\.\/\.\.\/platform\/yandex\.ts'/);
});

test('undefined platform target preserves the Yandex initializer as the default path', () => {
  assert.match(selector, /VITE_PLATFORM_TARGET/);
  assert.match(selector, /initializeYandexPlatform/);
  assert.match(selector, /target === 'pikabu'/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tests/platform-target.test.ts tests/platform-services.test.ts
```

Expected: target test fails because `src/platform/index.ts` and new interfaces do not exist; existing Yandex tests remain green.

- [ ] **Step 3: Extend `services.ts` additively**

Add the interfaces above and extend `PlatformServices`:

```ts
export interface PlatformServices {
  readonly language?: string;
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly ads: PlatformAds;
  readonly platformPause: PlatformPause;
  readonly gameplay: GameplayMarkup;
  readonly backendIdentity?: BackendIdentityProvider;
  readonly ready: () => void;
}
```

Update fallback implementations so all optional leaderboard arguments are accepted and ignored.

- [ ] **Step 4: Preserve Yandex behavior under the additive interface**

In `createYandexPlatformServices()` set:

```ts
auth: {
  playerStorageScopeChangesOnAuthorization: true,
  // existing methods unchanged
}
```

Keep all Yandex leaderboard SDK calls and technical names exactly as today; accept but ignore `scopeKey`/structured context.

- [ ] **Step 5: Add target-neutral selector**

Create `src/platform/index.ts`:

```ts
import type { PlatformServices } from './services.ts';
import { initializePlatform as initializeYandexPlatform } from './yandex.ts';
import { initializePikabuPlatform } from './pikabu.ts';

let selectedPlatform: Promise<PlatformServices> | null = null;

export function initializePlatform(): Promise<PlatformServices> {
  if (selectedPlatform !== null) return selectedPlatform;
  const target = import.meta.env.VITE_PLATFORM_TARGET?.trim().toLowerCase();
  selectedPlatform = target === 'pikabu'
    ? initializePikabuPlatform()
    : initializeYandexPlatform();
  return selectedPlatform;
}
```

For this task, create `src/platform/pikabu.ts` as a compile-safe stub returning `createUnavailablePlatformServices()`; Task 9 replaces the stub with the real SDK adapter.

- [ ] **Step 6: Type env variables and switch GameScene import**

Add to `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_PLATFORM_TARGET?: 'yandex' | 'pikabu';
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Change only the `GameScene` initializer import to `../../platform/index.ts`.

- [ ] **Step 7: Verify Task 1**

Run:

```bash
node --test tests/platform-target.test.ts tests/platform-services.test.ts
pnpm build
```

Expected: PASS; default build still takes the Yandex initializer path.

- [ ] **Step 8: Commit**

```bash
git add src/platform/index.ts src/platform/pikabu.ts src/platform/services.ts src/platform/yandex.ts src/game/scenes/GameScene.ts src/vite-env.d.ts tests/platform-target.test.ts tests/platform-services.test.ts
git commit -m "refactor: add platform target boundary"
```

---

### Task 2: Define Cloud Snapshot Normalization and Timestamp Active-Game Checkpoints

**Files:**
- Create: `src/cloud/CloudSnapshot.ts`
- Create: `tests/cloud-snapshot.test.ts`
- Modify: `src/persistence/ActiveGameRepository.ts`
- Modify: `tests/active-game-save.test.ts`

**Interfaces:**
- Consumes: `normalizeMetaSave()`, `normalizeActiveGameSave()`.
- Produces:

```ts
export const CLOUD_SNAPSHOT_VERSION = 1 as const;

export interface CloudActiveGameCheckpoint {
  readonly save: ActiveGameSaveV2;
  readonly updatedAtMs: number;
}

export interface CloudSnapshot {
  readonly schemaVersion: typeof CLOUD_SNAPSHOT_VERSION;
  readonly meta: MetaSave;
  readonly activeGame?: CloudActiveGameCheckpoint;
}

export function normalizeCloudSnapshot(raw: unknown): CloudSnapshot | null;

export interface StoredActiveGameCheckpoint {
  readonly save: ActiveGameSaveV2;
  readonly updatedAtMs: number;
}

ActiveGameRepository.loadCheckpoint(): StoredActiveGameCheckpoint | null;
```

The existing `cascadeActiveGame` JSON remains exactly `ActiveGameSaveV2`. Add a second key `cascadeActiveGameUpdatedAtMs`; `save()` updates both keys, `clear()` removes both, and legacy saves without a timestamp normalize to `updatedAtMs: 0`.

- [ ] **Step 1: Write RED snapshot/repository tests**

Add cases proving:

```ts
test('cloud snapshot normalizes MetaSave and a valid active game checkpoint', () => { /* valid snapshot -> schemaVersion 1 */ });
test('cloud snapshot rejects invalid schema or invalid active save', () => { /* null */ });
test('active repository stores timestamp separately from the existing save payload', () => { /* cascadeActiveGame remains raw v2 */ });
test('legacy active save without timestamp loads with updatedAtMs zero', () => { /* backward compatible */ });
test('clear removes save and timestamp keys together', () => { /* both null */ });
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/cloud-snapshot.test.ts tests/active-game-save.test.ts
```

Expected: FAIL on missing cloud module/checkpoint API.

- [ ] **Step 3: Implement `CloudSnapshot.ts`**

Use strict envelope validation:

```ts
export function normalizeCloudSnapshot(raw: unknown): CloudSnapshot | null {
  if (!isRecord(raw) || raw.schemaVersion !== CLOUD_SNAPSHOT_VERSION) return null;
  const meta = normalizeMetaSave(raw.meta);
  if (raw.activeGame === undefined) return { schemaVersion: 1, meta };
  if (!isRecord(raw.activeGame)) return null;
  const save = normalizeActiveGameSave(raw.activeGame.save);
  const updatedAtMs = raw.activeGame.updatedAtMs;
  if (save === null || !Number.isSafeInteger(updatedAtMs) || (updatedAtMs as number) < 0) return null;
  return { schemaVersion: 1, meta, activeGame: { save, updatedAtMs: updatedAtMs as number } };
}
```

- [ ] **Step 4: Add timestamp companion persistence**

Use `Date.now()` by default in `save(save, updatedAtMs = Date.now())`; reject non-finite/negative timestamps by falling back to `Date.now()`. Keep `load()` behavior unchanged and implement `loadCheckpoint()` using the same normalized save plus timestamp companion key.

- [ ] **Step 5: Verify Task 2**

```bash
node --test tests/cloud-snapshot.test.ts tests/active-game-save.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/cloud/CloudSnapshot.ts src/persistence/ActiveGameRepository.ts tests/cloud-snapshot.test.ts tests/active-game-save.test.ts
git commit -m "feat: add cloud snapshot model"
```

---

### Task 3: Implement Deterministic First-Link and Three-Way Cloud Merge

**Files:**
- Create: `src/cloud/CloudMerge.ts`
- Create: `tests/cloud-merge.test.ts`

**Interfaces:**
- Consumes: normalized `CloudSnapshot`, `MetaSave`, `getDailyStreaks()` where a recomputation needs a `todayId` supplied by the caller.
- Produces:

```ts
export interface CloudMergeInput {
  readonly base: CloudSnapshot | null;
  readonly local: CloudSnapshot;
  readonly cloud: CloudSnapshot | null;
  readonly todayId: string;
}

export function mergeCloudSnapshots(input: CloudMergeInput): CloudSnapshot;
```

Rules implemented in one pure module:

```ts
const mergeCounter = (base: number, local: number, cloud: number, max: number): number =>
  Math.min(max, cloud + Math.max(0, local - base));

const minPositive = (a?: number, b?: number): number | undefined =>
  a === undefined ? b : b === undefined ? a : Math.min(a, b);
```

First link (`base === null`) uses semantic union/max/min rules but does **not** add two absolute counters blindly when the same history can be represented by both profiles. Completed seed/date sets are authoritative facts; derived win/mastery facts are recalculated from merged fact sets where possible. Ongoing sync (`base !== null`) uses BASE-relative deltas only for monotonic counters such as stats/attempt counts.

- [ ] **Step 1: Write RED merge matrix**

`tests/cloud-merge.test.ts` must include at least these concrete cases:

```ts
test('replaying identical BASE LOCAL CLOUD does not inflate counters', () => {});
test('two devices adding three and two wins from base twenty converge to twenty five', () => {});
test('completed Standard seeds and mastery credited seeds are set unions', () => {});
test('Daily records union dates and keep lower best time', () => {});
test('Daily ranking pair uses lower moves then lower time for personal best fields without replacing cloud official attempt identity', () => {});
test('Daily attempts use base-relative delta after the first synchronized base', () => {});
test('weekly same-week ids and milestones union while newer week wins the active shell', () => {});
test('current Daily streak is recomputed from merged on-time history for supplied todayId', () => {});
test('active game chooses greater updatedAtMs and validates checkpoint', () => {});
test('language and sound never appear because they are outside CloudSnapshot', () => {});
```

Include an explicit idempotence assertion:

```ts
const once = mergeCloudSnapshots({ base, local, cloud, todayId });
const twice = mergeCloudSnapshots({ base: once, local: once, cloud: once, todayId });
assert.deepEqual(twice, once);
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/cloud-merge.test.ts
```

Expected: FAIL because merge module does not exist.

- [ ] **Step 3: Implement fact-set and best-value helpers**

Implement small pure helpers inside `CloudMerge.ts`: `unionStrings`, `mergeBestTime`, `mergeDailyRecord`, `mergeWeekly`, `mergeModeStats`, `mergeActiveGame`, `mergeMasteryProgress`. Keep every helper deterministic and finish by `normalizeMetaSave()` / `normalizeCloudSnapshot()`.

- [ ] **Step 4: Implement first-link merge separately from ongoing merge**

Do not hide the distinction in conditionals spread across helpers:

```ts
function firstLinkMerge(local: CloudSnapshot, cloud: CloudSnapshot, todayId: string): CloudSnapshot;
function threeWayMerge(base: CloudSnapshot, local: CloudSnapshot, cloud: CloudSnapshot, todayId: string): CloudSnapshot;
```

`mergeCloudSnapshots()` dispatches to one of these, and returns normalized LOCAL unchanged when CLOUD is null.

- [ ] **Step 5: Verify Task 3**

```bash
node --test tests/cloud-merge.test.ts
pnpm build
```

Expected: all merge tests PASS, especially the two-device 20 + 3 + 2 = 25 and repeated-sync idempotence tests.

- [ ] **Step 6: Commit**

```bash
git add src/cloud/CloudMerge.ts tests/cloud-merge.test.ts
git commit -m "feat: add three-way cloud merge"
```

---

### Task 4: Persist Per-Identity BASE/Revision and Idempotent Pending Mutations

**Files:**
- Create: `src/cloud/CloudSyncState.ts`
- Create: `tests/cloud-sync-state.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PendingProfileOperation {
  readonly kind: 'profile';
  readonly operationId: string;
  readonly expectedRevision: number;
  readonly profile: CloudSnapshot;
}

export interface PendingLeaderboardOperation {
  readonly kind: 'leaderboard';
  readonly operationId: string;
  readonly technicalName: string;
  readonly score: number;
  readonly context?: PlatformLeaderboardSubmissionContext;
}

export interface CloudSyncState {
  readonly version: 1;
  readonly revision: number;
  readonly base: CloudSnapshot | null;
  readonly pendingProfile: PendingProfileOperation | null;
  readonly pendingLeaderboards: readonly PendingLeaderboardOperation[];
  readonly lastSuccessfulSyncAtMs?: number;
  readonly retryAttempt: number;
  readonly nextRetryAtMs?: number;
}

export class CloudSyncStateStore {
  constructor(provider: string, localIdentityKey: string, storage?: BrowserStorageLike | null);
  load(): CloudSyncState;
  save(state: CloudSyncState): void;
  clear(): void;
}
```

Storage key is exactly `cascadeCloudSyncState:v1:<provider>:<encoded-localIdentityKey>`. The `localIdentityKey` is a client-only namespace hint and is never sent as proof of identity to the backend.

- [ ] **Step 1: Write RED durability/isolation tests**

Cover:

```ts
test('two Pikabu identity keys never share BASE or pending operations', () => {});
test('corrupt JSON resets to the default sync state without throwing', () => {});
test('invalid revision or invalid cloud snapshot resets safely', () => {});
test('pending profile operation survives reload with the same operationId and body', () => {});
test('pending leaderboard operation survives reload and preserves operationId', () => {});
test('queue is bounded to 64 leaderboard mutations and keeps newest unique operation IDs', () => {});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/cloud-sync-state.test.ts
```

- [ ] **Step 3: Implement strict normalization and bounded persistence**

Use a default state:

```ts
const DEFAULT_STATE: CloudSyncState = {
  version: 1,
  revision: 0,
  base: null,
  pendingProfile: null,
  pendingLeaderboards: [],
  retryAttempt: 0,
};
```

Normalize pending operations, accept only UUID-format `operationId`, finite safe numeric fields, and recognized structured contexts. Catch all storage exceptions and keep an in-memory copy for the page lifetime.

- [ ] **Step 4: Verify Task 4**

```bash
node --test tests/cloud-sync-state.test.ts
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/cloud/CloudSyncState.ts tests/cloud-sync-state.test.ts
git commit -m "feat: persist cloud sync state"
```

---

### Task 5: Create Supabase Schema, RLS, Indexes, and Atomic Database Functions

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260920000100_cascade_backend.sql`
- Create: `supabase/tests/cascade_backend.sql`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: account UUID resolved by Edge Function from verified Pikabu identity.
- Produces atomic SQL functions:

```sql
cascade_resolve_account(p_provider text, p_provider_user_id text, p_public_name text, p_avatar_url text) returns uuid
cascade_put_profile(p_account_id uuid, p_operation_id uuid, p_expected_revision bigint, p_schema_version integer, p_profile jsonb) returns jsonb
cascade_submit_daily_result(p_account_id uuid, p_operation_id uuid, p_daily_id date, p_attempt_id text, p_moves integer, p_elapsed_ms bigint, p_completed_on_time boolean) returns jsonb
cascade_upsert_leaderboard_entry(p_account_id uuid, p_operation_id uuid, p_board_key text, p_scope_key text, p_primary_value bigint, p_secondary_value bigint, p_context jsonb) returns jsonb
```

All four mutation functions are transaction-atomic and consult `idempotency_operations` before applying a duplicate `operationId`.

- [ ] **Step 1: Add Supabase CLI and initialize config**

Run:

```bash
pnpm add -D supabase
pnpm exec supabase init
```

Set in `supabase/config.toml`:

```toml
[functions.cascade-api]
verify_jwt = false
```

This is required because the function accepts public leaderboard GETs and Pikabu HS256 tokens, not Supabase Auth JWTs.

- [ ] **Step 2: Write RED pgTAP tests before migration implementation**

`supabase/tests/cascade_backend.sql` must assert:

- resolving the same `(provider, provider_user_id)` twice returns one account;
- profile revision starts at 1 on create and increments exactly once on CAS success;
- stale expected revision returns conflict data without updating profile;
- repeating one profile `operation_id` returns the original result and does not increment revision;
- first Daily result inserts; second date-identical result for same account does not replace moves/time;
- repeated Daily `operation_id` returns original result;
- Standard entry only increases;
- service-role path can access tables while anon has no direct table policy.

- [ ] **Step 3: Run RED DB tests**

Run when local Docker/Supabase is available:

```bash
pnpm exec supabase start
pnpm exec supabase test db
```

Expected: FAIL because migration/functions do not exist. If Docker is unavailable in the execution environment, record that constraint and continue only after static SQL review; do not claim DB tests passed.

- [ ] **Step 4: Implement schema exactly from the approved spec**

Create tables `accounts`, `identities`, `cloud_profiles`, `daily_results`, `leaderboard_entries`, `idempotency_operations`; use `gen_random_uuid()` defaults and `now()` timestamps. Add:

```sql
create unique index identities_provider_user_uidx on public.identities(provider, provider_user_id);
create index daily_results_rank_idx on public.daily_results(daily_id, moves, elapsed_ms, completed_at);
create index leaderboard_entries_rank_idx on public.leaderboard_entries(board_key, scope_key, primary_value desc, secondary_value asc nulls last, updated_at asc);
```

Enable RLS on all six tables and create **no anon/authenticated policies** in phase 1; Edge Function service-role access is the only data path.

- [ ] **Step 5: Implement idempotent SQL functions**

Each function starts with an `idempotency_operations` lookup for `(account_id, operation_id)` and returns stored `result` when found. `cascade_put_profile` returns JSON shaped as either:

```json
{"status":"saved","revision":19,"profile":{}}
```

or:

```json
{"status":"conflict","revision":19,"profile":{}}
```

`cascade_submit_daily_result` uses `ON CONFLICT (account_id, daily_id) DO NOTHING` and returns the existing first official row if already present.

- [ ] **Step 6: Verify Task 5**

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
```

Expected: PASS when local Supabase is available.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore supabase/config.toml supabase/migrations/20260920000100_cascade_backend.sql supabase/tests/cascade_backend.sql
git commit -m "feat: add cascade backend database schema"
```

---

### Task 6: Implement Edge Function Auth, HTTP Guardrails, and Profile API

**Files:**
- Create: `supabase/functions/cascade-api/index.ts`
- Create: `supabase/functions/cascade-api/auth.ts`
- Create: `supabase/functions/cascade-api/http.ts`
- Create: `supabase/functions/cascade-api/db.ts`
- Create: `supabase/functions/cascade-api/profile.ts`
- Create: `supabase/functions/cascade-api/validation.ts`
- Create: `tests/pikabu-signed-data.test.ts`
- Create: `tests/backend-validation.test.ts`

**Interfaces:**
- `Authorization: Bearer <pikabu signed JWT>` for account-scoped routes.
- `GET /v1/profile` -> `{ revision, profile, updatedAt }`.
- `PUT /v1/profile` body -> `{ operationId, expectedRevision, profile }`.
- CORS origins read from `CASCADE_ALLOWED_ORIGINS`, comma-separated.
- Request body maximum: `262144` bytes (256 KiB).

- [ ] **Step 1: Write RED HS256 tests with deterministic fixtures**

Create a test helper that signs `header.payload` using Node `crypto.createHmac('sha256', secret).digest('base64url')`, then assert:

```ts
test('valid Pikabu HS256 token returns normalized authorized player', async () => {});
test('tampered signature is rejected', async () => {});
test('header alg none is rejected before payload trust', async () => {});
test('header alg HS512 is rejected even with a syntactically valid token', async () => {});
test('isAuthorized false is rejected for required account identity', async () => {});
test('missing id or overlong name/avatar is rejected or normalized', async () => {});
```

- [ ] **Step 2: Write RED validation/HTTP tests**

Cover board/date/UUID validation plus `Content-Length > 262144` -> 413 and unlisted CORS origin -> no permissive ACAO header.

- [ ] **Step 3: Run RED**

```bash
node --test tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts
```

- [ ] **Step 4: Implement manual Web Crypto HS256 verification**

`auth.ts` must parse exactly three JWT segments, decode the header, require `header.alg === 'HS256'`, then verify with Web Crypto:

```ts
const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['verify'],
);
const valid = await crypto.subtle.verify(
  'HMAC',
  key,
  base64UrlToBytes(signatureB64),
  new TextEncoder().encode(`${headerB64}.${payloadB64}`),
);
```

Only after `valid === true` parse payload and normalize `{ id, name, avatar, isAuthorized }`.

- [ ] **Step 5: Implement CORS/body/rate helpers**

`http.ts` must:

- allow only origins in `CASCADE_ALLOWED_ORIGINS`;
- answer `OPTIONS` without DB work;
- reject bodies over 256 KiB based on both `Content-Length` and actual text length;
- expose a best-effort in-memory fixed-window limiter keyed by verified account ID or request IP hint, with conservative defaults `60 writes/minute` and `120 reads/minute` per warm instance;
- never log Authorization headers, tokens, secrets, or profile JSON.

- [ ] **Step 6: Implement profile handlers over narrow DB adapter and shared profile normalization**

`db.ts` owns Supabase service client construction from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `profile.ts` resolves account from verified identity, then calls the SQL RPCs. Before any profile write, import and call the same pure normalizer used by the browser (`normalizeCloudSnapshot` from `../../../src/cloud/CloudSnapshot.ts`); reject `null` rather than storing unnormalized JSON. The Edge Function must not maintain a second copy of MetaSave normalization rules. Deploy this function with Supabase CLI `--use-api`, which supports bundling local imports outside `supabase/`. Map stale CAS to HTTP `409` with latest profile/revision; repeated idempotent request returns the stored successful response.

- [ ] **Step 7: Wire router**

`index.ts` routes only:

```text
GET /v1/profile
PUT /v1/profile
GET /v1/leaderboards/:board
POST /v1/leaderboards/:board/submit
OPTIONS *
```

Unknown routes -> 404 JSON; method mismatch -> 405 JSON. Profile routes require verified authorized identity.

- [ ] **Step 8: Verify Task 6**

```bash
node --test tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts
pnpm build
```

If Supabase local is available, additionally run:

```bash
pnpm exec supabase functions serve cascade-api --no-verify-jwt --env-file supabase/functions/.env.local
```

and curl one valid fixture against `/v1/profile`.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/cascade-api tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts
git commit -m "feat: add authenticated cloud profile api"
```

---

### Task 7: Implement Backend Leaderboard Reads, Daily Uniqueness, and Derived Rankings

**Files:**
- Create: `supabase/functions/cascade-api/leaderboards.ts`
- Modify: `supabase/functions/cascade-api/index.ts`
- Modify: `supabase/functions/cascade-api/db.ts`
- Modify: `supabase/functions/cascade-api/validation.ts`
- Modify: `supabase/tests/cascade_backend.sql`
- Create: `tests/backend-leaderboard-contract.test.ts`

**Interfaces:**
- `GET /v1/leaderboards/standard?limit=20`
- `GET /v1/leaderboards/daily?scope=YYYY-MM-DD&limit=20`
- `GET /v1/leaderboards/daily-streak?today=YYYY-MM-DD&limit=20`
- `GET /v1/leaderboards/mastery?limit=20`
- Optional valid Authorization adds `playerEntry`; no Authorization still returns public `entries`.
- `POST /v1/leaderboards/:board/submit` requires Authorization and `operationId`.

Response shape:

```ts
interface BackendLeaderboardResponse {
  readonly entries: readonly BackendLeaderboardEntry[];
  readonly playerEntry: BackendLeaderboardEntry | null;
}

interface BackendLeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly metric: Record<string, number | string>;
}
```

- [ ] **Step 1: Write RED route/ordering contract tests**

Use a fake DB repository to assert:

```ts
test('guest can read standard top rows without Authorization', async () => {});
test('daily read requires valid YYYY-MM-DD scope', async () => {});
test('daily ranks fewer moves before lower elapsed time before accepted time', async () => {});
test('daily-streak read derives current relative to today without trusting submitted streak scalar', async () => {});
test('mastery read derives points from normalized profile facts', async () => {});
test('unknown board is rejected before DB access', async () => {});
test('write without verified authorized identity returns 401', async () => {});
```

- [ ] **Step 2: Add DB ranking tests**

Extend pgTAP with three Daily players proving exact move/time tie order and Standard rows proving descending best streak. Add one duplicate Daily completion proving first row is unchanged.

- [ ] **Step 3: Run RED**

```bash
node --test tests/backend-leaderboard-contract.test.ts
pnpm exec supabase test db
```

- [ ] **Step 4: Implement structured submit validation**

Accepted bodies:

```ts
type BackendSubmitBody =
  | { operationId: string; kind: 'standard'; bestStreak: number }
  | { operationId: string; kind: 'daily'; dailyId: string; moves: number; elapsedMs: number; completedOnTime: boolean; attemptId?: string }
  | { operationId: string; kind: 'streak'; todayId: string }
  | { operationId: string; kind: 'mastery'; profile: unknown };
```

Reject mismatched route/body `kind`, future Daily dates beyond server UTC today, moves outside `1..9999`, elapsed outside `1..99_999_999`, invalid attempt IDs, and malformed profile envelopes.

- [ ] **Step 5: Implement semantics**

- Standard -> `cascade_upsert_leaderboard_entry()` with max `bestStreak`.
- Daily -> `cascade_submit_daily_result()`; never update an existing `(account_id,daily_id)` row.
- Daily streak -> ignore client numeric score and derive from accepted `daily_results.completed_on_time` history.
- Mastery -> normalize supplied profile with the browser's shared `normalizeMetaSave()` implementation and compute points by importing the existing pure `lifetimeMasteryPoints()` from `../../../src/leaderboards/LeaderboardConfig.ts`; store rank + points as context. This prevents client/server weight drift while still documenting that rank itself is only bounded client-derived in phase 1.

- [ ] **Step 6: Verify Task 7**

```bash
node --test tests/backend-leaderboard-contract.test.ts tests/backend-validation.test.ts tests/pikabu-signed-data.test.ts
pnpm exec supabase test db
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/cascade-api supabase/tests/cascade_backend.sql tests/backend-leaderboard-contract.test.ts
git commit -m "feat: add backend leaderboards"
```

---

### Task 8: Add Generic Backend HTTP Client and Revisioned Cloud Profile Client

**Files:**
- Create: `src/backend/BackendClient.ts`
- Create: `src/backend/CloudProfileService.ts`
- Create: `tests/backend-client.test.ts`

**Interfaces:**

```ts
export class BackendHttpError extends Error {
  readonly status: number;
  readonly body: unknown;
}

export class BackendClient {
  constructor(baseUrl: string, identity: BackendIdentityProvider, fetchImpl?: typeof fetch);
  request<T>(path: string, init?: RequestInit & { readonly authorized?: boolean }): Promise<T>;
}

export type CloudProfileLoad = {
  readonly revision: number;
  readonly profile: CloudSnapshot | null;
  readonly updatedAt: string | null;
};

export type CloudProfileSaveResult =
  | { readonly status: 'saved'; readonly revision: number; readonly profile: CloudSnapshot }
  | { readonly status: 'conflict'; readonly revision: number; readonly profile: CloudSnapshot | null };

export class CloudProfileService {
  load(): Promise<CloudProfileLoad>;
  save(operation: PendingProfileOperation): Promise<CloudProfileSaveResult>;
}
```

- [ ] **Step 1: Write RED client tests**

Cover:

```ts
test('authorized request attaches exact signed assertion as Bearer token', async () => {});
test('public request does not ask identity provider for assertion', async () => {});
test('missing assertion on authorized request fails before fetch', async () => {});
test('409 preserves parsed response for coordinator conflict handling', async () => {});
test('invalid non-json success response is rejected', async () => {});
test('AbortSignal timeout becomes a non-fatal request error', async () => {});
```

Use a 10-second default timeout, injectable fetch for tests.

- [ ] **Step 2: Run RED**

```bash
node --test tests/backend-client.test.ts
```

- [ ] **Step 3: Implement `BackendClient` and `CloudProfileService`**

Normalize base URL by removing trailing `/`; use `Content-Type: application/json` only for body requests; never log auth token or body. `CloudProfileService.load()` normalizes server profile with `normalizeCloudSnapshot()` and throws on a malformed non-null cloud snapshot rather than applying it.

- [ ] **Step 4: Verify Task 8**

```bash
node --test tests/backend-client.test.ts tests/cloud-snapshot.test.ts
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/backend/BackendClient.ts src/backend/CloudProfileService.ts tests/backend-client.test.ts
git commit -m "feat: add cloud backend client"
```

---

### Task 9: Replace Pikabu Stub with Real SDK Adapter

**Files:**
- Modify: `src/platform/pikabu.ts`
- Create: `tests/pikabu-platform.test.ts`
- Modify: `src/platform/index.ts`

**Interfaces:**
- Dynamically load exactly `https://games.pikabu.ru/sdk/sdk.js` only for `VITE_PLATFORM_TARGET=pikabu`.
- Call `PkbSDK.init()` exactly once.
- `ready()` calls `sdk.gameStarted()` once.
- `auth.requestAuthorization()` calls `sdk.auth.openAuthDialog()` and then re-reads `sdk.player.isAuthorized`.
- listen once for `userAuthorized` and notify `onAccountSelectionClosed` subscribers so existing product UI refreshes.
- `backendIdentity.getAssertion()` returns `{ provider: 'pikabu', value: await sdk.player.getSignedData() }` only when authorized.
- `backendIdentity.localIdentityKey()` returns current `sdk.player.id` for local namespace only.
- player storage remains `createBrowserPlayerStorage()`; `auth.playerStorageScopeChangesOnAuthorization = false`.

- [ ] **Step 1: Write RED SDK tests with fake `window.PkbSDK`**

Cover:

```ts
test('Pikabu init is singleton and ready calls gameStarted once', async () => {});
test('guest uses browser local player storage and remains playable', async () => {});
test('requestAuthorization checks updated player state after dialog closes', async () => {});
test('userAuthorized event observes changed player id and notifies account listeners', async () => {});
test('signed assertion is unavailable for guest and returned for authorized player', async () => {});
test('SDK load/init failure returns unavailable local-first platform instead of throwing startup', async () => {});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/pikabu-platform.test.ts tests/platform-target.test.ts
```

- [ ] **Step 3: Implement SDK types and dynamic script loader**

Declare the minimal interfaces locally; do not import an unofficial package. Loader must check `window.PkbSDK` first, append one async script otherwise, and share one promise across callers.

- [ ] **Step 4: Implement auth/identity/ready and inert ads**

Phase 1 `PlatformAds` remains unavailable on Pikabu. Existing document visibility handling already supplies required background audio pause; auth dialog should be treated as a temporary external pause around `openAuthDialog()` so gameplay/timer are paused while it is open.

- [ ] **Step 5: Verify Task 9**

```bash
node --test tests/pikabu-platform.test.ts tests/platform-target.test.ts tests/platform-services.test.ts
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/platform/pikabu.ts src/platform/index.ts tests/pikabu-platform.test.ts
git commit -m "feat: integrate pikabu platform sdk"
```

---

### Task 10: Implement CloudSyncCoordinator with First Auth Merge, CAS Retry, and Offline Backoff

**Files:**
- Create: `src/cloud/CloudSyncCoordinator.ts`
- Create: `tests/cloud-sync-coordinator.test.ts`

**Interfaces:**

```ts
export interface CloudSyncLocalPort {
  readSnapshot(): CloudSnapshot;
  applySnapshot(snapshot: CloudSnapshot): Promise<boolean>;
  todayId(): string;
}

export type CloudSyncReason = 'startup' | 'authorization' | 'online' | 'game-complete' | 'home';

export class CloudSyncCoordinator {
  constructor(options: {
    identity: BackendIdentityProvider;
    profiles: CloudProfileService;
    local: CloudSyncLocalPort;
    stateStoreFactory: (provider: string, localIdentityKey: string) => CloudSyncStateStore;
    nowMs?: () => number;
    random?: () => number;
  });
  sync(reason: CloudSyncReason): Promise<'synced' | 'guest' | 'offline' | 'pending'>;
  retryPending(): Promise<void>;
  dispose(): void;
}
```

CAS retries are bounded to **3** save attempts per `sync()` call. Backoff after transport failure is exponential `2s, 4s, 8s, 16s, 30s max` plus up to 25% jitter; no busy loop.

- [ ] **Step 1: Write RED coordinator scenarios**

Include:

```ts
test('guest sync is a no-op and never calls backend', async () => {});
test('first authorization with empty cloud uploads normalized local snapshot', async () => {});
test('first authorization with local and cloud performs semantic first-link merge', async () => {});
test('successful save updates local snapshot BASE and accepted revision only after server confirmation', async () => {});
test('409 refetches latest cloud remerges and retries with new revision', async () => {});
test('three consecutive CAS conflicts stop as pending instead of looping', async () => {});
test('network failure leaves local snapshot untouched and pending operation durable', async () => {});
test('lost response replay reuses same operationId and accepts idempotent server result', async () => {});
test('online retry respects nextRetryAt and resets retry counter after success', async () => {});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/cloud-sync-coordinator.test.ts
```

- [ ] **Step 3: Implement one in-flight sync gate**

Multiple triggers during an active sync share one promise. Never execute two profile merges/writes concurrently for one coordinator.

- [ ] **Step 4: Implement first-link and ongoing CAS algorithm**

Pseudo-code must translate directly:

```ts
const local = this.local.readSnapshot();
const remote = await this.profiles.load();
const merged = mergeCloudSnapshots({ base: state.base, local, cloud: remote.profile, todayId: this.local.todayId() });
await this.local.applySnapshot(merged);
const op = state.pendingProfile ?? {
  kind: 'profile',
  operationId: crypto.randomUUID(),
  expectedRevision: remote.revision,
  profile: merged,
};
stateStore.save({ ...state, pendingProfile: op });
const saved = await this.profiles.save(op);
```

On saved: apply returned normalized profile, set BASE to returned profile, set revision, clear pending op, reset retry. On conflict: clear only the stale pending operation after consuming its idempotent result, merge against returned latest profile, create a **new** operation ID for the new expected revision, retry within bound.

- [ ] **Step 5: Verify Task 10**

```bash
node --test tests/cloud-sync-coordinator.test.ts tests/cloud-merge.test.ts tests/cloud-sync-state.test.ts tests/backend-client.test.ts
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/cloud/CloudSyncCoordinator.ts tests/cloud-sync-coordinator.test.ts
git commit -m "feat: add local-first cloud sync coordinator"
```

---

### Task 11: Add Backend Leaderboard Adapter Without Breaking Yandex Score Semantics

**Files:**
- Create: `src/backend/BackendLeaderboards.ts`
- Create: `tests/backend-leaderboards.test.ts`
- Modify: `src/leaderboards/LeaderboardSubmissionQueue.ts`
- Modify: `tests/leaderboard-submission-queue.test.ts`
- Modify: `src/leaderboards/LeaderboardService.ts`
- Modify: `tests/leaderboard-service.test.ts`
- Modify: `src/platform/pikabu.ts`

**Interfaces:**
- `BackendLeaderboards` implements the existing `PlatformLeaderboards` surface.
- Mapping stays inside backend adapter:

```ts
const BACKEND_BOARD_BY_TECHNICAL_NAME = {
  standardwinstreak: 'standard',
  dailyfastest: 'daily',
  dailystreak: 'daily-streak',
  cascademastery: 'mastery',
} as const;
```

- Backend GET returns structured metrics; adapter converts them into the same `PlatformLeaderboardEntry.score` encoding expected by current `LeaderboardService` row normalizers. This preserves UI code.
- `LeaderboardService.load()` passes `scopeKey: dailyId` for Daily and Streak backend reads.
- `LeaderboardService.syncDailyBest()` gains an optional record context so Pikabu can submit `completedOnTime` and `attemptId`; Yandex still submits the same encoded numeric score.

- [ ] **Step 1: Extend submission queue RED tests**

Add a context-preservation test:

```ts
test('coalesced write keeps context that corresponds to the retained score', async () => {
  // max policy keeps score 9 and its standard context; latest keeps the last Daily/streak context.
});
```

- [ ] **Step 2: Write RED backend adapter tests**

Cover:

```ts
test('guest top-list read omits Authorization and maps rows to PlatformLeaderboardEntry', async () => {});
test('Daily read forwards scope date and encodes metric for existing Daily decoder', async () => {});
test('getEntries followed by getPlayerEntry reuses one short in-flight backend response', async () => {});
test('standard submission posts structured bestStreak not opaque score', async () => {});
test('Daily submission posts dailyId moves elapsed completedOnTime and stable operationId', async () => {});
test('streak submission asks server to derive streak instead of trusting encoded scalar', async () => {});
test('mastery submission sends normalized profile context and server computes sortable value', async () => {});
test('transport failure persists pending mutation and later retry reuses same operationId', async () => {});
```

- [ ] **Step 3: Run RED**

```bash
node --test tests/backend-leaderboards.test.ts tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts
```

- [ ] **Step 4: Carry optional context through `LeaderboardSubmissionQueue`**

Change `LeaderboardSubmit` to:

```ts
export type LeaderboardSubmit = (
  technicalName: string,
  score: number,
  context?: PlatformLeaderboardSubmissionContext,
) => Promise<void>;
```

`PendingWrite` stores context. Under `max`, replace context only when the retained score changes to the new larger score; under `latest`, always replace both score and context with the newest write.

- [ ] **Step 5: Pass scope/context from `LeaderboardService`**

For loads:

```ts
this.platform.leaderboards.getEntries(technicalName, { quantityTop: 20, scopeKey: dailyId });
this.platform.leaderboards.getPlayerEntry(technicalName, { scopeKey: dailyId });
```

For writes, keep current encoded score but include structured context. Example Daily call:

```ts
await this.submissions.enqueue(technicalName, localScore, {
  kind: 'daily',
  dailyId,
  moves: bestMoves,
  elapsedMs: bestMovesTimeMs,
  completedOnTime: context?.completedOnTime === true,
  ...(context?.attemptId ? { attemptId: context.attemptId } : {}),
}, 'latest');
```

Adjust queue argument order to a clear signature such as `enqueue(name, score, context, policy)` and update all call sites/tests in one commit.

- [ ] **Step 6: Implement persistent backend mutations**

`BackendLeaderboards.setScore()` creates/persists a `PendingLeaderboardOperation` before POST. On 2xx remove it; on transport/5xx keep it. On 4xx validation failure remove it and surface the error so invalid local data does not retry forever. Expose `retryPending()` for CloudSyncCoordinator/GameScene online triggers.

- [ ] **Step 7: Verify Yandex regression and backend adapter**

```bash
node --test tests/backend-leaderboards.test.ts tests/leaderboard-service.test.ts tests/leaderboard-submission-queue.test.ts tests/platform-services.test.ts tests/leaderboard-config.test.ts
pnpm build
```

Expected: all existing Yandex numeric-score tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/backend/BackendLeaderboards.ts src/leaderboards/LeaderboardSubmissionQueue.ts src/leaderboards/LeaderboardService.ts src/platform/pikabu.ts tests/backend-leaderboards.test.ts tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts
git commit -m "feat: add backend leaderboard adapter"
```

---

### Task 12: Wire Local-First Cloud Sync into GameScene Authorization and Save Boundaries

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Create: `tests/pikabu-game-scene-wiring.test.mjs`
- Modify: `tests/product-home-wiring.test.ts`
- Modify: `tests/daily-scene-wiring.test.ts`

**Interfaces:**
- Instantiate cloud stack only when both `platform.backendIdentity` and valid `VITE_BACKEND_URL` exist.
- Yandex continues existing `stageProfileMergeTransfer()`/scope-change path.
- Pikabu authorization does **not** stage `ProfileMergeTransfer` and does **not** replace browser `PlayerStorage`; after auth it runs cloud merge against current local profile.
- Sync triggers: startup after local Meta is ready, authorization success, `online`, Standard/Daily completion, return Home after meaningful mutation.

- [ ] **Step 1: Write RED wiring checks**

`tests/pikabu-game-scene-wiring.test.mjs` must assert source patterns for:

```text
platform.auth.playerStorageScopeChangesOnAuthorization
platform.backendIdentity
new CloudSyncCoordinator
window.addEventListener('online', ...)
cloudSync.sync('authorization')
cloudSync.sync('game-complete')
```

and assert that `stageProfileMergeTransfer` is guarded by `playerStorageScopeChangesOnAuthorization === true`.

- [ ] **Step 2: Add runtime-focused auth test seam**

Extract a small pure decision helper if needed:

```ts
export function authorizationUsesProfileScopeTransfer(platform: PlatformServices): boolean {
  return platform.auth.playerStorageScopeChangesOnAuthorization === true;
}
```

Test Yandex -> true, Pikabu -> false.

- [ ] **Step 3: Run RED**

```bash
node --test tests/pikabu-game-scene-wiring.test.mjs tests/product-home-wiring.test.ts tests/daily-scene-wiring.test.ts
```

- [ ] **Step 4: Add `CloudSyncLocalPort` adapter inside GameScene**

`readSnapshot()` returns current normalized `metaState` plus `activeGameRepository.loadCheckpoint()`. `applySnapshot()` calls `metaSession.replaceAndFlush(snapshot.meta)` first; only after successful local profile flush does it apply/clear the active-game checkpoint according to the merged snapshot. Device preferences remain untouched.

- [ ] **Step 5: Fix authorization flow split**

Existing Yandex flow remains:

```text
stage local guest transfer -> Yandex auth -> load new player scope -> apply one-time profile merge
```

Pikabu flow becomes:

```text
checkpoint active game -> Pikabu auth -> keep browser storage/scope -> cloudSync.sync('authorization') -> refresh leaderboard/cache
```

If Pikabu auth changes `sdk.player.id`, create/load the sync-state store using the **new** `localIdentityKey()` before reading BASE.

- [ ] **Step 6: Add non-blocking retry triggers**

Register `online` listener only while scene is alive. On completion and Home return use `void cloudSync.sync(reason)` and `void backendLeaderboards.retryPending()`; never await these before showing victory/menu. Remove listener in `shutdown()`.

- [ ] **Step 7: Pass exact Daily official context**

When `rankingCompletion` is true, pass:

```ts
{
  completedOnTime: dailyRecord?.completedOnTime === true,
  attemptId: dailyRecord?.rankingAttemptId,
}
```

to `syncDailyBest()`. This is the exact first official result already frozen by local product logic; replay calls cannot replace it.

- [ ] **Step 8: Verify Task 12**

```bash
node --test tests/pikabu-game-scene-wiring.test.mjs tests/product-home-wiring.test.ts tests/daily-scene-wiring.test.ts tests/daily-ranking-policy.test.ts tests/daily-leaderboard-record-v2.test.ts tests/profile-merge.test.ts
pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add src/game/scenes/GameScene.ts tests/pikabu-game-scene-wiring.test.mjs tests/product-home-wiring.test.ts tests/daily-scene-wiring.test.ts
git commit -m "feat: wire pikabu cloud sync into game flow"
```

---

### Task 13: Add Pikabu Build Mode, Setup Docs, Deployment Contract, and Full Regression Gate

**Files:**
- Create: `.env.pikabu.example`
- Create: `docs/PIKABU_BACKEND_SETUP.md`
- Create: `docs/PIKABU_HOSTING.md`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Create: `tests/pikabu-build-paths.test.ts`

**Interfaces:**
- `pnpm build` remains current/default Yandex-compatible build.
- `pnpm build:pikabu` runs `tsc && vite build --mode pikabu`.
- `.env.pikabu.local` supplies public values only:

```text
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://<project-ref>.supabase.co/functions/v1/cascade-api
```

- Supabase secrets are set out-of-band:

```text
PIKABU_GAME_SECRET
CASCADE_ALLOWED_ORIGINS
```

`SUPABASE_URL` and service-role credentials use Supabase-provided function environment/server config; never copy them into Vite env.

- [ ] **Step 1: Write RED build-contract test**

Create `tests/pikabu-build-paths.test.ts` asserting:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const vite = readFileSync('vite.config.ts', 'utf8');
const env = readFileSync('.env.pikabu.example', 'utf8');

test('Pikabu build uses a Vite mode while keeping relative asset base', () => {
  assert.match(pkg.scripts['build:pikabu'], /vite build --mode pikabu/);
  assert.match(vite, /base:\s*['"]\.\/['"]/);
  assert.match(env, /VITE_PLATFORM_TARGET=pikabu/);
  assert.match(env, /VITE_BACKEND_URL=/);
  assert.doesNotMatch(env, /PIKABU_GAME_SECRET|SERVICE_ROLE/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/pikabu-build-paths.test.ts
```

- [ ] **Step 3: Add scripts/env/gitignore**

Add scripts:

```json
{
  "build:pikabu": "tsc && vite build --mode pikabu",
  "supabase:test": "supabase test db",
  "supabase:serve": "supabase functions serve cascade-api --no-verify-jwt"
}
```

Ignore:

```text
.env.pikabu.local
supabase/functions/.env
supabase/functions/.env.local
```

- [ ] **Step 4: Write exact backend setup doc**

`docs/PIKABU_BACKEND_SETUP.md` must include commands in this order:

```bash
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
pnpm exec supabase secrets set PIKABU_GAME_SECRET=<secret>
pnpm exec supabase secrets set CASCADE_ALLOWED_ORIGINS=https://<pikabu-host>,http://localhost:5173
pnpm exec supabase functions deploy cascade-api --no-verify-jwt --use-api
```

Also document local `.env.pikabu.local`, local function `.env.local`, two-browser-profile smoke test, secret rotation behavior, and how to inspect function logs without logging tokens.

- [ ] **Step 5: Write static-host contract doc**

`docs/PIKABU_HOSTING.md` records:

- build output is only `dist/`;
- public deployment repo contains built artifacts only, never TypeScript/tests/secrets/history from the private repo;
- GitVerse Pages is current candidate, not a code dependency;
- written commercial-use confirmation is required before release;
- if denied, replace host without changing backend API/client architecture;
- test final URL inside Pikabu Studio because Pikabu SDK only works on platform/test environment.

- [ ] **Step 6: Run full client regression**

```bash
pnpm test
pnpm build
pnpm build:pikabu
```

Expected: all client tests pass; both builds exit 0; Pikabu `dist/` contains no secret strings. Verify explicitly:

```bash
! grep -R "PIKABU_GAME_SECRET\|SUPABASE_SERVICE_ROLE_KEY" dist
```

- [ ] **Step 7: Run backend regression where environment permits**

```bash
pnpm exec supabase test db
node --test tests/pikabu-signed-data.test.ts tests/backend-validation.test.ts tests/backend-leaderboard-contract.test.ts
```

If Docker/local Supabase is unavailable, do not mark DB verification complete; run the Node backend tests and report the missing DB evidence.

- [ ] **Step 8: Manual acceptance smoke test in Pikabu Studio**

Use two separate browser profiles and verify in order:

1. guest starts with no auth and can play/save/reload;
2. guest completes Standard and one Daily locally;
3. leaderboard top rows can be viewed as guest when backend reachable;
4. guest cannot create leaderboard player row;
5. authorize profile A; current local progress remains visible;
6. cloud profile appears; refresh same browser and progress remains;
7. authorize same account in profile B; cloud progress loads;
8. make one win on A and one win on B from same prior revision; reconnect both and verify merged counters/sets contain both changes exactly once;
9. finish first Daily offline, replay it, reconnect, and verify server ranking uses the first pending result only;
10. stop/block Supabase endpoint and verify game startup/local save/Daily/Mastery still work;
11. restore network and verify queued profile/Daily/leaderboard operations flush;
12. run Yandex dev/prod smoke and confirm existing save + leaderboard path still works.

- [ ] **Step 9: Update project state docs**

Record exactly which acceptance items were verified, the Supabase project environment names (not secrets), and leave the GitVerse commercial-use confirmation as an explicit unchecked release gate until written approval is stored.

- [ ] **Step 10: Final verification and commit**

Run fresh:

```bash
pnpm test
pnpm build
pnpm build:pikabu
```

Then:

```bash
git add .env.pikabu.example .gitignore package.json pnpm-lock.yaml docs/PIKABU_BACKEND_SETUP.md docs/PIKABU_HOSTING.md CURRENT_STATE.md TECH.md tests/pikabu-build-paths.test.ts
git commit -m "docs: finalize pikabu backend rollout"
```

---

## Plan Self-Review

### Spec coverage

- Yandex isolation: Tasks 1, 11, 12, 13.
- Guest/local-first behavior: Tasks 2, 9, 10, 12.
- Signed Pikabu identity and secret isolation: Tasks 6, 9, 13.
- BASE/LOCAL/CLOUD merge and CAS: Tasks 3, 4, 8, 10.
- Active game timestamp merge: Task 2, consumed by Tasks 3/12.
- Postgres schema/idempotency: Task 5.
- Profile API: Tasks 6/8.
- Leaderboards/read-as-guest/first Daily result: Tasks 7/11/12.
- Offline queue/retry/backoff: Tasks 4, 10, 11, 12.
- Client cache preservation: Task 11 leaves current `LeaderboardService` 60-second cache intact.
- Pikabu SDK ready/auth/userAuthorized: Task 9.
- Static hosting and Supabase deployment separation: Task 13.
- Commercial-use confirmation gate: Task 13 docs/manual gate.
- Full regression and two-device/offline acceptance: Task 13.

### Placeholder scan

The plan contains no implementation `TODO`/`TBD` steps. Angle-bracket values in setup commands (`<project-ref>`, `<secret>`, `<pikabu-host>`) are deployment inputs that cannot be committed by design, not code placeholders; the docs must explain where each value comes from.

### Type consistency

- `PlatformIdentityAssertion`, `BackendIdentityProvider`, scoped read options, and structured submission context originate in Task 1 and are consumed consistently by Tasks 4, 8, 9, 10, and 11.
- `CloudSnapshot` originates in Task 2 and is consumed by Tasks 3, 4, 8, 10, and 12.
- `CloudSyncStateStore` originates in Task 4 and is consumed by Tasks 10/11.
- `BackendClient`/`CloudProfileService` originate in Task 8 and are consumed by Task 10.
- `BackendLeaderboards` originates in Task 11 and is wired by Pikabu/GameScene in Tasks 11/12.

### Review Focus coverage

All five Review Focus items have explicit tests/steps in the owning tasks: identity change (9/12), lost response/idempotency (4/5/10/11), two-device CAS (3/10/13), corrupt/oversized payloads (2/4/6), unavailable/misconfigured backend (1/8/9/12/13).
