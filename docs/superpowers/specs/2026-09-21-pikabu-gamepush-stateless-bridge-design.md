# Cascade: Pikabu native identity + stateless bridge + GamePush backend — design

Date: 2026-09-21  
Status: awaiting user review  
Supersedes: `docs/superpowers/specs/2026-09-20-platform-backend-pikabu-design.md`

## 1. Goal

Replace the current Pikabu Supabase/Postgres backend with a database-free architecture while preserving the existing Yandex path and Cascade's local-first behavior.

The Pikabu build must use:

- Pikabu SDK as the only user-facing identity/auth source;
- Pikabu native ads and platform lifecycle;
- browser `localStorage` for immediate/offline progress;
- a small stateless HTTPS bridge, initially hosted as a Supabase Edge Function;
- GamePush Server API for cloud player data and leaderboards;
- GamePush Unique Values as the durable mapping from verified Pikabu user ID to GamePush player ID.

Success means:

- no Postgres tables, migrations, RPC, profile rows, leaderboard rows or DB-side CAS remain in the Pikabu backend;
- no GamePush login/code/account UX is shown to the player;
- no GamePush API secret or Pikabu game secret is present in the browser bundle;
- an authorized Pikabu player can recover the same cloud profile on another device;
- backend/GamePush outages never stop local play or local saves;
- Yandex behavior remains unchanged.

## 2. Current baseline and rejected patch

Implementation baseline is the latest full project archive `cascade(20260921-091548).zip`.

The baseline already has useful boundaries:

- `src/platform/pikabu.ts` — native Pikabu SDK adapter and signed identity assertion;
- `src/backend/BackendClient.ts` — HTTP transport;
- `src/backend/CloudProfileService.ts` — cloud profile transport;
- `src/backend/BackendLeaderboards.ts` — backend leaderboard adapter;
- `src/cloud/CloudMerge.ts` — semantic BASE / LOCAL / CLOUD merge;
- `src/cloud/CloudSyncCoordinator.ts` — local-first sync orchestration;
- `supabase/functions/cascade-api/` — current Edge Function;
- `supabase/migrations/` — current Postgres-backed implementation.

`cascade-patch-gamepush-pikabu-phase1.zip` must **not** be applied as-is. It replaces the Pikabu platform adapter with GamePush, uses `gp.player.login()` as player auth, writes profile data directly from the browser and uses GamePush ads. That contradicts the selected architecture. The patch may only be mined for the small GamePush SDK loader/provisioning helper.

## 3. Non-goals

This change does not:

- migrate Yandex storage or Yandex leaderboards to GamePush;
- create a Cascade-owned email/password account system;
- use GamePush Distribution;
- use GamePush as the visible platform/auth provider;
- make GamePush SDK the normal cloud-storage transport;
- add a long-running server or VPS;
- add realtime/WebSocket features;
- verify every solitaire move server-side.

## 4. Selected architecture

```text
Cascade browser
│
├── Pikabu SDK
│   ├── native Pikabu auth
│   ├── id / name / avatar
│   ├── getSignedData()
│   ├── fullscreen / rewarded ads
│   └── lifecycle
│
├── localStorage
│   └── immediate/offline profile + active game
│
├── GamePush provisioning helper
│   └── loaded only when first account bootstrap is required
│       (no login UI, no profile/leaderboard writes)
│
└── HTTPS stateless bridge
    ├── verifies Pikabu HS256 signedData
    ├── resolves Pikabu ID -> GamePush player ID via Unique Values
    ├── issues short-lived bridge session JWT
    └── GamePush Server API
        ├── cascadeProfile
        ├── cascadeStandard
        ├── cascadeDaily
        ├── cascadeDailyStreak
        └── cascadeMastery
```

Supabase remains only the first runtime for the Edge Function. The business layer must not depend on Supabase database APIs so the function can later move to another runtime without data migration.

## 5. Trust and security boundaries

### 5.1 Authoritative identity

Only a successfully verified Pikabu `getSignedData()` payload establishes the public user identity.

The bridge must:

1. verify the JWT signature with `PIKABU_GAME_SECRET`;
2. accept only HS256;
3. require `isAuthorized === true` for cloud writes, profile sync and leaderboard writes;
4. derive `pikabuId`, public name and avatar only from the verified payload;
5. never trust client-supplied Pikabu ID/name/avatar separately from the signed payload.

### 5.2 GamePush identity

The browser must never be allowed to assert `gamePushPlayerId` directly.

