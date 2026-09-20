# Cascade: platform-independent backend + Pikabu port — design

Date: 2026-09-20
Status: proposed for implementation
Target branch: `feat/platform-backend`

## 1. Goal

Add a platform-independent cloud/backend layer to Cascade without destabilizing the existing Yandex release path.

The first backend client will be Pikabu Games. Yandex remains on its current Yandex player storage and Yandex leaderboards in this phase.

Success means:

- Cascade still works fully as a guest with no backend connection.
- On Pikabu, guest progress is stored locally.
- After Pikabu authorization, local progress is merged with cloud progress instead of one side replacing the other.
- After authorization, cloud sync works across devices.
- Daily and Mastery remain playable offline.
- Guests can view leaderboards but cannot submit scores.
- Authorized Pikabu players use backend-hosted leaderboards.
- Backend outages never prevent the game from starting or local progress from being saved.
- Existing Yandex save/leaderboard behavior remains unchanged.

## 2. Non-goals for this phase

- Moving Yandex saves to the new backend.
- Moving Yandex leaderboards to the new backend.
- Cross-linking Yandex and Pikabu identities into one player account.
- Email/password accounts owned by Cascade.
- Realtime/WebSocket features.
- Full server-side verification of every solitaire move.
- Purchases or Pikabu monetization integration.
- A dedicated VPS or long-running Node server.

## 3. Current project state relevant to this work

The project already has useful boundaries:

- `src/platform/services.ts`
  - `PlayerStorage`
  - `PlatformAuth`
  - `PlatformLeaderboards`
  - `PlatformAds`
  - pause/gameplay lifecycle ports
- `src/platform/yandex.ts`
  - current Yandex SDK adapter
- `src/meta/MetaSave.ts`
  - current profile version: `META_SAVE_VERSION = 9`
- `src/meta/ProfileMerge.ts`
  - existing one-time profile merge logic
- `src/leaderboards/LeaderboardService.ts`
  - platform-facing leaderboard application service
- `src/leaderboards/LeaderboardSubmissionQueue.ts`
  - submission serialization/dedup behavior
- `src/leaderboards/LeaderboardConfig.ts`
  - existing score encoding/decoding and board semantics
- `src/persistence/ActiveGameRepository.ts`
  - current local active-game save
- `src/settings/Preferences.ts`
  - device-local language/sound/tutorial preferences

Important: `mergeMetaProfiles()` is suitable for one-time scope transfer, but it must not be reused as the ongoing multi-device cloud merge algorithm because several counters are additive and repeated pairwise merges could double-count already synchronized data.

## 4. Chosen architecture

### 4.1 High-level shape

```text
                         CASCADE
                            |
                    application services
                            |
                +-----------+-----------+
                |                       |
             Yandex                   Pikabu
                |                       |
      Yandex PlayerStorage        browser localStorage
      Yandex Leaderboards               |
      Yandex Auth                  CloudSyncCoordinator
                                        |
                                  BackendClient
                                        |
                                     HTTPS
                                        |
                              Supabase Edge Function
                                        |
                                     Postgres
```

### 4.2 Yandex isolation

Yandex stays on the existing path:

- Yandex `getData/setData` remains the save source.
- Yandex leaderboards remain the leaderboard source.
- Existing Yandex technical board names remain unchanged.
- Backend availability must not affect the Yandex build.

Any shared-interface changes must be additive and backward-compatible.

### 4.3 Pikabu local-first path

Pikabu uses:

- browser `localStorage` as the immediate source of truth for the current session;
- Pikabu SDK for identity/authentication;
- signed Pikabu player data as the backend identity assertion;
- the backend for cloud profile synchronization and remote leaderboards.

The client always saves locally first, then attempts cloud synchronization asynchronously.

## 5. Platform-independent identity boundary

Do not make the cloud layer depend directly on Pikabu SDK types.

Introduce a small generic identity-assertion port, conceptually:

```ts
interface PlatformIdentityAssertion {
  readonly provider: string;
  readonly value: string;
}

interface BackendIdentityProvider {
  isAuthorized(): boolean;
  getAssertion(): Promise<PlatformIdentityAssertion | null>;
}
```

Pikabu implementation returns:

```text
provider = "pikabu"
value = sdk.player.getSignedData()
```

Yandex does not use this backend in phase 1, so it can expose no backend identity provider / a null capability.

The backend must never trust a client-supplied `accountId` or `playerId`. It derives identity only after validating the signed assertion.

## 6. Pikabu signed identity verification

Pikabu `getSignedData()` returns an HS256 JWT containing player fields such as:

- `id`
- `name`
- `avatar`
- `isAuthorized`

The Edge Function must:

1. accept the signed assertion;
2. verify HS256 using the Pikabu game secret;
3. explicitly reject any JWT algorithm other than HS256;
4. require `isAuthorized === true` for account-scoped operations;
5. derive `provider_user_id` from the verified payload;
6. update display name/avatar from the verified payload;
7. never expose the Pikabu secret to the browser bundle.

Secrets stored only in Supabase Edge Function secrets:

- `PIKABU_GAME_SECRET`
- Supabase server/service credentials needed by the function

## 7. Guest behavior

Guest mode is a supported first-class mode, not an error state.

Guest can:

- play Standard;
- play Daily;
- progress Mastery;
- save locally;
- view leaderboards when the backend is reachable.

Guest cannot:

- submit leaderboard entries;
- cloud-sync progress.

Authorization is requested only when needed by the product flow, not as a hard startup gate.

## 8. Cloud snapshot model

The backend stores one normalized cloud snapshot per account.

The cloud snapshot should contain gameplay/progression data, not device preferences.

Conceptually:

```ts
interface CloudSnapshot {
  readonly schemaVersion: number;
  readonly meta: MetaSave;
  readonly activeGame?: {
    readonly save: ActiveGameSaveV2;
    readonly updatedAtMs: number;
  };
}
```

Do not cloud-sync these device preferences in phase 1:

- language;
- sound enabled;

`howToPlaySeen` may remain device-local as well. This keeps settings predictable per device and avoids unnecessary merge rules.

The active game is wrapped with `updatedAtMs` at the sync layer so the cloud merge can select the newer checkpoint without changing the gameplay save semantics unnecessarily.

## 9. Database schema

Use Postgres tables with platform-neutral naming.

### 9.1 `accounts`

```text
id uuid primary key
created_at timestamptz not null
```

### 9.2 `identities`

```text
id uuid primary key
account_id uuid not null references accounts(id)
provider text not null
provider_user_id text not null
public_name text
avatar_url text
updated_at timestamptz not null
unique(provider, provider_user_id)
```

For phase 1, `provider = 'pikabu'`.

The separate account/identity structure deliberately leaves room for another provider later without changing profile/leaderboard ownership. Actual cross-provider linking is out of scope.

### 9.3 `cloud_profiles`

```text
account_id uuid primary key references accounts(id)
schema_version integer not null
revision bigint not null
profile jsonb not null
updated_at timestamptz not null
```

`profile` stores the CloudSnapshot payload (or equivalent normalized JSON envelope).

### 9.4 `daily_results`

```text
account_id uuid not null references accounts(id)
daily_id date not null
attempt_id text
moves integer not null
elapsed_ms bigint not null
completed_on_time boolean not null
completed_at timestamptz not null
operation_id uuid not null
primary key(account_id, daily_id)
unique(account_id, operation_id)
```

This table enforces the product rule that only the first official completed result for a Daily date counts for ranking.

### 9.5 `leaderboard_entries`

```text
account_id uuid not null references accounts(id)
board_key text not null
scope_key text not null
primary_value bigint not null
secondary_value bigint
context jsonb
updated_at timestamptz not null
primary key(account_id, board_key, scope_key)
```

Expected board keys:

- `standard`
- `mastery`
- optional cached/derived `daily-streak`

Daily per-day ranking is sourced from `daily_results` rather than requiring a generic score row.

### 9.6 `idempotency_operations`

```text
account_id uuid not null references accounts(id)
operation_id uuid not null
operation_type text not null
result jsonb not null
created_at timestamptz not null
primary key(account_id, operation_id)
```

Retention can be bounded later (for example, prune old rows after a safe period). No cleanup scheduler is required for the first implementation unless the Free tier makes it necessary.

