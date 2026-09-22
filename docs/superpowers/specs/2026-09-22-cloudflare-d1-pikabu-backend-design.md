# Cascade: Pikabu native identity + Cloudflare Worker + D1 backend — design

Date: 2026-09-22  
Status: awaiting user review  
Supersedes for Pikabu persistence: `2026-09-21-pikabu-gamepush-stateless-bridge-design.md`

## 1. Goal

Replace the GamePush-backed Pikabu bridge with a Cloudflare D1-backed bridge while preserving Cascade's existing browser REST contract, Pikabu-native authorization, local-first save behavior, Daily first-result semantics, and Yandex behavior.

Success means:

- Pikabu is the only visible identity/auth provider;
- no GamePush SDK, GamePush login/code overlay, public GamePush token, or GamePush provisioning path remains in the Pikabu build;
- the browser still talks only to the existing `/v1/session`, `/v1/profile`, and `/v1/leaderboards/:board` endpoints;
- an authorized Pikabu user can recover cloud progress on another device;
- Standard, Daily, Daily Streak, and Mastery leaderboards work through D1;
- the first official Daily result remains immutable and exact retries remain idempotent;
- backend/D1 failure never blocks local gameplay or local saves;
- no payment method is required by the project flow and no paid Cloudflare plan is enabled automatically.

## 2. Selected architecture

```text
Cascade browser
│
├── Pikabu SDK
│   ├── native auth
│   ├── id / name / avatar
│   ├── getSignedData()
│   ├── native ads
│   └── lifecycle
│
├── localStorage
│   └── immediate/offline profile + active game
│
└── HTTPS
    ↓
Cloudflare Worker (`cascade-api`)
│
├── verifies Pikabu HS256 signedData
├── issues short-lived bridge session JWT
├── preserves existing REST API
└── D1 binding `DB`
    ├── players
    ├── profiles
    ├── standard_scores
    ├── daily_results
    ├── daily_streak_scores
    └── mastery_scores
```

GamePush is removed from the Pikabu runtime path entirely. Yandex remains unchanged.

## 3. Browser contract

The browser contract stays unchanged:

```text
POST /v1/session
GET  /v1/profile
PUT  /v1/profile
GET  /v1/leaderboards/:board
POST /v1/leaderboards/:board
```

`BackendClient`, `CloudProfileService`, `BackendLeaderboards`, `CloudSyncCoordinator`, local pending queues, and offline behavior should require no protocol redesign.

### 3.1 Session

The client sends only:

```json
{ "signedData": "<pikabu jwt>" }
```

There is no `provisioning` field and no `PROVISIONING_REQUIRED` response.

The Worker:

1. verifies Pikabu `signedData` with `PIKABU_GAME_SECRET`;
2. requires `isAuthorized === true`;
3. upserts the verified public identity in D1 (`pikabu_id`, name, avatar);
4. issues a 30-minute bridge JWT signed with `BRIDGE_SESSION_SECRET`.

The bridge JWT uses the verified Pikabu ID as its account subject. No GamePush player ID exists in the claims.

### 3.2 Session refresh

The existing `BackendClient` retry-on-401 behavior remains. `BridgeSessionManager` becomes simpler: one Pikabu signed-data request, no GamePush SDK load and no second provisioning request.

## 4. Runtime-neutral storage boundary

Replace the GamePush-specific `GamePushBackend` dependency with a runtime-neutral `CascadeStore` interface under `server/cascade-api/`.

The business handler should depend only on operations such as:

- upsert verified player identity;
- read/write serialized cloud profile;
- read/submit Standard;
- read/submit Daily;
- read/submit Daily Streak;
- read/submit Mastery.

Cloudflare-specific SQL and `D1Database` binding access live under `server/cloudflare/`, not inside browser code and not scattered through route handlers.

## 5. D1 schema

Use one D1 database named `cascade-db` and binding `DB`.

### 5.1 `players`

```sql
pikabu_id   TEXT PRIMARY KEY
public_name TEXT NOT NULL
avatar_url  TEXT NOT NULL
created_at  INTEGER NOT NULL
updated_at  INTEGER NOT NULL
```

Every successful authorized `/v1/session` refreshes verified name/avatar.

### 5.2 `profiles`

```sql
pikabu_id    TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE
profile_json TEXT NOT NULL
updated_at   INTEGER NOT NULL
```

The JSON is the current normalized `CloudSnapshot` shape. Profile merge remains server-side via the existing `mergeCloudSnapshots({ base, local, cloud, todayId })` logic.

