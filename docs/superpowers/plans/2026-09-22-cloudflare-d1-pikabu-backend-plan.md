# Cloudflare D1 Pikabu Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pikabu GamePush persistence/provisioning path with Cloudflare D1 while keeping Pikabu as the only visible identity provider, preserving the existing browser REST API, local-first saves, Daily first-result semantics, all four leaderboards, and the Yandex path.

**Architecture:** Keep `server/cascade-api/` as the runtime-neutral business layer and replace its GamePush dependency with a typed `CascadeStore`. Implement that store with one Cloudflare D1 adapter under `server/cloudflare/`, bind it as `DB`, and keep the existing Worker REST routes. The Pikabu client posts only `signedData` to `/v1/session`; GamePush SDK/config/provisioning is removed entirely from the browser and active backend runtime.

**Tech Stack:** TypeScript 5.9, Phaser 4.2, Vite 7, Node 22 test runner, Cloudflare Workers, Cloudflare D1/SQLite, Wrangler 4.135.0, Pikabu Games SDK.

**Spec:** `docs/superpowers/specs/2026-09-22-cloudflare-d1-pikabu-backend-design.md`

## Global Constraints

- Pikabu remains the only visible identity/auth provider for the Pikabu build; no GamePush login, code dialog, SDK, public token, or provisioning path may remain in the browser bundle.
- Preserve the browser API exactly: `POST /v1/session`, `GET/PUT /v1/profile`, `GET/POST /v1/leaderboards/:board`.
- Preserve Yandex Games storage/auth/leaderboards/ads/dev tooling unchanged.
- Keep immediate/offline progress in local storage; backend/D1 failure must not block startup, gameplay, or local saves.
- Worker-only secrets are exactly `PIKABU_GAME_SECRET` and `BRIDGE_SESSION_SECRET`; never place them in `VITE_*`, committed values, logs, or browser responses.
- D1 database name is `cascade-db`; Worker binding is `DB`.
- CORS allowlist remains exactly `http://localhost:5173`, `http://127.0.0.1:5173`, and `https://games.pikabu.ru`; never use `*`.
- Standard is monotonic (`bestStreak` can only improve).
- Daily keeps the first accepted `(pikabu_id, daily_id)` result forever; an exact retry is idempotent and a different later result returns `status: "replay"` without replacement.
- Daily Streak and Mastery remain server-derived from normalized profile/product logic rather than trusting arbitrary numeric client scores.
- Do not add KV, R2, Durable Objects, Queues, paid Workers features, or a custom domain.
- `pnpm backend:setup:d1` must be rerunnable, must not print secrets, and must be the only automated step that inserts the real D1 database UUID into `wrangler.jsonc`.
- Keep Wrangler pinned to `4.135.0` for this migration.
- No production GamePush-to-D1 data migration is required because Pikabu is still in pre-release/test acceptance.

## Review Focus

- Repeated/concurrent `/v1/session` calls for the same verified Pikabu user must upsert one identity row and issue tokens whose subject is the Pikabu ID, never a GamePush numeric ID.
- Daily retry classification must distinguish the exact original result from a changed replay even when `attemptId` is absent/null, without comparing server-generated `completed_at`.
- Leaderboard ties must be deterministic and an authenticated `playerEntry` must still be returned when the player is outside the requested top N.
- Corrupt stored profile JSON and D1 runtime errors must fail closed with controlled messages; SQL text, signed Pikabu JWTs, bridge JWTs, and secret names must not leak.
- Rerunning `backend:setup:d1` against an existing `cascade-db` must preserve unrelated Wrangler config, leave exactly one `DB` binding, avoid creating a duplicate database, and reapply only unapplied migrations.

---

### Task 1: Add the runtime-neutral store contract, D1 schema, and D1 adapter

**Files:**
- Create: `server/cascade-api/store.ts`
- Create: `server/cloudflare/d1.ts`
- Create: `migrations/0000_cascade_backend.sql`
- Create: `tests/d1-store.test.ts`
- Create: `tests/d1-schema-contract.test.mjs`

**Interfaces:**
- Produces `CascadeStore`, consumed by `session.ts`, `profile.ts`, `leaderboards.ts`, and the Worker adapter in Task 2.
- Produces `D1CascadeStore`, consumed by `server/cloudflare/worker.ts` in Task 2.
- Produces minimal structural `D1DatabaseLike` / `D1PreparedStatementLike` types so the browser TypeScript build does not need a Cloudflare runtime package.

The store contract must be exactly product-oriented rather than SQL-oriented:

```ts
export interface VerifiedPlayerIdentity {
  readonly pikabuId: string;
  readonly publicName: string;
  readonly avatarUrl: string;
}

export interface StoredLeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly metric: Readonly<Record<string, number | string>>;
}

export interface StoredLeaderboardPage {
  readonly entries: readonly StoredLeaderboardEntry[];
  readonly playerEntry: StoredLeaderboardEntry | null;
}

export interface DailyResultInput {
  readonly dailyId: string;
  readonly attemptId?: string;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly completedOnTime: boolean;
  readonly completedAt: number;
}

export interface CascadeStore {
  upsertPlayer(identity: VerifiedPlayerIdentity, nowMs: number): Promise<void>;
  readProfile(pikabuId: string): Promise<string | null>;
  writeProfile(pikabuId: string, serialized: string, nowMs: number): Promise<void>;

  submitStandard(pikabuId: string, bestStreak: number, nowMs: number): Promise<void>;
  readStandard(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitDaily(pikabuId: string, result: DailyResultInput): Promise<'published' | 'replay'>;
  readDaily(dailyId: string, limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitDailyStreak(pikabuId: string, current: number, best: number, nowMs: number): Promise<void>;
  readDailyStreak(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;

  submitMastery(pikabuId: string, masteryRank: number, masteryPoints: number, nowMs: number): Promise<void>;
  readMastery(limit: number, pikabuId?: string): Promise<StoredLeaderboardPage>;
}
```