## 10. HTTP API

Use one Supabase Edge Function as a small versioned router:

```text
/functions/v1/cascade-api/v1/...
```

### 10.1 Authentication transport

Use the Pikabu signed assertion in an HTTP authorization header rather than trusting IDs in request bodies:

```text
Authorization: Bearer <pikabu-signed-data>
```

CORS must allow only known production/development origins required for the Pikabu build and local development.

### 10.2 Profile API

```text
GET /v1/profile
PUT /v1/profile
```

`GET /v1/profile` response:

```json
{
  "revision": 18,
  "profile": {},
  "updatedAt": "..."
}
```

No profile yet:

```json
{
  "revision": 0,
  "profile": null
}
```

`PUT /v1/profile` request:

```json
{
  "operationId": "uuid",
  "expectedRevision": 18,
  "profile": {}
}
```

Save is compare-and-swap:

- if current revision equals `expectedRevision`, write and increment revision;
- otherwise return `409 Conflict` plus the latest server snapshot/revision.

### 10.3 Leaderboard API

```text
GET  /v1/leaderboards/:board
POST /v1/leaderboards/:board/submit
```

Supported board values are a fixed whitelist.

Guests may call leaderboard reads without an account where practical. Writes always require a verified authorized identity.

## 11. Three-way profile merge

Each authorized device stores three conceptual states:

- **BASE** — the last cloud snapshot this device successfully synchronized;
- **LOCAL** — current local snapshot;
- **CLOUD** — latest server snapshot.

Merge is:

```text
BASE -> LOCAL changes
BASE -> CLOUD changes
          |
          v
        MERGED
```

After successful save:

- local snapshot becomes MERGED;
- BASE becomes the newly accepted server snapshot;
- local base revision is updated.

### 11.1 Local sync metadata

Use a separate localStorage key, not `MetaSave`, for sync metadata, e.g.:

```text
cascadeCloudSyncState:v1:<provider>:<providerUserId>
```

Contains:

- last accepted cloud revision;
- BASE snapshot/hash or normalized BASE payload;
- pending operations;
- last successful sync timestamp;
- optional retry metadata.

Do not mix transport state into the gameplay profile schema.

### 11.2 First authorization / no BASE available

On first Pikabu authorization:

1. load LOCAL;
2. fetch CLOUD;
3. if cloud is empty, upload normalized LOCAL;
4. if both exist, perform a first-link semantic merge;
5. save merged result with revision CAS;
6. persist BASE only after the backend confirms the save.

### 11.3 Merge rules

Use domain-specific rules rather than last-write-wins for the whole profile.

- Completed Standard seeds: set union.
- `masteryCreditedSeeds`: set union.
- Daily records: union by date.
- Best times: minimum positive value.
- Best moves: lower moves wins; elapsed time breaks ties.
- Achievements: set union.
- Future prestige seed/date sets: union.
- Current/best Standard streak: merge cautiously from BASE deltas; never blindly add two absolute values.
- Statistics counters (`played`, `wins`, attempts): use BASE-relative deltas to avoid double counting.
- Weekly completion sets: union for same week; newer week wins as the active week shell.
- Daily streak: derive/recalculate from merged Daily history rather than trusting a stale scalar.
- Mastery: keep gameplay progression internally consistent after merge; do not simply take whichever entire profile is newer.
- Active game: choose the checkpoint with the greater `updatedAtMs` after validation.
- Device preferences: remain local and are excluded from cloud merge.

The implementation must include dedicated tests for repeated sync of the same BASE/LOCAL/CLOUD inputs to prove idempotence and no counter inflation.

## 12. Revision conflict algorithm

Example:

1. device loads revision 17;
2. another device writes revision 18;
3. first device attempts `PUT expectedRevision=17`;
4. backend returns `409` with revision 18;
5. client performs three-way merge again using the latest cloud state;
6. retries against revision 18.

Retry count must be bounded. Persistent conflicts return to a pending-sync state; gameplay continues locally.

## 13. Idempotency

Every mutating backend operation receives `operationId` (UUID).

If a request succeeded server-side but the response was lost, resending the same operation ID must return the original result rather than applying it twice.

This applies at minimum to:

- profile writes;
- Daily result submission;
- leaderboard submissions that mutate server state.

## 14. Leaderboard semantics

Keep the existing product concepts while separating backend keys from Yandex technical names.

### 14.1 Standard

Backend key:

```text
standard
```

Metric:

```text
best Standard win streak
```

Ordering:

```text
best streak descending
```

Server stores the maximum accepted structured streak value; client does not send a pre-encoded opaque leaderboard score.

### 14.2 Daily

Backend key:

```text
daily
```

Scope:

```text
YYYY-MM-DD
```

Ordering inside a date:

1. fewer moves;
2. lower elapsed time;
3. earlier accepted completion as deterministic final tie-break.

`daily_results` primary key `(account_id, daily_id)` enforces first-official-result-only.

Local replay may improve the player's personal local record, but it must never replace the stored official ranking result.

If the first completion occurred offline, persist it locally as a pending official result and submit that exact result when connectivity returns. Later replays must not replace the pending first result.

### 14.3 Daily streak

Backend key:

```text
daily-streak
```

Prefer deriving current/best streak from the account's accepted on-time Daily history rather than accepting arbitrary streak scalars from the client.

Because offline completion time cannot be made fully trustworthy without an online attempt token, `completedOnTime` remains a bounded client claim in phase 1. Reject malformed/future dates and obvious impossible values, but do not pretend this is a complete anti-cheat.

### 14.4 Mastery

Backend key:

```text
mastery
```

Current Yandex encoding remains Yandex-specific.

Backend should accept structured normalized profile/progression data and compute its own sortable representation instead of trusting a client-supplied encoded scalar.

Important limitation: the current `MetaSave` does not retain a complete chronological event ledger sufficient to reconstruct every historical Mastery rank transition from scratch. Therefore phase 1 can validate/normalize the merged profile and derive lifetime points, but cannot make Mastery fully server-authoritative against a determined modified client without adding an event ledger.

Do not claim stronger anti-cheat than this. A future phase may add signed/validated progression events.

## 15. Anti-cheat/security boundary

Phase 1 protects against accidental corruption and trivial API tampering, not a determined attacker controlling browser code.

Required controls:

- verify Pikabu signed JWT server-side;
- enforce HS256;
- reject unauthorized identity payloads for writes;
- derive account identity server-side;
- whitelist board keys;
- normalize all profile payloads using shared schema rules;
- validate ranges/types/date formats;
- limit request body size;
- enforce first Daily result with a DB uniqueness constraint;
- make operations idempotent;
- no direct browser access using a service-role key;
- do not expose Pikabu secret;
- add basic per-account/per-IP throttling where practical in the Edge Function;
- log validation failures without storing secrets.

Future hardening, only if needed:

- server-issued attempt tokens;
- compact move log submission;
- server-side rules verifier for Daily;
- server-maintained progression event ledger.

## 16. Offline and retry behavior

Backend failure must degrade gracefully.

When backend is unavailable:

```text
Standard gameplay     works
Daily gameplay        works
Mastery               works
local saves           work
active-game resume    works locally
cloud sync            pending
leaderboard reads     unavailable/stale cache
leaderboard writes    queued
```

Recommended triggers to retry pending sync:

- successful authorization;
- game startup after local state is ready;
- browser `online` event;
- end of a completed game;
- returning to Home after a meaningful profile mutation.

Do not busy-loop. Use bounded exponential backoff with jitter and persist only the minimum retry state needed across reloads.

## 17. Leaderboard caching

Keep the current client-side leaderboard caching/throttling behavior.

Pikabu backend leaderboards should plug into the same `PlatformLeaderboards` shape used by `LeaderboardService`, so `LeaderboardsScene` does not care whether results come from Yandex SDK or the backend.

The existing 60-second tab cache remains useful for the backend path as well.

## 18. Proposed client modules

Exact file names may change during implementation, but the design boundary should remain:

```text
src/platform/pikabu.ts
    Pikabu SDK init/auth/lifecycle/identity assertion

src/backend/BackendClient.ts
    HTTP, auth header, response/error parsing

src/backend/CloudProfileService.ts
    profile GET/PUT + revision contract

src/backend/BackendLeaderboards.ts
    PlatformLeaderboards adapter over HTTP API

src/cloud/CloudSyncCoordinator.ts
    local-first orchestration, queue, retries, CAS conflicts

src/cloud/CloudMerge.ts
    pure three-way merge functions

src/cloud/CloudSyncState.ts
    local BASE/revision/pending metadata
```