A GamePush player ID is trusted only when it comes from one of these server-side paths:

- `FetchUniqueValues(tag="pikabuId", value=<verified Pikabu ID>) -> ownerId`; or
- first-login `GetPlayer` authenticated using GamePush platform-auth data supplied by the SDK and validated by GamePush Server API.

### 5.3 Secrets

Only the Edge Function/runtime receives:

```env
PIKABU_GAME_SECRET=...
GAMEPUSH_API_SECRET=...
GAMEPUSH_PROJECT_ID=30632
BRIDGE_SESSION_SECRET=...
```

Browser-visible configuration may contain only public values such as the GamePush project ID/public token needed to initialize the hidden provisioning SDK.

## 6. Guest flow

Guest mode remains fully playable and local-first.

A guest can:

- play Standard and Daily;
- progress Mastery locally;
- save/restore locally;
- view public leaderboard rows when the bridge is reachable.

A guest cannot:

- cloud-sync progress;
- submit leaderboard results;
- receive a bridge account session.

No GamePush player is intentionally provisioned for a guest by Cascade. GamePush SDK is not loaded merely because the game started.

## 7. Authorized session and first-login bootstrap

### 7.1 Normal session

Client obtains fresh Pikabu signed data and calls:

```http
POST /v1/session
Content-Type: application/json

{
  "signedData": "<pikabu jwt>"
}
```

Bridge:

1. verifies Pikabu JWT;
2. calls `FetchUniqueValues` with:
   - `projectId = 30632`
   - `tag = "pikabuId"`
   - `value = verified Pikabu id`
3. if exactly one mapping exists, uses its `ownerId` as GamePush player ID;
4. issues a short-lived bridge session token.

The response does not need to expose the GamePush player ID to gameplay code.

### 7.2 First account bootstrap

If no `pikabuId` mapping exists, `/v1/session` returns a machine-readable `PROVISIONING_REQUIRED` result.

Only then the client loads the small GamePush provisioning helper. It waits for `gp.player.ready` and extracts:

- `gp.player._authInfo`;
- `gp.platform.type`;
- `gp.platform.tag`.

The client retries `/v1/session` with the Pikabu signed data plus this GamePush auth envelope. The bridge converts `_authInfo` to the GamePush `X-Player-Data` format and calls GamePush `GetPlayer` with platform-auth headers.

`GetPlayer` supplies the authoritative GamePush player ID. The bridge then creates the mapping:

```text
tag     = pikabuId
value   = <verified Pikabu id>
ownerId = <GamePush GetPlayer id>
```

The browser's own `gp.player.id`, if present, is ignored.

### 7.3 Concurrent first login

Two devices may both observe a missing mapping. Unique Values is the arbiter:

- one mapping creation succeeds;
- a conflicting creation does not replace the winner;
- the losing request re-runs `FetchUniqueValues` and binds the session to the winning `ownerId`.

No custom database transaction is required.

## 8. Bridge session token

After bootstrap/lookup, the bridge issues its own HS256 session JWT signed with `BRIDGE_SESSION_SECRET`.

Required claims:

```text
iss = "cascade-bridge"
aud = "cascade-pikabu"
sub = GamePush player ID
pid = verified Pikabu ID
iat = issued-at
exp = issued-at + 30 minutes
```

The token may also contain the verified Pikabu display name/avatar used by backend leaderboard responses. Those values are trusted because the bridge itself signed them.

All account-scoped endpoints after `/v1/session` use:

```http
Authorization: Bearer <bridge session jwt>
```

The Pikabu assertion is used again only to refresh/recreate the short session. If a request receives an expired-session response, the client obtains fresh `getSignedData()` and repeats `/v1/session` in the background.

## 9. GamePush player storage

Create one GamePush player custom field:

```text
cascadeProfile : String
```

Its value is JSON for the existing normalized `CloudSnapshot` shape. Preferences that are currently intentionally device-local remain device-local.

The bridge reads/writes the field only through GamePush Server API. The browser never calls `gp.player.set('cascadeProfile', ...)` or `gp.player.sync()` as the normal persistence path.

The GamePush adapter must preserve unrelated GamePush player state when writing `cascadeProfile`.

## 10. Cloud sync without Postgres or CAS

The product requirement is explicitly **no database revision/CAS layer**. We still keep semantic merging so two devices do not blindly replace each other.

### 10.1 HTTP contract

```http
GET /v1/profile
Authorization: Bearer <bridge session>
```

returns:

```json
{ "profile": null }
```