- [ ] **Step 1: Write failing schema and adapter tests**

Create `tests/d1-schema-contract.test.mjs` with source-level assertions that pin all six tables, primary keys, foreign keys, Daily uniqueness, and ranking indexes:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('migrations/0000_cascade_backend.sql', 'utf8');

test('D1 schema contains the six Cascade tables and immutable Daily key', () => {
  for (const table of [
    'players', 'profiles', 'standard_scores', 'daily_results',
    'daily_streak_scores', 'mastery_scores',
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'));

  assert.match(sql, /PRIMARY KEY\s*\(pikabu_id,\s*daily_id\)/i);
  assert.match(sql, /REFERENCES\s+players\s*\(pikabu_id\)\s+ON DELETE CASCADE/i);
  assert.match(sql, /daily_id\s*,\s*moves\s+ASC\s*,\s*elapsed_ms\s+ASC\s*,\s*completed_at\s+ASC/i);
});
```

Create `tests/d1-store.test.ts` with a small scripted fake D1 database. The fake only needs to record SQL/bind values and return queued `first/all/run` results. Pin these behaviors:

```ts
test('Standard upsert cannot lower best streak', async () => {
  const db = new ScriptedD1();
  const store = new D1CascadeStore(db);
  await store.submitStandard('p1', 7, 1000);
  const statement = db.statements.at(-1)!;
  assert.match(statement.sql, /MAX\s*\(standard_scores\.best_streak,\s*excluded\.best_streak\)/i);
  assert.deepEqual(statement.binds, ['p1', 7, 1000]);
});

test('Daily exact retry is published but a changed retry is replay', async () => {
  const db = new ScriptedD1();
  db.queueRun({ success: true });
  db.queueFirst({ attempt_id: null, moves: 44, elapsed_ms: 90000, completed_on_time: 1 });
  const store = new D1CascadeStore(db);
  assert.equal(await store.submitDaily('p1', {
    dailyId: '2026-09-20', moves: 44, elapsedMs: 90000,
    completedOnTime: true, completedAt: 1234,
  }), 'published');

  db.queueRun({ success: true });
  db.queueFirst({ attempt_id: null, moves: 45, elapsed_ms: 90000, completed_on_time: 1 });
  assert.equal(await store.submitDaily('p1', {
    dailyId: '2026-09-20', moves: 44, elapsedMs: 90000,
    completedOnTime: true, completedAt: 9999,
  }), 'replay');
});

test('player entry query ranks the full board before filtering one Pikabu id', async () => {
  const db = new ScriptedD1();
  db.queueAll([]);
  db.queueFirst(null);
  const store = new D1CascadeStore(db);
  await store.readStandard(20, 'outside-top');
  const playerQuery = db.statements.at(-1)!.sql;
  assert.match(playerQuery, /WITH\s+ranked\s+AS/i);
  assert.match(playerQuery, /ROW_NUMBER\(\)\s+OVER/i);
  assert.match(playerQuery, /WHERE\s+pikabu_id\s*=\s*\?/i);
});

test('ranking SQL uses deterministic product tie-breakers', async () => {
  const db = new ScriptedD1();
  const store = new D1CascadeStore(db);
  db.queueAll([]); await store.readStandard(20);
  assert.match(db.statements.at(-1)!.sql, /best_streak DESC,\s*updated_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readDaily('2026-09-20', 20);
  assert.match(db.statements.at(-1)!.sql, /moves ASC,\s*elapsed_ms ASC,\s*completed_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readDailyStreak(20);
  assert.match(db.statements.at(-1)!.sql, /current_streak DESC,\s*best_streak DESC,\s*updated_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readMastery(20);
  assert.match(db.statements.at(-1)!.sql, /mastery_rank DESC,\s*mastery_points DESC,\s*updated_at ASC,\s*[^,]*pikabu_id ASC/i);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/d1-store.test.ts tests/d1-schema-contract.test.mjs
```

Expected: FAIL because `server/cascade-api/store.ts`, `server/cloudflare/d1.ts`, and the migration do not exist.

- [ ] **Step 3: Add the D1 migration**

Create `migrations/0000_cascade_backend.sql` with this schema:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  pikabu_id TEXT PRIMARY KEY,
  public_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS standard_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  best_streak INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_results (
  pikabu_id TEXT NOT NULL REFERENCES players(pikabu_id) ON DELETE CASCADE,
  daily_id TEXT NOT NULL,
  attempt_id TEXT,
  moves INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  completed_on_time INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (pikabu_id, daily_id)
);

CREATE TABLE IF NOT EXISTS daily_streak_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery_scores (
  pikabu_id TEXT PRIMARY KEY REFERENCES players(pikabu_id) ON DELETE CASCADE,
  mastery_rank INTEGER NOT NULL,
  mastery_points INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_standard_rank
  ON standard_scores(best_streak DESC, updated_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_daily_rank
  ON daily_results(daily_id, moves ASC, elapsed_ms ASC, completed_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_daily_streak_rank
  ON daily_streak_scores(current_streak DESC, best_streak DESC, updated_at ASC, pikabu_id ASC);
CREATE INDEX IF NOT EXISTS idx_mastery_rank
  ON mastery_scores(mastery_rank DESC, mastery_points DESC, updated_at ASC, pikabu_id ASC);
```

- [ ] **Step 4: Implement `CascadeStore` and minimal D1 structural types**

Create `server/cascade-api/store.ts` using the exact interfaces above.

In `server/cloudflare/d1.ts`, define only the runtime surface Cascade needs:

```ts
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
}
```

Do not add `@cloudflare/workers-types` or any browser runtime dependency.

- [ ] **Step 5: Implement `D1CascadeStore` with bound SQL only**

Use `?` placeholders for every value. Critical write statements must be:

```sql
INSERT INTO players (pikabu_id, public_name, avatar_url, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  public_name = excluded.public_name,
  avatar_url = excluded.avatar_url,
  updated_at = excluded.updated_at
```

```sql
INSERT INTO profiles (pikabu_id, profile_json, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  profile_json = excluded.profile_json,
  updated_at = excluded.updated_at
```

```sql
INSERT INTO standard_scores (pikabu_id, best_streak, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(pikabu_id) DO UPDATE SET
  best_streak = MAX(standard_scores.best_streak, excluded.best_streak),
  updated_at = CASE
    WHEN excluded.best_streak > standard_scores.best_streak THEN excluded.updated_at
    ELSE standard_scores.updated_at
  END
```

Daily must execute `INSERT OR IGNORE`, then read the winning row and compare only `attempt_id`, `moves`, `elapsed_ms`, and `completed_on_time`. `completed_at` is server-generated ordering metadata and must not participate in exact-retry equality.

Leaderboard reads must use a ranked CTE so `playerEntry.rank` is the global rank even when outside top N. Use these exact orderings:

```text
standard:     best_streak DESC, updated_at ASC, pikabu_id ASC
daily:        moves ASC, elapsed_ms ASC, completed_at ASC, pikabu_id ASC
daily-streak: current_streak DESC, best_streak DESC, updated_at ASC, pikabu_id ASC
mastery:      mastery_rank DESC, mastery_points DESC, updated_at ASC, pikabu_id ASC
```

Map joined `players.public_name/avatar_url` into `StoredLeaderboardEntry` and expose product metrics using the existing keys:

```text
standard:     { bestStreak }
daily:        { dailyId, moves, elapsedMs }
daily-streak: { current, best }
mastery:      { rank: <rank name is added by business layer in Task 2>, points }
```

For the D1 adapter itself, return Mastery numeric data under `{ masteryRank, masteryPoints }`; Task 2 converts ordinal to the existing public `{ rank, points }` shape.

- [ ] **Step 6: Run D1 tests and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/d1-store.test.ts tests/d1-schema-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/cascade-api/store.ts server/cloudflare/d1.ts migrations/0000_cascade_backend.sql tests/d1-store.test.ts tests/d1-schema-contract.test.mjs
git commit -m "feat: add D1 Cascade store"
```

---

### Task 2: Switch the bridge business layer and Worker runtime from GamePush to D1

**Files:**
- Modify: `server/cascade-api/session.ts`
- Modify: `server/cascade-api/profile.ts`
- Modify: `server/cascade-api/leaderboards.ts`
- Modify: `server/cascade-api/handler.ts`
- Modify: `server/cloudflare/config.ts`
- Modify: `server/cloudflare/worker.ts`
- Modify: `tests/bridge-session.test.ts`
- Modify: `tests/backend-leaderboard-contract.test.ts`
- Rename: `tests/gamepush-profile-contract.test.ts` -> `tests/d1-profile-contract.test.ts`
- Rename: `tests/gamepush-leaderboard-contract.test.ts` -> `tests/d1-leaderboard-contract.test.ts`
- Modify: `tests/cloudflare-runtime-config.test.ts`
- Modify: `tests/cloudflare-worker.test.ts`

**Interfaces:**
- Consumes: `CascadeStore`, `D1CascadeStore`, `D1DatabaseLike` from Task 1.
- Produces: a provider-neutral handler whose account key is `BridgeClaims.pikabuId` and a Worker that builds `D1CascadeStore(env.DB)`.
- `BridgeClaims` becomes `{ pikabuId, name, avatar, issuedAt, expiresAt }`; `gamePushPlayerId` is removed everywhere.

- [ ] **Step 1: Rename the two backend contract tests and rewrite bridge-session tests first**

Run:

```bash
git mv tests/gamepush-profile-contract.test.ts tests/d1-profile-contract.test.ts
git mv tests/gamepush-leaderboard-contract.test.ts tests/d1-leaderboard-contract.test.ts
```

Then replace the GamePush fake in `tests/bridge-session.test.ts` with a minimal `FakeStore implements CascadeStore`. Pin first-request success and Pikabu-subject claims:

```ts
test('first authorized Pikabu session upserts identity and succeeds without provisioning', async () => {
  const store = new FakeStore();
  const session = await establishBridgeSession(
    { signedData: signPikabu({ id: 'pikabu-42', name: 'Ada', avatar: 'ada.png', isAuthorized: true }) },
    { pikabuSecret: 'pikabu-secret', bridgeSecret: 'bridge-secret', store, nowSeconds: () => 100 },
  );
  assert.deepEqual(store.identities, [{
    pikabuId: 'pikabu-42', publicName: 'Ada', avatarUrl: 'ada.png', nowMs: 100_000,
  }]);
  assert.equal(session.claims.pikabuId, 'pikabu-42');
  assert.equal('gamePushPlayerId' in session.claims, false);
});

test('bridge JWT subject is verified Pikabu id', async () => {
  const signed = await signBridgeSession(
    { pikabuId: 'pikabu-42', name: 'Ada', avatar: '' }, 'bridge-secret', 100,
  );
  const payload = JSON.parse(Buffer.from(signed.token.split('.')[1]!, 'base64url').toString('utf8'));
  assert.equal(payload.sub, 'pikabu-42');
  assert.equal(payload.pid, 'pikabu-42');
  assert.equal(typeof payload.sub, 'string');
});
```

Add a source assertion that `server/cascade-api/session.ts` contains neither `PROVISIONING_REQUIRED` nor `GamePush`.

- [ ] **Step 2: Rewrite profile/leaderboard contract tests to `CascadeStore` and run RED**

The handler contract test must assert:

```ts
assert.match(handler, /dependencies\.store/);
assert.doesNotMatch(handler, /dependencies\.gamePush|GamePushBackend|gamePushPlayerId/);
```

The Daily contract test must assert that submission delegates to `store.submitDaily(...)` and returns its `published/replay` status; there must be no Unique Value receipt logic.

Run:

```bash
node --test --experimental-strip-types tests/bridge-session.test.ts tests/backend-leaderboard-contract.test.ts tests/d1-profile-contract.test.ts tests/d1-leaderboard-contract.test.ts tests/cloudflare-runtime-config.test.ts tests/cloudflare-worker.test.ts
```

Expected: FAIL on the old GamePush dependencies and provisioning flow.

The RED profile tests must also pin controlled failure behavior:

```ts
test('malformed stored profile returns provider-neutral 502 without stored payload', async () => {
  const store = new FakeStore();
  store.profile = '{not-json';
  await assert.rejects(
    async () => handleGetProfile('pikabu-42', store),
    (error: unknown) => error instanceof HttpError
      && error.status === 502
      && error.message === 'Stored cloud profile is malformed.'
      && !error.message.includes('{not-json'),
  );
});

test('unexpected D1 error becomes generic handler 500', async () => {
  const store = new FakeStore();
  store.readProfileError = new Error('SQL SELECT profiles secret detail');
  const handler = createCascadeHandler({
    store, pikabuSecret: 'pikabu-secret', bridgeSecret: 'bridge-secret',
    allowedOrigins: 'https://allowed.example',
  });
  const response = await handler(authenticatedProfileRequest());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error.' });
});
```

- [ ] **Step 3: Simplify session parsing/signing to Pikabu-only identity**

`SessionRequestBody` becomes:

```ts
export interface SessionRequestBody {
  readonly signedData: string;
}
```

`SessionDependencies` becomes:

```ts
export interface SessionDependencies {
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly store: CascadeStore;
  readonly nowSeconds?: () => number;
}
```

`signBridgeSession()` signs:

```ts
{
  iss: 'cascade-bridge',
  aud: 'cascade-pikabu',
  sub: identity.pikabuId,
  pid: identity.pikabuId,
  name: identity.name,
  avatar: identity.avatar,
  iat: nowSeconds,
  exp: nowSeconds + 30 * 60,
}
```

`verifyBridgeSession()` requires string `sub`, string `pid`, and `sub === pid`. `establishBridgeSession()` verifies Pikabu `signedData`, calls:

```ts
await dependencies.store.upsertPlayer({
  pikabuId: player.id,
  publicName: player.name ?? '',
  avatarUrl: player.avatar ?? '',
}, now * 1000);
```

Then it immediately issues a bridge token. Delete `ProvisioningRequiredError`, provisioning parsing, mapping lookup, platform-auth resolution, and the 409 response.

- [ ] **Step 4: Convert profile handlers to `CascadeStore`**

Change signatures to:

```ts
handleGetProfile(pikabuId: string, store: CascadeStore): Promise<Response>
handlePutProfile(request: Request, pikabuId: string, store: CascadeStore, now?: Date): Promise<Response>
```

Keep the existing `normalizeCloudSnapshot()` + `mergeCloudSnapshots({ base, local, cloud, todayId })` behavior. Replace GamePush-specific malformed-profile text with the provider-neutral message:

```text
Stored cloud profile is malformed.
```

On successful merge call:

```ts
await store.writeProfile(pikabuId, JSON.stringify(merged), now.getTime());
```

Do not add a read-after-write check.

- [ ] **Step 5: Convert all four leaderboard handlers to typed store operations**

Reads delegate directly by board:

```ts
standard     -> store.readStandard(limit, claims?.pikabuId)
daily        -> store.readDaily(scopeDailyId, limit, claims?.pikabuId)
daily-streak -> store.readDailyStreak(limit, claims?.pikabuId)
mastery      -> store.readMastery(limit, claims?.pikabuId)
```

Preserve the existing response shape `{ entries, playerEntry }` and public-read/authenticated-player-entry split.

Submissions remain validated by `parseLeaderboardSubmitBody()` and then:

```ts
if (parsed.kind === 'standard') {
  await store.submitStandard(claims.pikabuId, parsed.bestStreak, now.getTime());
  return jsonResponse({ status: 'published' });
}

if (parsed.kind === 'daily') {
  const status = await store.submitDaily(claims.pikabuId, {
    dailyId: parsed.dailyId,
    ...(parsed.attemptId === undefined ? {} : { attemptId: parsed.attemptId }),
    moves: parsed.moves,
    elapsedMs: parsed.elapsedMs,
    completedOnTime: parsed.completedOnTime,
    completedAt: now.getTime(),
  });
  return jsonResponse({ status });
}
```

For Daily Streak, read `store.readProfile(claims.pikabuId)`, normalize the snapshot, derive with `getDailyStreaks()`, then `submitDailyStreak()`.

For Mastery, normalize submitted profile, derive existing `masteryRank` ordinal + `lifetimeMasteryPoints()`, then `submitMastery()`.

Before returning Mastery reads, convert stored numeric ordinal `1..6` to existing rank strings `novice|player|tactician|expert|master|grandmaster`, preserving the current browser response contract.

- [ ] **Step 6: Switch handler and Cloudflare runtime wiring to `store`**

`CascadeHandlerDependencies` becomes:

```ts
export interface CascadeHandlerDependencies {
  readonly store: CascadeStore;
  readonly pikabuSecret: string;
  readonly bridgeSecret: string;
  readonly allowedOrigins: string;
  readonly limiter?: FixedWindowRateLimiter;
}
```

All account-scoped routes use `claims.pikabuId`.

`CloudflareEnv` becomes:

```ts
export interface CloudflareEnv {
  readonly DB?: D1DatabaseLike;
  readonly PIKABU_GAME_SECRET?: string;
  readonly BRIDGE_SESSION_SECRET?: string;
  readonly CASCADE_ALLOWED_ORIGINS?: string;
}
```

`CloudflareRuntimeConfig` contains only `pikabuSecret`, `bridgeSecret`, and `allowedOrigins`. Validate `DB` separately in `buildRuntime`; missing DB must throw before handler creation and remain hidden behind the Worker's generic 500.

Build the runtime as:

```ts
const config = loadCloudflareRuntimeConfig(env);
if (!env.DB) throw new Error('DB is required.');
const store = new D1CascadeStore(env.DB);
return createCascadeHandler({
  store,
  pikabuSecret: config.pikabuSecret,
  bridgeSecret: config.bridgeSecret,
  allowedOrigins: config.allowedOrigins,
});
```

- [ ] **Step 7: Run focused server/Worker tests and then the full current suite**

Run:

```bash
node --test --experimental-strip-types tests/bridge-session.test.ts tests/backend-validation.test.ts tests/backend-leaderboard-contract.test.ts tests/d1-profile-contract.test.ts tests/d1-leaderboard-contract.test.ts tests/d1-store.test.ts tests/cloudflare-runtime-config.test.ts tests/cloudflare-worker.test.ts
pnpm test
pnpm build
```

Expected: all PASS. GamePush source/tests may still exist but are no longer referenced by the active Worker path; cleanup is Task 5.

- [ ] **Step 8: Commit**

```bash
git add -A server/cascade-api server/cloudflare tests/bridge-session.test.ts tests/backend-leaderboard-contract.test.ts tests/d1-profile-contract.test.ts tests/d1-leaderboard-contract.test.ts tests/gamepush-profile-contract.test.ts tests/gamepush-leaderboard-contract.test.ts tests/cloudflare-runtime-config.test.ts tests/cloudflare-worker.test.ts
git commit -m "refactor: switch Pikabu bridge to D1 store"
```

---

### Task 3: Remove GamePush provisioning from the Pikabu browser path

**Files:**
- Modify: `src/backend/BridgeSessionManager.ts`
- Modify: `src/platform/pikabu.ts`
- Modify: `src/platform/services.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.pikabu.example`
- Modify: `.github/workflows/deploy-pikabu.yml`
- Modify: `tests/bridge-session-manager.test.ts`
- Modify: `tests/pikabu-platform.test.ts`
- Modify: `tests/pikabu-build-paths.test.ts`
- Delete: `src/platform/GamePushConfig.ts`
- Delete: `src/platform/GamePushProvisioning.ts`
- Delete: `tests/gamepush-provisioning.test.ts`

**Interfaces:**
- `BridgeSessionManager` constructor becomes `{ baseUrl, identity, fetchImpl?, nowMs? }`; the `provisioning` option is removed.
- `PlatformServices` keeps `backendIdentity` and `backendSession`, but removes `backendProvisioning` and the provisioning interfaces.

- [ ] **Step 1: Rewrite client session tests to require exactly one `/v1/session` request**

In `tests/bridge-session-manager.test.ts`, replace provisioning cases with:

```ts
test('session bootstrap sends only Pikabu signedData once', async () => {
  const bodies: unknown[] = [];
  const manager = new BridgeSessionManager({
    baseUrl: 'https://api.example',
    identity,
    nowMs: () => 1000,
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return response({ token: 'bridge-token', expiresAtMs: 100_000 });
    },
  });
  assert.equal(await manager.getToken(), 'bridge-token');
  assert.deepEqual(bodies, [{ signedData: 'signed-token' }]);
});

test('409 is a normal session failure and never loads a second provider', async () => {
  let calls = 0;
  const manager = new BridgeSessionManager({
    baseUrl: 'https://api.example', identity,
    fetchImpl: async () => { calls += 1; return response({ error: 'conflict' }, 409); },
  });
  await assert.rejects(() => manager.getToken(), /status 409/);
  assert.equal(calls, 1);
});
```

Add a source contract that `BridgeSessionManager.ts` and `pikabu.ts` contain no `GamePush`, `PROVISIONING_REQUIRED`, `backendProvisioning`, `game-score`, or `onGPInit` strings.

- [ ] **Step 2: Run client tests and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/bridge-session-manager.test.ts tests/pikabu-platform.test.ts tests/pikabu-build-paths.test.ts
```

Expected: FAIL because the current code still constructs GamePush provisioning.

- [ ] **Step 3: Simplify `BridgeSessionManager`**

Remove `BackendProvisioningProvider`, the `provisioning` field, 409-code inspection, and second POST. `bootstrap()` becomes one assertion + one request:

```ts
private async bootstrap(): Promise<string> {
  const assertion = await this.identity.getAssertion();
  if (assertion === null || assertion.provider !== 'pikabu' || !assertion.value) {
    throw new Error('Pikabu identity assertion is required.');
  }
  const result = await this.postSession({ signedData: assertion.value });
  if (!result.response.ok) {
    throw new Error(`Bridge session request failed with status ${result.response.status}.`);
  }
  return this.acceptSession(result.body);
}
```

Keep concurrent-call coalescing, memory-only caching, refresh headroom, and `invalidate()` behavior unchanged.

- [ ] **Step 4: Remove provisioning from platform services and Pikabu wiring**

Delete these interfaces from `services.ts`:

```ts
BackendProvisioningAuth
BackendProvisioningProvider
```

Delete `backendProvisioning?: ...` from `PlatformServices`.

In `pikabu.ts`, remove the GamePush provisioning import/creation and construct the session with only:

```ts
new BridgeSessionManager({ baseUrl: backendUrl, identity: backendIdentity })
```

Return only `backendIdentity` and `backendSession` on the backend side of `PlatformServices`.

- [ ] **Step 5: Remove browser GamePush configuration**

Delete `VITE_GAMEPUSH_PROJECT_ID` and `VITE_GAMEPUSH_PUBLIC_TOKEN` from:

```text
src/vite-env.d.ts
.env.pikabu.example
.github/workflows/deploy-pikabu.yml
```

`.env.pikabu.example` becomes:

```env
# Public browser configuration only. Never put Pikabu/bridge server secrets in VITE_* variables.
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://cascade-api.<account-subdomain>.workers.dev
```

The `Build Pikabu` workflow env must contain only:

```yaml
env:
  VITE_PLATFORM_TARGET: pikabu
  VITE_BACKEND_URL: ${{ vars.PIKABU_BACKEND_URL }}
```

- [ ] **Step 6: Delete client GamePush provisioning modules/tests and run GREEN**

Delete the three files listed above, then run:

```bash
node --test --experimental-strip-types tests/bridge-session-manager.test.ts tests/pikabu-platform.test.ts tests/pikabu-build-paths.test.ts tests/platform-target.test.ts
pnpm test
pnpm build:pikabu
```

Expected: PASS and no GamePush login/provisioning code is reachable from the Pikabu client.

- [ ] **Step 7: Commit**

```bash
git add -A src/backend/BridgeSessionManager.ts src/platform src/vite-env.d.ts .env.pikabu.example .github/workflows/deploy-pikabu.yml tests/bridge-session-manager.test.ts tests/pikabu-platform.test.ts tests/pikabu-build-paths.test.ts tests/gamepush-provisioning.test.ts
git commit -m "refactor: remove GamePush from Pikabu client"
```

---

### Task 4: Add idempotent one-command D1 provisioning and Wrangler binding setup

**Files:**
- Create: `scripts/setup-cloudflare-d1.mjs`
- Create: `tests/d1-setup-script.test.mjs`
- Modify: `package.json`
- Modify: `wrangler.jsonc`
- Modify: `tests/cloudflare-wrangler-config.test.mjs`
- Modify: `tests/cloudflare-security-contract.test.mjs`

**Interfaces:**
- Produces operator command `pnpm backend:setup:d1`.
- `wrangler.jsonc` after the command contains exactly one `d1_databases` entry with `binding: "DB"`, `database_name: "cascade-db"`, the real UUID, and `migrations_dir: "migrations"`.

Cloudflare's current Wrangler contract used by this plan is:

```text
wrangler d1 list --json
wrangler d1 create cascade-db
wrangler d1 migrations apply cascade-db --remote
```

- [ ] **Step 1: Write failing setup-script tests with an injected Wrangler runner**

Export pure/testable functions from the script and guard `main()` so importing it does not execute Cloudflare commands.

Test the complete existing-database path:

```js
test('setup reuses existing cascade-db and writes one DB binding', async () => {
  const calls = [];
  const config = {
    name: 'cascade-api',
    vars: { CASCADE_ALLOWED_ORIGINS: 'http://localhost:5173' },
    d1_databases: [{ binding: 'OLD', database_name: 'other-db', database_id: 'other' }],
  };
  const runner = async (args) => {
    calls.push(args);
    if (args.join(' ') === 'd1 list --json') return JSON.stringify([{ name: 'cascade-db', uuid: 'db-uuid' }]);
    if (args.join(' ') === 'd1 migrations apply cascade-db --remote') return '';
    throw new Error(`unexpected: ${args.join(' ')}`);
  };
  const result = await setupD1({ config, runWrangler: runner });
  assert.equal(calls.some((args) => args.includes('create')), false);
  assert.deepEqual(result.d1_databases.filter((x) => x.binding === 'DB'), [{
    binding: 'DB', database_name: 'cascade-db', database_id: 'db-uuid', migrations_dir: 'migrations',
  }]);
  assert.deepEqual(result.vars, config.vars);
});
```

Test the create path by returning `[]` on the first list, accepting `d1 create cascade-db`, then returning the database on the second list. Assert a second invocation never calls `create`.

Also test tolerant ID extraction from `uuid`, `id`, or `database_id`, because Wrangler JSON field naming has changed across versions.

- [ ] **Step 2: Run setup tests and verify RED**

Run:

```bash
node --test tests/d1-setup-script.test.mjs tests/cloudflare-wrangler-config.test.mjs tests/cloudflare-security-contract.test.mjs
```

Expected: FAIL because the setup script and D1 config contract do not exist and Wrangler still contains GamePush runtime bindings.

- [ ] **Step 3: Implement `scripts/setup-cloudflare-d1.mjs`**

Use fixed constants:

```js
const WRANGLER = 'wrangler@4.135.0';
const DATABASE_NAME = 'cascade-db';
const BINDING = 'DB';
```

The real runner must execute `pnpm dlx wrangler@4.135.0 ...`; on Windows use `shell: true` only for the fixed command/argument list so `pnpm.cmd` works. Never pass secret values to this process.

`setupD1()` algorithm:

```text
1. run `d1 list --json` and parse an array;
2. find name === `cascade-db`;
3. if missing, run `d1 create cascade-db`, then run `d1 list --json` again;
4. extract UUID from `uuid ?? id ?? database_id`; fail if missing/empty;
5. replace only any existing binding named `DB`; preserve every unrelated top-level field, var, and other D1 binding;
6. write `{ binding: "DB", database_name: "cascade-db", database_id: <uuid>, migrations_dir: "migrations" }`;
7. run `d1 migrations apply cascade-db --remote`;
8. print database name/binding and success only, never environment values.
```

Parse the current `wrangler.jsonc` with `JSON.parse`; this repository's file is valid JSON despite the `.jsonc` extension. Write it back using `JSON.stringify(config, null, 2) + '\n'`.

- [ ] **Step 4: Update package scripts and source Wrangler config**

Add:

```json
"backend:setup:d1": "node scripts/setup-cloudflare-d1.mjs"
```

Remove all GamePush Worker vars from `wrangler.jsonc`. Its committed pre-setup state must keep only:

```json
"secrets": {
  "required": ["PIKABU_GAME_SECRET", "BRIDGE_SESSION_SECRET"]
},
"vars": {
  "CASCADE_ALLOWED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173,https://games.pikabu.ru"
}
```

Do not commit a fake D1 UUID. `backend:setup:d1` inserts `d1_databases` locally before deploy.

Update `cloudflare-wrangler-config.test.mjs` to reject `GAMEPUSH_` config and assert the two required secret names + exact CORS allowlist + `backend:setup:d1` script.

Update `cloudflare-security-contract.test.mjs` to reject `GAMEPUSH_API_SECRET`, GamePush API URLs, GamePush SDK URLs, and public GamePush token strings from active `server/`, `src/platform/pikabu.ts`, `src/backend/BridgeSessionManager.ts`, `.env.pikabu.example`, and the Pikabu workflow.

- [ ] **Step 5: Run tests and local dry build**

Run:

```bash
node --test tests/d1-setup-script.test.mjs tests/cloudflare-wrangler-config.test.mjs tests/cloudflare-security-contract.test.mjs
pnpm backend:build:cloudflare
```

Expected: PASS. The dry Worker bundle may be built before a real D1 UUID exists; live deploy remains gated on `pnpm backend:setup:d1`.

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-cloudflare-d1.mjs tests/d1-setup-script.test.mjs package.json wrangler.jsonc tests/cloudflare-wrangler-config.test.mjs tests/cloudflare-security-contract.test.mjs
git commit -m "feat: add D1 setup command"
```

---

### Task 5: Remove active GamePush backend/tooling and rewrite active docs for D1

**Files:**
- Delete: `server/cascade-api/gamepush.ts`
- Delete: `scripts/gamepush-smoke.mjs`
- Delete: `scripts/gamepush-contract-introspection.ps1`
- Delete: `docs/contracts/gamepush-server-api-30632.json`
- Delete: `tests/gamepush-backend.test.ts`
- Delete: `tests/gamepush-smoke-script.test.mjs`
- Delete: `docs/GAMEPUSH_PIKABU_RELEASE_CHECKLIST.md`
- Create: `docs/D1_PIKABU_RELEASE_CHECKLIST.md`
- Modify: `package.json`
- Modify: `tests/backend-runtime-location.test.mjs`
- Modify: `tests/cloudflare-deployment-docs.test.mjs`
- Modify: `docs/PIKABU_BACKEND_SETUP.md`
- Modify: `docs/PIKABU_HOSTING.md`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Modify: `PATCH_NOTES.md`

**Interfaces:**
- Active Pikabu backend/runtime docs and tests now describe only Pikabu SDK -> Cloudflare Worker -> D1.
- Historical design/spec files under `docs/superpowers/` remain untouched.

- [ ] **Step 1: Write the cleanup/doc contract tests before deleting files**

Update `tests/backend-runtime-location.test.mjs` so the runtime-neutral module list contains:

```js
['auth.ts', 'http.ts', 'leaderboards.ts', 'profile.ts', 'session.ts', 'store.ts', 'validation.ts', 'handler.ts']
```

Assert `server/cascade-api/gamepush.ts` does not exist.

Rewrite `tests/cloudflare-deployment-docs.test.mjs` to require these fragments in active docs:

```text
pnpm dlx wrangler@4.135.0 login
pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET
pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET
pnpm backend:setup:d1
pnpm backend:build:cloudflare
pnpm backend:deploy:cloudflare
pnpm backend:smoke:cloudflare
cascade-db
workers.dev
1102
```

And reject:

```text
GAMEPUSH_API_SECRET
GAMEPUSH_PROJECT_ID
pnpm gamepush:smoke
GamePush Server API
hidden first-login provisioning
```

- [ ] **Step 2: Run the doc/runtime tests and verify RED**

Run:

```bash
node --test tests/backend-runtime-location.test.mjs tests/cloudflare-deployment-docs.test.mjs
```

Expected: FAIL because active GamePush artifacts/docs still exist.

- [ ] **Step 3: Remove GamePush runtime/tooling and update `backend:test`**

Delete every file listed above. Remove the `gamepush:smoke` package script and remove `tests/gamepush-*.test.*` from `backend:test`.

Set `backend:test` to cover the active backend only:

```json
"backend:test": "node --test --experimental-strip-types tests/cloudflare-*.test.ts tests/cloudflare-*.test.mjs tests/backend-*.test.ts tests/backend-*.test.mjs tests/bridge-session.test.ts tests/d1-*.test.ts tests/pikabu-signed-data.test.ts"
```

- [ ] **Step 4: Rewrite active operator docs to the exact D1 release flow**

`docs/PIKABU_BACKEND_SETUP.md` must explain this order:

```powershell
pnpm dlx wrangler@4.135.0 login
pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET
pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET
pnpm backend:setup:d1
pnpm backend:test
pnpm backend:build:cloudflare
pnpm backend:deploy:cloudflare
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.<actual-subdomain>.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='https://games.pikabu.ru'
pnpm backend:smoke:cloudflare
```

State explicitly:

```text
- D1 database: cascade-db, binding DB.
- No payment method is part of this project setup and no paid plan is enabled automatically.
- Free-limit exhaustion is handled as backend unavailability; local play/save continues.
- Repeated Worker error 1102 is a release blocker; do not automatically switch to Workers Paid.
```

`docs/PIKABU_HOSTING.md` must keep GitVerse as static hosting and say persistence lives in D1 rather than GamePush.

Create `docs/D1_PIKABU_RELEASE_CHECKLIST.md` with the live acceptance sequence from the spec: Pikabu-only auth, no GamePush script/modal, profile survives reload/second browser, four leaderboards, Daily replay immutable, backend-blocked local play, Worker `1102` check.

Update `CURRENT_STATE.md`, `TECH.md`, and `PATCH_NOTES.md` to state Cloudflare Worker + D1 and remove active claims that GamePush owns Pikabu persistence/mapping/leaderboards.

- [ ] **Step 5: Run doc/runtime/full tests and builds**

Run:

```bash
node --test tests/backend-runtime-location.test.mjs tests/cloudflare-deployment-docs.test.mjs
pnpm backend:test
pnpm test
pnpm build
pnpm build:pikabu
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A server/cascade-api scripts docs package.json tests CURRENT_STATE.md TECH.md PATCH_NOTES.md
git commit -m "chore: remove GamePush Pikabu runtime"
```

---

### Task 6: Add final artifact guards and complete local release verification

**Files:**
- Create: `tests/pikabu-no-gamepush-artifact.test.mjs`
- Modify: `docs/D1_PIKABU_RELEASE_CHECKLIST.md` with the exact commands confirmed by the final implementation

**Interfaces:**
- Produces the final release gate: browser bundle contains Worker URL/public Pikabu code only; no GamePush/browser provisioning or server secret strings.

- [ ] **Step 1: Add a build-artifact regression test**

The test must scan built JS only when `dist/assets` exists and otherwise skip with a clear reason. After `pnpm build:pikabu`, it must reject these strings:

```text
GamePush
game-score.js
onGPInit
VITE_GAMEPUSH_PUBLIC_TOKEN
VITE_GAMEPUSH_PROJECT_ID
GAMEPUSH_API_SECRET
PIKABU_GAME_SECRET
BRIDGE_SESSION_SECRET
PROVISIONING_REQUIRED
```

And require the configured public Worker URL when `VITE_BACKEND_URL` is supplied to the build.

A source-level companion assertion must always run and reject `GamePushProvisioning`, `GamePushConfig`, `backendProvisioning`, `game-score.js`, and `onGPInit` from active Pikabu client files.

- [ ] **Step 2: Run the artifact test against an old/pre-fix build and verify RED if one is present**

Run after intentionally using the current old Pikabu build, if `dist/` still contains it:

```bash
node --test tests/pikabu-no-gamepush-artifact.test.mjs
```

Expected before rebuilding: FAIL if the old GamePush provisioning bundle is still present; otherwise the source-level assertions must still prove the guard is active.

- [ ] **Step 3: Build the final Pikabu artifact with the deployed Worker URL and verify GREEN**

Run:

```powershell
$env:VITE_PLATFORM_TARGET='pikabu'
$env:VITE_BACKEND_URL='https://cascade-api.rpill-games.workers.dev'
pnpm build:pikabu
node --test tests/pikabu-no-gamepush-artifact.test.mjs
```

Expected: PASS; the bundle contains the Worker URL and none of the forbidden GamePush/server-secret strings.

- [ ] **Step 4: Run the complete local verification matrix**

Run:

```bash
pnpm test
pnpm build
pnpm build:pikabu
pnpm backend:test
pnpm backend:build:cloudflare
```

Expected: all commands exit 0. The existing Vite chunk-size warning is non-blocking.

- [ ] **Step 5: Commit the release guards**

```bash
git add tests/pikabu-no-gamepush-artifact.test.mjs docs/D1_PIKABU_RELEASE_CHECKLIST.md
git commit -m "test: gate Pikabu D1 release"
```

---

## Live Cloudflare/Pikabu Acceptance After the Code Patch Is Applied

These are operator steps, not unit-test substitutions. Do not mark release complete until each one is observed on the real account/environment.

1. Confirm Wrangler authentication (run this command; if the browser reports that the existing session is already authenticated, continue):

```powershell
pnpm dlx wrangler@4.135.0 login
```

2. Keep/set only the two active Worker secrets:

```powershell
pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET
pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET
```

3. Create/reuse/bind/migrate D1 with no manual UUID editing:

```powershell
pnpm backend:setup:d1
```

Expected: one `cascade-db` is reused/created, `wrangler.jsonc` receives one real `DB` binding, migrations apply successfully, and no secret values print.

4. Deploy and run the non-mutating smoke:

```powershell
pnpm backend:deploy:cloudflare
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.rpill-games.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='https://games.pikabu.ru'
pnpm backend:smoke:cloudflare
```

5. Trigger the Pikabu GitHub/GitVerse deployment with the next `pikabu-*` tag after the final commit. The action must build using repository variable `PIKABU_BACKEND_URL=https://cascade-api.rpill-games.workers.dev` and no GamePush env values.

6. In the real Pikabu test environment verify, in order:
   - game opens as guest and local save works;
   - Pikabu authorization is the only auth UI shown;
   - Network contains no GamePush SDK requests and no GamePush code/login modal appears;
   - first `/v1/session` returns 200 directly, never `PROVISIONING_REQUIRED`;
   - profile sync survives reload;
   - same Pikabu account in a second browser/profile receives the same D1 cloud state;
   - Standard, Daily, Daily Streak, and Mastery reads/submissions work;
   - replaying the same Daily cannot replace the first accepted row;
   - blocking the Worker leaves gameplay/local save functional and queued work retries when restored.

7. While exercising authenticated traffic, inspect Worker logs/observability. Consistent Cloudflare `1102` CPU-limit errors block release; do not enable Workers Paid automatically.

8. Only after the D1/Pikabu E2E is green may old local Yandex/legacy backend secret files be retired manually. Never delete or print them as part of this patch.