Server-side:

```text
supabase/
  migrations/
  functions/
    cascade-api/
      index.ts
      auth.ts
      profile.ts
      leaderboards.ts
      validation.ts
```

Shared pure logic should be extracted only where needed by both browser and Edge Function. Avoid creating a large monorepo/package system unless Deno/Supabase import constraints actually require it.

## 19. Pikabu runtime integration

The Pikabu build must:

- load/init Pikabu SDK;
- call the platform's game-ready lifecycle method at the correct time;
- map Pikabu pause/background events into existing platform pause/audio behavior where supported;
- expose Pikabu auth via existing product flows;
- keep the game playable before authorization;
- use browser local storage immediately;
- start cloud merge only after an authorized signed identity is available.

No Pikabu-only checks should leak deep into gameplay scenes. Platform branching belongs in boot/wiring/adapters.

## 20. Static hosting

### 20.1 Selected candidate: GitVerse Pages Free

Why it fits technically:

- serves static HTML/CSS/JS;
- supports Free tier;
- current project already has `vite.config.ts` with `base: './'`, matching GitVerse Pages' relative-path requirement;
- documented Pages build artifact limit is 500 MB, far above the current Cascade build size;
- Free Pages requires the publishing repository to be public.

Deployment model:

```text
private development repository
       |
   pnpm build
       |
      dist/
       |
public GitVerse deployment repository / deployment branch
       |
GitVerse Pages URL
```

Only production `dist/` artifacts go to the public deployment repository. TypeScript source, tests, tools, docs, generators, and development history stay out of that repo.

### 20.2 Commercial-use gate

Official GitVerse Pages documentation explicitly lists product/company static sites as supported use cases, but the current public docs do not contain an unambiguous sentence specifically saying that a monetized Pikabu game may use the Free tier.

Therefore commercial eligibility is a **release gate**, not an assumption:

- before public Pikabu release, obtain written confirmation from GitVerse support that hosting the monetized game build on Pages Free is permitted;
- save that confirmation with project/release notes;
- if the answer is negative, swap only the static hosting provider. The backend/client architecture must not depend on GitVerse-specific APIs.

This uncertainty must not block backend implementation because hosting is deliberately decoupled.

## 21. Supabase Free usage

Supabase provides:

- Postgres for profile/leaderboard rows;
- Edge Functions for Pikabu JWT verification and API routing;
- secrets storage for the Pikabu game secret.

The implementation should stay comfortably inside Free-tier expectations at initial traffic by:

- storing one compact profile JSON per authorized account;
- keeping leaderboard rows narrow;
- caching reads client-side;
- avoiding realtime subscriptions;
- avoiding unnecessary writes;
- pruning old idempotency records later if needed.

The game must not assume Supabase is reachable from every network at every moment; local-first behavior is mandatory.

## 22. Deployment environments

Use at least two backend environments logically:

### Local/dev

- local Vite game;
- dev/test Pikabu path or mocked signed identity where necessary;
- separate Supabase project/config if available, otherwise a clearly isolated schema/test identity namespace.

### Production

- production Pikabu secret;
- production Supabase project;
- production static hosting URL;
- strict production CORS origin allowlist.

Secrets are never checked into the repository.

Expected frontend env variables may include only public values such as:

```text
VITE_BACKEND_URL
VITE_PLATFORM_TARGET
```

Never expose service-role credentials or Pikabu secret as `VITE_*` variables.

## 23. Testing strategy

### Pure unit tests

Must cover:

- first-link local + cloud merge;
- three-way counter delta merge;
- repeated identical sync is idempotent;
- two devices contributing wins do not lose or duplicate wins;
- Daily record union;
- best moves/time tie rules;
- active-game newer timestamp selection;
- weekly merge behavior;
- revision conflict retry state;
- pending first Daily result cannot be replaced by replay;
- backend leaderboard score normalization.

### Platform contract tests