or:

```json
{ "profile": { "schemaVersion": 1, "meta": {}, "activeGame": {} } }
```

Save uses:

```http
PUT /v1/profile
Authorization: Bearer <bridge session>
Content-Type: application/json

{
  "base": <last cloud snapshot seen by this device or null>,
  "profile": <current local snapshot>
}
```

The API intentionally has no `revision`, `expectedRevision` or persistent `operationId` contract.

### 10.2 Server-side merge

For each PUT, the bridge:

1. loads the latest GamePush `cascadeProfile` (`cloud`);
2. normalizes `base`, `profile` (`local`) and `cloud`;
3. runs the existing `mergeCloudSnapshots({ base, local, cloud, todayId })` logic;
4. writes the merged snapshot through GamePush `SyncPlayer`/equivalent player-state mutation;
5. reads back once;
6. if the read-back differs because another writer raced, performs at most one reconciliation merge/write;
7. returns the final normalized snapshot to the client.

The client applies the returned snapshot locally and stores it as the next BASE.

This is **eventually convergent, not linearizable**. With no CAS primitive, an extreme simultaneous-write race can temporarily overwrite one write. The retained BASE/LOCAL merge plus read-back reconciliation repairs normal races on the next sync, but the design intentionally does not claim database-grade atomicity.

If GamePush exposes stronger native synchronization semantics during implementation, they may be used internally without changing this HTTP contract.

### 10.3 Offline behavior

Local profile and active-game saves never wait for the bridge. Failed sync leaves local state intact and retries on the same existing triggers:

- startup;
- successful Pikabu authorization;
- browser `online` event;
- game completion;
- return to home / other existing safe points.

Backoff/retry state stays local. There is no server-side idempotency table.

## 11. Leaderboards

All Pikabu leaderboard reads/writes go through the bridge and GamePush Server API. The browser does not call GamePush leaderboard APIs directly.

The existing Cascade-facing technical names remain unchanged:

```text
standardwinstreak
dailyfastest
dailystreak
cascademastery
```

The bridge maps them to GamePush scoped leaderboard tags:

```text
standardwinstreak -> cascadeStandard     / variant global
dailyfastest      -> cascadeDaily        / variant YYYY-MM-DD
dailystreak       -> cascadeDailyStreak  / variant global
cascademastery    -> cascadeMastery      / variant global
```

`cascadeDailyStreak` is intentionally added to the earlier three-tag sketch because Cascade already exposes a Daily streak leaderboard; omitting it would be a product regression.

### 11.1 Ranking values

Use one authoritative numeric `score` field per GamePush leaderboard wherever possible, reusing Cascade's existing encoders:

- Standard: `bestStreak` / descending;
- Daily: `encodeDailyLeaderboardScore(dailyId, moves, elapsedMs)` / descending within the date variant;
- Daily streak: `encodeDailyStreakLeaderboardScore(current, best)` / descending;
- Mastery: `encodeMasteryLeaderboardScore(profile)` / descending.

The bridge validates/derives score inputs server-side instead of accepting an arbitrary encoded score from the client.

### 11.2 Public identity in rows

Leaderboard names/avatars must represent verified Pikabu identity, not an arbitrary GamePush nickname.

During session/bootstrap, the bridge mirrors the verified Pikabu name/avatar into the GamePush player profile using a server-side GamePush player update while preserving credentials/state. Leaderboard fetches then use GamePush's normal player `name` and `avatar` fields.

If the exact GamePush mutation schema requires a different safe write path, the implementation may use equivalent custom player fields included in leaderboard fetches; the trust rule does not change: only values copied from a verified Pikabu token may be exposed as the public Cascade identity.

### 11.3 Daily: first official result only

Cascade's existing rule remains: **the first official Daily result is the only result that may affect that date's leaderboard**. A replay must not improve it.

The database-free bridge uses a GamePush Unique Value as an immutable first-attempt receipt before publishing the record.

Conceptually:

```text
tag   = cascadeDailyFirst:<YYYY-MM-DD>
value = compact versioned receipt containing
        verified Pikabu id + attemptId + moves + elapsedMs + completedOnTime
owner = mapped GamePush player
```

Flow:

1. bridge validates the Daily submission and server date;
2. bridge attempts admin `CreateUniqueValue` for the mapped owner/tag;
3. if creation succeeds, this request owns the first-result slot and the bridge publishes that exact GamePush Daily record;
4. if publication fails after receipt creation, retrying the same receipt is allowed and republishes the same result;
5. if a receipt already exists with different attempt/result data, the request is a replay and must not update the leaderboard.