### 5.3 `standard_scores`

```sql
pikabu_id   TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE
best_streak INTEGER NOT NULL
updated_at  INTEGER NOT NULL
```

Submission is monotonic: `best_streak = max(existing, submitted)`.

Ordering: `best_streak DESC`, then deterministic stable tie-breakers.

### 5.4 `daily_results`

```sql
pikabu_id         TEXT NOT NULL REFERENCES players(pikabu_id) ON DELETE CASCADE
daily_id          TEXT NOT NULL
attempt_id        TEXT
moves             INTEGER NOT NULL
elapsed_ms        INTEGER NOT NULL
completed_on_time INTEGER NOT NULL
completed_at      INTEGER NOT NULL
PRIMARY KEY (pikabu_id, daily_id)
```

The primary key is the first-result receipt. The server uses `INSERT OR IGNORE` semantics:

- first row wins permanently;
- an exact retry of the same first result is treated as an idempotent success;
- any different later result returns `status: "replay"` and cannot replace the row.

Ordering for one `daily_id`: `moves ASC`, `elapsed_ms ASC`, `completed_at ASC`, then deterministic player-id tie-break.

Only the same first official result currently sent by the client is stored; replay/personal-best improvements never overwrite it.

### 5.5 `daily_streak_scores`

```sql
pikabu_id      TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE
current_streak INTEGER NOT NULL
best_streak    INTEGER NOT NULL
updated_at     INTEGER NOT NULL
```

The client does not authoritatively submit the numeric streak. The Worker keeps the existing behavior: derive current/best from the stored normalized profile using `getDailyStreaks()` and then store that derived metric.

Ordering: `current_streak DESC`, `best_streak DESC`, then deterministic tie-breakers.

### 5.6 `mastery_scores`

```sql
pikabu_id     TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE
mastery_rank  INTEGER NOT NULL
mastery_points INTEGER NOT NULL
updated_at    INTEGER NOT NULL
```

The Worker keeps deriving rank/points from the submitted normalized profile using the existing shared product logic. The browser cannot submit an arbitrary authoritative encoded score.

Ordering: `mastery_rank DESC`, `mastery_points DESC`, then deterministic tie-breakers.

### 5.7 Indexes

Add composite indexes matching each leaderboard order, especially `daily_id + moves + elapsed_ms + completed_at`, so top-list reads do not become full scans as the database grows.

## 6. Leaderboard response compatibility

Keep the existing backend response shape:

```ts
{
  entries: Array<{
    rank: number;
    playerId: string;
    publicName: string;
    avatarUrl?: string;
    metric: Record<string, number | string>;
  }>;
  playerEntry: ... | null;
}
```

`playerId` becomes the verified Pikabu ID string. Existing client UI treats it as an opaque string, so no UI redesign is needed.

Ranking semantics stay:

- Standard: higher `bestStreak` is better;
- Daily: fewer moves, then lower elapsed time, then earlier accepted completion;
- Daily Streak: higher current, then higher best;
- Mastery: higher rank, then higher lifetime points.

## 7. Client removal scope

Remove from the active Pikabu client:

- `src/platform/GamePushConfig.ts`;
- `src/platform/GamePushProvisioning.ts`;
- `BackendProvisioningAuth` / `BackendProvisioningProvider` interfaces;
- `backendProvisioning` from `PlatformServices`;
- GamePush provisioning tests;
- `VITE_GAMEPUSH_PROJECT_ID`;
- `VITE_GAMEPUSH_PUBLIC_TOKEN`;
- all GamePush SDK URLs and `window.onGPInit` code.

`src/platform/pikabu.ts` continues to use only Pikabu SDK + the backend bridge.

## 8. Cloudflare configuration

Worker secrets reduce from three to two:

```text
PIKABU_GAME_SECRET
BRIDGE_SESSION_SECRET
```

Remove:

```text
GAMEPUSH_API_SECRET
GAMEPUSH_PROJECT_ID
GAMEPUSH_API_URL
GAMEPUSH_LEADERBOARD_STANDARD_ID
GAMEPUSH_LEADERBOARD_DAILY_ID
GAMEPUSH_LEADERBOARD_DAILY_STREAK_ID
GAMEPUSH_LEADERBOARD_MASTERY_ID
```

Keep explicit CORS origins, including:

```text
http://localhost:5173
http://127.0.0.1:5173
https://games.pikabu.ru
```