- Yandex adapter behavior remains unchanged.
- Pikabu adapter exposes the same application-level ports.
- guest auth state blocks leaderboard writes.
- guest can still read cached/public leaderboard rows.

### Backend tests

- valid Pikabu HS256 signed data accepted;
- invalid signature rejected;
- wrong JWT algorithm rejected;
- `isAuthorized=false` rejected for writes;
- account resolution based only on verified payload ID;
- profile CAS success and 409 conflict;
- operation idempotency;
- Daily uniqueness constraint;
- malformed/oversized payload rejection;
- board whitelist;
- correct sorting/pagination.

### Integration smoke tests

- guest -> play -> reload -> local progress preserved;
- guest -> authorize -> first merge -> cloud created;
- second device -> authorize -> cloud loads;
- offline win -> local state updates -> later online sync succeeds;
- backend down -> game remains playable;
- Yandex production/dev path still passes existing tests.

## 24. Rollout sequence

1. Create `feat/platform-backend` branch from a clean checkpoint.
2. Add pure cloud merge/sync models and tests without changing Yandex runtime.
3. Add Supabase schema + Edge Function API and backend tests.
4. Add generic backend client + cloud sync coordinator.
5. Add Pikabu SDK adapter and platform boot selection.
6. Add backend leaderboard adapter.
7. Wire guest/auth UX and pending sync behavior.
8. Build Pikabu-target production artifact.
9. Publish build to candidate static host for integration testing.
10. Verify cloud sync across two browser profiles/devices.
11. Verify offline/degraded behavior.
12. Obtain GitVerse commercial-use confirmation or replace static host.
13. Configure production Pikabu secret/CORS/backend environment.
14. Submit Pikabu build only after the Yandex regression suite remains green.

## 25. Acceptance criteria

The phase is complete when all of the following are true:

- Yandex build uses its current save and leaderboard services unchanged in behavior.
- Pikabu guest starts without login and retains progress after reload.
- Pikabu Daily and Mastery work for guest.
- Guest leaderboard submission is impossible.
- Pikabu authorization yields a verified backend account based on signed data.
- First auth merges local and cloud progress without wiping either side.
- Repeated cloud sync does not inflate counters.
- Two-device revision conflicts converge through three-way merge.
- Cloud/backend outage does not block game startup or local saving.
- First Daily official result remains immutable for ranking.
- Authorized Pikabu leaderboard rows render through the existing leaderboard UI.
- No Pikabu secret or Supabase server credential is present in the frontend bundle.
- Production static build loads from the selected host using relative Vite paths.
- Commercial use of the chosen Free static host is confirmed before release.

## 26. Key risks and mitigations

### Foreign backend availability from Russia

Risk: intermittent access to Supabase infrastructure.

Mitigation: local-first saves, queued sync, stale leaderboard cache, backend never required to boot/play.

### Free static-host terms

Risk: ambiguous commercial eligibility.

Mitigation: written confirmation before release; static host remains replaceable.

### Browser client can be modified

Risk: determined users can forge gameplay facts.

Mitigation: signed identity, validation, DB constraints, idempotency, derived score encoding; stronger attempt/move verification deferred until actual abuse warrants it.

### Merge complexity

Risk: double-counting counters or losing progress.

Mitigation: BASE/LOCAL/CLOUD three-way merge, pure deterministic merge tests, CAS revision, idempotent operations.

### Over-coupling backend to Pikabu

Risk: another platform requires another backend rewrite.

Mitigation: provider-neutral account/identity schema, generic identity assertion port, generic BackendClient/CloudProfileService/RemoteLeaderboard interfaces.

## 27. Decisions locked by this design

- Architecture option A: Yandex remains on Yandex saves and leaderboards for now.
- Pikabu is guest-first/local-first.
- Daily and Mastery fully function for guest.
- Guests do not submit leaderboard results.
- Guest local progress is semantically merged into cloud at authorization.
- Ongoing cloud sync uses three-way merge with revisions.
- Supabase Free is the initial database/Edge Function backend.
- Static hosting is replaceable; GitVerse Pages Free is the current candidate pending explicit commercial-use confirmation.
- No full move-by-move anti-cheat in phase 1.