**Implementation gate:** before shipping Daily writes, an automated/live API test must prove that `CreateUniqueValue` is create-only for an existing owner+tag and does not silently replace that player's existing value. If GamePush violates that property, strict first-result semantics cannot be claimed with this primitive and the Daily write path must stop rather than silently degrade to “best replay wins”.

This gate preserves the product rule instead of quietly changing it to GamePush's default “better record replaces previous record” behavior.

### 11.4 Daily streak

The bridge derives current/best Daily streak from the normalized profile/Daily records using Cascade's existing product logic and publishes the encoded streak score. The client does not get to submit an arbitrary streak number.

## 12. Pikabu ads and lifecycle

Pikabu remains the visible platform adapter.

`src/platform/pikabu.ts` should own:

- `sdk.auth.openAuthDialog()`;
- `userAuthorized` handling;
- `getSignedData()`;
- Pikabu lifecycle/game-start signaling;
- native Pikabu fullscreen/rewarded ad calls.

GamePush ads, pause state, gameplay markup and login are not used for the Pikabu product experience.

The hidden GamePush helper has one responsibility only: obtain platform-auth material when `/v1/session` says provisioning is required.

## 13. Bridge endpoints

The Edge Function keeps a small explicit surface:

```text
POST /v1/session
GET  /v1/profile
PUT  /v1/profile
GET  /v1/leaderboards/:board
POST /v1/leaderboards/:board
```

Rules:

- `/v1/session` takes Pikabu signed data and optional GamePush provisioning auth;
- profile GET/PUT require a bridge session;
- leaderboard GET is public, but an optional valid session allows returning `playerEntry`;
- leaderboard POST requires a bridge session;
- unknown boards/invalid variants are rejected;
- GamePush `Problem` unions are translated to stable HTTP errors without leaking secrets/internal payloads;
- upstream timeout/unavailability returns retryable 502/503 style responses;
- CORS stays restricted to the intended game origins/configuration.

## 14. GamePush API adapter boundary

Create a focused server-only adapter rather than scattering GraphQL strings through route handlers.

Conceptual interface:

```ts
interface GamePushBackend {
  findPikabuMapping(pikabuId: string): Promise<number | null>;
  createPikabuMapping(ownerId: number, pikabuId: string): Promise<void>;
  getPlayerByPlatformAuth(auth: GamePushPlatformAuth): Promise<GamePushPlayer>;
  getPlayer(playerId: number): Promise<GamePushPlayer>;
  syncPlayerState(playerId: number, state: unknown): Promise<GamePushPlayer>;
  syncVerifiedPublicIdentity(playerId: number, name: string, avatar: string): Promise<void>;

  fetchTop(board: GamePushBoard, variant: string, limit: number): Promise<...>;
  fetchPlayerRating(playerId: number, board: GamePushBoard, variant: string): Promise<...>;
  publishRecord(playerId: number, board: GamePushBoard, variant: string, score: number): Promise<void>;

  createDailyFirstReceipt(playerId: number, dailyId: string, receipt: string): Promise<'created' | 'exists'>;
  getDailyFirstReceipt(playerId: number, dailyId: string): Promise<string | null>;
}
```

This keeps GamePush replaceable and makes the Edge Function independently testable with a fake adapter.

## 15. Client-side changes

### Keep

- `src/platform/pikabu.ts` as the primary Pikabu adapter;
- browser `PlayerStorage`;
- `BackendIdentityProvider` concept;
- `BackendClient` concept;
- `CloudSnapshot` normalization;
- `CloudMerge` semantic rules;
- local-first sync triggers;
- existing `LeaderboardService` public surface.

### Change

- `BackendClient` gains bridge-session handling and transparent session refresh;
- `CloudProfileService` drops revisions/conflict responses and sends BASE + LOCAL;
- `CloudSyncCoordinator` drops CAS-specific retry logic and keeps BASE/pending local state;
- `BackendLeaderboards` targets GamePush-backed bridge semantics;
- Pikabu platform gains the provisioning helper capability without replacing Pikabu auth;
- Pikabu ads become native Pikabu SDK calls.

### Remove from production path

- Postgres-backed `BackendDb`;
- migrations and RPC grants;
- DB profile revisions;
- DB idempotency operation table/state;
- DB leaderboard tables;
- DB-derived Daily streak implementation;
- any GamePush `gp.player.login()` UX;
- direct browser GamePush profile/leaderboard writes.