Never use `*`.

The Worker env gains one D1 binding:

```text
DB -> cascade-db
```

## 9. Zero-manual-edit D1 setup

The patch should include a one-command setup script instead of asking the operator to edit a database UUID by hand.

Proposed command:

```powershell
pnpm backend:setup:d1
```

The script:

1. calls Wrangler to list D1 databases;
2. creates `cascade-db` if it does not exist;
3. obtains its database ID from Wrangler JSON output;
4. writes/updates the `DB` binding in `wrangler.jsonc` without touching secret values;
5. applies tracked SQL migrations to the remote database;
6. prints only non-secret success information.

It must be idempotent so rerunning it does not create duplicate databases or duplicate schema objects.

## 10. Migrations

Track schema in a normal D1 migrations directory, starting with one migration for the six tables and indexes.

Deployment order becomes:

```powershell
pnpm backend:setup:d1
pnpm backend:test
pnpm backend:build:cloudflare
pnpm backend:deploy:cloudflare
pnpm backend:smoke:cloudflare
```

The setup script is the only step that mutates `wrangler.jsonc` to insert the real D1 database ID.

## 11. Error handling and local-first behavior

D1/runtime failures return controlled backend errors without leaking SQL, secrets, signed Pikabu JWTs, or bridge JWTs.

The browser's existing local-first behavior remains authoritative for immediate play:

- local save happens first;
- failed profile/leaderboard operations remain retryable via existing queues;
- startup and gameplay remain usable when backend/D1 is unavailable.

If Workers Free / D1 Free daily limits are exceeded, queries fail until the limit resets; the project must not automatically switch to a paid plan.

## 12. Security invariants

- only server-verified Pikabu signed data establishes identity;
- no client-supplied account/player ID is trusted for writes;
- `PIKABU_GAME_SECRET` and `BRIDGE_SESSION_SECRET` remain Worker-only secrets;
- bridge session tokens stay memory-only in the browser;
- profile and leaderboard writes require a valid bridge session;
- guest leaderboard reads remain public;
- CORS remains exact-origin allowlisted;
- SQL uses bound parameters only;
- no GamePush admin secret or SDK remains in the Pikabu browser bundle.

## 13. Tests

Test-first implementation must cover at minimum:

1. `/v1/session` succeeds for a verified authorized Pikabu user on the first request without provisioning;
2. session code contains no `PROVISIONING_REQUIRED` path;
3. Pikabu platform initialization never loads GamePush scripts;
4. bridge session claims use verified Pikabu ID and refresh correctly;
5. profile GET/PUT preserves existing merge semantics;
6. Standard upsert never lowers best streak;
7. Daily first row is immutable;
8. exact Daily retry is idempotent;
9. different Daily replay returns `replay` and does not update the row;
10. Daily Streak is server-derived from stored profile;
11. Mastery is server-derived from normalized profile;
12. leaderboard top/player-entry ordering matches product rules;
13. D1 config contains one `DB` binding after setup and no GamePush runtime bindings;
14. browser build contains neither server secret names nor GamePush SDK/public token strings;
15. Yandex platform tests remain green.

## 14. Live verification

After implementation:

1. create/bind/migrate D1 with `pnpm backend:setup:d1`;
2. deploy Worker;
3. run non-mutating route/CORS smoke;
4. open real Pikabu test build;
5. authorize through Pikabu only;
6. confirm no GamePush modal/script appears;
7. verify first login creates D1 identity/profile state transparently;
8. reload and verify cloud profile survives;
9. verify all four leaderboards;
10. verify a Daily replay cannot replace the first accepted Daily row;
11. check Worker observability for consistent `1102` CPU-limit failures;
12. confirm local play still works with backend blocked.

## 15. Rollback

Before switching the Pikabu production build, keep the previous static build/tag available. D1 is a new persistence path; because the Pikabu release is still in test/pre-release acceptance, no production GamePush-to-D1 data migration is part of this change.

If D1/Worker proves unsuitable, replace only the backend storage adapter/hosting path; do not alter Pikabu identity, local save schema, or gameplay rules as part of rollback.

## 16. Out of scope

This change does not:

- alter Yandex saves, auth, leaderboards, ads, or SDK behavior;
- redesign Cascade gameplay/UI;
- add purchases or analytics storage;
- add KV/R2/Durable Objects/Queues;
- enable Workers Paid;
- add a custom Cloudflare domain;
- migrate historical test-only GamePush players/leaderboard rows into D1.