Legacy migration files may be deleted once the replacement tests are green; they are not part of the runtime architecture.

## 16. GamePush project setup

Project `30632` needs:

1. custom player field `cascadeProfile` as String;
2. scoped leaderboards:
   - `cascadeStandard` — numeric `score`, descending;
   - `cascadeDaily` — numeric `score`, descending, date variants;
   - `cascadeDailyStreak` — numeric `score`, descending;
   - `cascadeMastery` — numeric `score`, descending;
3. API key permissions limited to the methods actually used by the bridge.

Expected method family includes:

- `FetchUniqueValues`;
- `CreateUniqueValue`;
- `GetPlayer`;
- `SyncPlayer`;
- player/admin profile update method needed for verified public identity;
- `PlayerPublishRecord`;
- `FetchTop`;
- `FetchPlayerRating`.

The implementation plan must use introspection results for exact GraphQL input/output names instead of guessing schemas.

## 17. Failure behavior

- Pikabu SDK unavailable: fall back to browser-local play; cloud/auth UI reports unavailable rather than blocking startup.
- Pikabu token invalid: 401; do not provision or touch GamePush state.
- No mapping + GamePush SDK unavailable: stay local and retry provisioning later.
- GamePush unavailable: local play/save continues; sync and leaderboard writes remain pending/retryable.
- Expired bridge token: refresh through fresh Pikabu signed data, then retry once.
- Corrupt `cascadeProfile`: do not overwrite it blindly; return an explicit backend error and keep the local copy safe for recovery/diagnostics.
- Mapping conflict: re-fetch unique mapping and use the existing owner; never overwrite an established `pikabuId` mapping.
- Daily receipt conflict: treat as repeat unless it exactly matches the same first-submission receipt.

## 18. Testing and acceptance

### Unit/contract tests

- Pikabu JWT HS256 verification, including wrong algorithm/signature and unauthorized guest;
- bridge session signing, expiry and tampering;
- mapping lookup and first-login race behavior;
- client never trusts/sends a raw GamePush player ID as authority;
- profile BASE/LOCAL/CLOUD merge scenarios from existing tests;
- profile write read-back reconciliation;
- offline/retry behavior;
- leaderboard board/variant mapping;
- server-side Standard/Daily/Streak/Mastery score derivation;
- Daily first-result receipt and retry semantics;
- guest leaderboard read versus authorized write;
- Yandex tests unchanged.

### Live GamePush contract tests before release

- platform-auth `GetPlayer` returns stable player ID;
- `FetchUniqueValues(tag="pikabuId", value=...)` returns the expected `ownerId`;
- duplicate mapping cannot steal an existing Pikabu ID;
- `cascadeProfile` round-trip through server API;
- `CreateUniqueValue` Daily receipt is create-only for the same owner+tag;
- all four leaderboard tags can publish/fetch expected scores;
- fetched leaderboard rows expose the verified Pikabu display identity.

### Manual E2E

1. guest starts and saves locally with GamePush/backend unavailable;
2. guest authorizes with Pikabu and local profile merges into empty cloud;
3. second browser/device with same Pikabu account resolves the same GamePush owner and downloads merged profile;
4. two devices make different progress and converge after sync;
5. first Daily result appears; repeat cannot improve it;
6. Standard, Daily streak and Mastery rankings update;
7. backend outage does not block play;
8. Yandex build still uses Yandex storage/auth/leaderboards/ads.

## 19. Rollout

1. Implement the new adapter/session layer behind the existing Pikabu build target.
2. Keep Yandex path untouched.
3. Verify bridge + GamePush in a Pikabu test build.
4. Only after the replacement passes tests, remove Postgres migrations/RPC/backend DB code from the Pikabu runtime branch.
5. If Supabase Edge Function latency/reachability from Russia is unacceptable, move the stateless bridge to another runtime without moving player data; GamePush remains the persistence backend.

## 20. Design decision summary

The final ownership model is:

```text
Pikabu = identity + visible platform UX + ads
Cascade browser = immediate local state + offline play
Stateless bridge = trust boundary + merge/validation/orchestration
GamePush = durable profile + identity mapping + leaderboards
Supabase = temporary function runtime only, no database
```

The main intentional trade-off is removal of database CAS. Profile synchronization is semantic/eventual rather than transactional, while strict Daily first-result behavior is preserved with a GamePush Unique Value receipt and a release-blocking contract test for its create-only property.
