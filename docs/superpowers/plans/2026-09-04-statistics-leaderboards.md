# Statistics & Yandex Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose persisted Standard/Classic statistics in the main menu and add optional Yandex Games best-time leaderboards with guest top-10 browsing, explicit authorization, safe best-time synchronization, and graceful fallback behavior.

**Architecture:** Keep `MetaSave V2` as the source of truth for in-game statistics. Extend the existing platform adapter with generic auth/leaderboard capabilities, put mode mapping/rate limiting/safe score synchronization in pure game-specific leaderboard services, keep DOM views passive, and let `GameScene` coordinate menu/view lifecycle without raw Yandex SDK calls.

**Tech Stack:** TypeScript, Phaser 3, native DOM/CSS UI, Node `node:test`, Yandex Games SDK (`ysdk.leaderboards`, `ysdk.auth`, `Player`).

**Spec:** `docs/superpowers/specs/2026-09-04-statistics-leaderboards-design.md`

## Global Constraints

- Standard maps to `winnable`; Classic maps to `original`.
- Create exactly two leaderboard technical names: `standard_best_time` and `classic_best_time`.
- Both Yandex Console leaderboards are type `time`, milliseconds, ascending sort, decimal part `0`; only `standard_best_time` is main.
- No Daily leaderboard in this phase.
- `MetaSave V2.stats` remains authoritative for `played`, `wins`, and `bestTimeMs`; leaderboard data never overwrites those fields.
- Win rate is derived as `Math.round(wins / played * 100)` and is never persisted.
- Guest users can open the leaderboard and read public top 10 without authorization.
- Authorization is optional and may be requested only after explicit `ВОЙТИ` input in the leaderboard overlay.
- If Yandex shows its account/progress selection dialog after guest authorization, `ACCOUNT_SELECTION_DIALOG_CLOSED` triggers a page reload so the game reboots from the progress chosen by the player; do not merge/overwrite competing saves client-side in this phase.
- Guest public leaderboard browsing remains available while a game is paused, but `ВОЙТИ` is disabled while `gameState !== null && !gameState.isWon`; authorization is allowed only when there is no unfinished active game, preventing a browser-local active checkpoint from being resumed against a different selected account MetaSave.
- Never open an auth dialog at startup, menu open, or after a win.
- Use direct `ysdk.leaderboards` methods; do not use deprecated `ysdk.getLeaderboards()`.
- `getPlayerEntry()` and `setScore()` are protected methods and must be guarded through `ysdk.isAvailableMethod(...)`.
- `LEADERBOARD_PLAYER_NOT_PRESENT` normalizes to `null`, not a user-visible error.
- Never replace a faster server time with a slower local time.
- All `setScore()` writes use one global serialized queue with at least `1100 ms` between actual calls.
- Pending writes for the same technical leaderboard coalesce to the smallest score.
- `getEntries()` is called only on overlay open, tab switch, or post-auth reload; there is no polling.
- Views never import Yandex/platform services or MetaRepository.
- The game model remains persistence/platform-neutral.
- Plain `pnpm dev` must keep Standard/Classic statistics functional when Yandex services are unavailable.
- Tests assert behavior/copy/wiring, not exact pixels/colors.
- The game UI must never use vertical or horizontal scrolling; main menu and modal overlays must fit the viewport without `overflow:auto` or `overflow:scroll`.
- Short viewports are handled by responsive spacing/typography reductions; future larger datasets use tabs/pagination, never scroll.
- Secondary systems such as Statistics, Leaderboards, and future Shop open dedicated fixed modals instead of appending long sections to the main menu.

---

## File Map

### Platform layer

- `src/platform/services.ts` — generic auth/leaderboard interfaces, normalized platform entries, unavailable fallback behavior.
- `src/platform/yandex.ts` — Yandex SDK adapter, mutable Player reacquisition after auth, direct leaderboard calls, SDK-specific error normalization.

### Leaderboard domain layer

- `src/leaderboards/LeaderboardConfig.ts` — exact ordinary-mode-to-technical-name mapping.
- `src/leaderboards/LeaderboardSubmissionQueue.ts` — serialized/coalesced write queue enforcing the 1100 ms interval.
- `src/leaderboards/LeaderboardService.ts` — UI-safe top rows, personal result loading, and safe local-best-to-server synchronization.

### UI

- `src/game/view/MainMenuView.ts` — primary modes plus compact secondary actions (`СТАТИСТИКА`, `ТАБЛИЦА ЛИДЕРОВ`); no inline stat rows and no scrolling.
- `src/game/view/StatisticsView.ts` — passive no-scroll DOM modal for local Standard/Classic statistics.
- `src/game/view/LeaderboardView.ts` — passive no-scroll DOM modal for top 10, tabs, guest CTA, personal result, loading/error/unavailable states.
- `src/styles.css` — responsive no-scroll menu/modal geometry using the existing parchment/bronze system.

### Scene coordination

- `src/game/scenes/GameScene.ts` — service/view lifecycle, bootstrap sync, browsing/auth actions, request-token race protection, new-record sync.

### Documentation

- `CURRENT_STATE.md`, `TECH.md`, `TREE.txt` — final Phase C truth and Console setup requirements.

---

### Task 1: Generic platform auth + leaderboard capabilities

**Files:**
- Modify: `src/platform/services.ts`
- Modify: `src/platform/yandex.ts`
- Modify: `tests/platform-services.test.ts`

**Interfaces:**
- Consumes: existing `PlayerStorage`, `TrustedClock`, `PlatformServices`, `createUnavailablePlatformServices()`, `createYandexPlatformServices()`.
- Produces:

```ts
export interface PlatformAuth {
  isAuthorized(): boolean;
  requestAuthorization(): Promise<boolean>;
  onAccountSelectionClosed(listener: () => void): () => void;
}

export interface PlatformLeaderboardEntry {
  readonly rank: number; // SDK rank, zero-based
  readonly score: number;
  readonly playerId: string;
  readonly publicName: string;
}

export interface PlatformLeaderboards {
  readonly available: boolean;
  getEntries(
    technicalName: string,
    options: { readonly quantityTop: number },
  ): Promise<PlatformLeaderboardEntry[]>;
  getPlayerEntry(
    technicalName: string,
  ): Promise<PlatformLeaderboardEntry | null>;
  setScore(technicalName: string, score: number): Promise<void>;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly ready: () => void;
}
```

Yandex adapter types added locally in `src/platform/yandex.ts`:

```ts
interface YandexLeaderboardEntry {
  rank: number;
  score: number;
  player: {
    publicName: string;
    uniqueID: string;
  };
}

interface YandexLeaderboards {
  getEntries(
    technicalName: string,
    options: { quantityTop: number },
  ): Promise<{ entries: YandexLeaderboardEntry[] }>;
  getPlayerEntry(technicalName: string): Promise<YandexLeaderboardEntry>;
  setScore(technicalName: string, score: number): Promise<void>;
}

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  isAuthorized(): boolean;
}

export interface YandexSdk {
  getPlayer(): Promise<YandexPlayer>;
  serverTime(): number;
  isAvailableMethod(method: string): Promise<boolean>;
  auth: { openAuthDialog(): Promise<void> };
  leaderboards?: YandexLeaderboards;
  EVENTS?: { ACCOUNT_SELECTION_DIALOG_CLOSED: string };
  on?: (eventName: string, listener: () => void) => () => void;
  features?: { LoadingAPI?: { ready(): void } };
}
```

- [ ] **Step 1: Write platform RED tests**

Add this concrete helper inside `tests/platform-services.test.ts` before the new Yandex tests so every fake satisfies the expanded SDK shape:

```ts
function createFakeYsdk(options: {
  authorized?: boolean;
  getPlayer?: () => Promise<{
    getData(keys?: string[]): Promise<Record<string, unknown>>;
    setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
    isAuthorized(): boolean;
  }>;
  openAuthDialog?: () => Promise<void>;
  getEntries?: (
    name: string,
    options: { quantityTop: number },
  ) => Promise<{ entries: Array<{
    rank: number;
    score: number;
    player: { publicName: string; uniqueID: string };
  }> }>;
  getPlayerEntry?: (name: string) => Promise<{
    rank: number;
    score: number;
    player: { publicName: string; uniqueID: string };
  }>;
  getPlayerEntryError?: unknown;
  setScore?: (name: string, score: number) => Promise<void>;
} = {}): YandexSdk {
  const defaultPlayer = {
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => options.authorized ?? false,
  };

  return {
    getPlayer: options.getPlayer ?? (async () => defaultPlayer),
    serverTime: () => 1_788_508_800_000,
    isAvailableMethod: async () => true,
    auth: {
      openAuthDialog: options.openAuthDialog ?? (async () => undefined),
    },
    EVENTS: { ACCOUNT_SELECTION_DIALOG_CLOSED: 'ACCOUNT_SELECTION_DIALOG_CLOSED' },
    on: () => () => undefined,
    leaderboards: {
      getEntries: options.getEntries ?? (async () => ({ entries: [] })),
      getPlayerEntry: options.getPlayerEntry ?? (async () => {
        if (options.getPlayerEntryError !== undefined) {
          throw options.getPlayerEntryError;
        }
        throw Object.assign(new Error('missing'), {
          code: 'LEADERBOARD_PLAYER_NOT_PRESENT',
        });
      }),
      setScore: options.setScore ?? (async () => undefined),
    },
  };
}
```

Extend the existing imports from `src/platform/yandex.ts` with `type YandexSdk`, then add these concrete behavior tests:

```ts
test('unavailable platform exposes inert auth and unavailable leaderboards', async () => {
  const platform = createUnavailablePlatformServices(null);

  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(await platform.auth.requestAuthorization(), false);
  let selectionClosed = 0;
  const unsubscribe = platform.auth.onAccountSelectionClosed(() => { selectionClosed += 1; });
  unsubscribe();
  assert.equal(selectionClosed, 0);
  assert.equal(platform.leaderboards.available, false);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 }),
    [],
  );
  assert.equal(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    null,
  );
  await platform.leaderboards.setScore('standard_best_time', 5000);
});
```

Add a Yandex adapter test with a mutable fake Player:

```ts
test('Yandex auth is explicit and reacquires Player after successful dialog', async () => {
  let authDialogCalls = 0;
  let getPlayerCalls = 0;
  let authorized = false;

  const makePlayer = () => ({
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => authorized,
  });

  const ysdk = createFakeYsdk({
    getPlayer: async () => {
      getPlayerCalls += 1;
      return makePlayer();
    },
    openAuthDialog: async () => {
      authDialogCalls += 1;
      authorized = true;
    },
  });

  const platform = await createYandexPlatformServices(ysdk);
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(authDialogCalls, 0);
  assert.equal(await platform.auth.requestAuthorization(), true);
  assert.equal(platform.auth.isAuthorized(), true);
  assert.equal(authDialogCalls, 1);
  assert.equal(getPlayerCalls, 2);
});
```

Add a platform-event test that captures the listener passed to `ysdk.on`, invokes it, verifies the registered event is exactly `ACCOUNT_SELECTION_DIALOG_CLOSED`, and verifies the unsubscribe returned by `PlatformAuth.onAccountSelectionClosed()` is the unsubscribe returned by the SDK. This event is not treated as authorization itself; it only signals that the selected progress must be reloaded by the scene.

Add direct-leaderboard tests:

```ts
test('Yandex adapter uses direct leaderboard APIs and normalizes entries', async () => {
  const calls: string[] = [];
  const ysdk = createFakeYsdk({
    authorized: true,
    getEntries: async (name, options) => {
      calls.push(`entries:${name}:${options.quantityTop}`);
      return {
        entries: [{
          rank: 0,
          score: 3210,
          player: { publicName: 'Ada', uniqueID: 'player-1' },
        }],
      };
    },
    getPlayerEntry: async (name) => ({
      rank: 4,
      score: 6000,
      player: { publicName: 'Me', uniqueID: 'me' },
    }),
    setScore: async (name, score) => {
      calls.push(`score:${name}:${score}`);
    },
  });

  const platform = await createYandexPlatformServices(ysdk);
  assert.equal(platform.leaderboards.available, true);
  assert.deepEqual(
    await platform.leaderboards.getEntries('standard_best_time', { quantityTop: 10 }),
    [{ rank: 0, score: 3210, playerId: 'player-1', publicName: 'Ada' }],
  );
  assert.deepEqual(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    { rank: 4, score: 6000, playerId: 'me', publicName: 'Me' },
  );
  await platform.leaderboards.setScore('standard_best_time', 2500);
  assert.deepEqual(calls, [
    'entries:standard_best_time:10',
    'score:standard_best_time:2500',
  ]);
});
```

Add assertions that protected methods call `isAvailableMethod('leaderboards.getPlayerEntry')` and `isAvailableMethod('leaderboards.setScore')`, while `getEntries()` does not require authorization.

Add:

```ts
test('missing leaderboard player entry normalizes to null', async () => {
  const error = Object.assign(new Error('missing'), {
    code: 'LEADERBOARD_PLAYER_NOT_PRESENT',
  });
  const platform = await createYandexPlatformServices(
    createFakeYsdk({ authorized: true, getPlayerEntryError: error }),
  );

  assert.equal(
    await platform.leaderboards.getPlayerEntry('standard_best_time'),
    null,
  );
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm test -- tests/platform-services.test.ts
```

Expected: FAIL because `PlatformServices` has no `auth`/`leaderboards` and the Yandex adapter types/calls are absent.

- [ ] **Step 3: Implement unavailable platform capabilities**

In `src/platform/services.ts`, add the interfaces above and extend `createUnavailablePlatformServices()` exactly with:

```ts
auth: {
  isAuthorized: () => false,
  requestAuthorization: async () => false,
  onAccountSelectionClosed: () => () => undefined,
},
leaderboards: {
  available: false,
  getEntries: async () => [],
  getPlayerEntry: async () => null,
  setScore: async () => undefined,
},
```

Do not change browser `PlayerStorage` semantics.

- [ ] **Step 4: Implement current Yandex auth/leaderboard adapter**

In `createYandexPlatformServices()` use a mutable player reference:

```ts
let player = await ysdk.getPlayer();
```

`playerStorage` closures must continue reading that current variable so they also use the reacquired Player after auth.

Implement explicit auth:

```ts
auth: {
  isAuthorized: () => player.isAuthorized(),
  requestAuthorization: async () => {
    if (player.isAuthorized()) return true;

    try {
      await ysdk.auth.openAuthDialog();
      player = await ysdk.getPlayer();
      return player.isAuthorized();
    } catch {
      return false;
    }
  },
  onAccountSelectionClosed: (listener) => {
    const eventName = ysdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
    if (eventName === undefined || ysdk.on === undefined) {
      return () => undefined;
    }
    return ysdk.on(eventName, listener);
  },
},
```

Normalize leaderboard entries through one helper:

```ts
function toPlatformEntry(entry: YandexLeaderboardEntry): PlatformLeaderboardEntry {
  return {
    rank: entry.rank,
    score: entry.score,
    playerId: entry.player.uniqueID,
    publicName: entry.player.publicName,
  };
}
```

For protected calls:

```ts
async function requireMethod(ysdk: YandexSdk, method: string): Promise<void> {
  if (!(await ysdk.isAvailableMethod(method))) {
    throw new Error(`Yandex method is unavailable: ${method}`);
  }
}
```

`getPlayerEntry()` catches only `error.code === 'LEADERBOARD_PLAYER_NOT_PRESENT'` as `null`; all other errors remain rejected. `setScore()` validates `Number.isFinite(score) && score >= 0` before calling the SDK. If `ysdk.leaderboards` is absent, return the same inert `PlatformLeaderboards` behavior as the unavailable platform (`available:false`, empty/null/no-op methods) rather than dereferencing an absent namespace.

- [ ] **Step 5: Update existing Yandex fakes**

Every existing fake Player in `tests/platform-services.test.ts` must define `isAuthorized()`. Every fake SDK passed to `createYandexPlatformServices()` must define `auth`, `isAvailableMethod`, and may omit `leaderboards` only when testing unavailable capability behavior.

- [ ] **Step 6: Run GREEN/full regression**

Run:

```bash
pnpm test -- tests/platform-services.test.ts
pnpm test
pnpm build
```

Expected: all tests pass; build exits `0`.

- [ ] **Step 7: Commit**

```bash
git add src/platform/services.ts src/platform/yandex.ts tests/platform-services.test.ts
git commit -m "feat: expose Yandex auth and leaderboard services"
```

---

### Task 2: Leaderboard configuration + serialized submission queue

**Files:**
- Create: `src/leaderboards/LeaderboardConfig.ts`
- Create: `src/leaderboards/LeaderboardSubmissionQueue.ts`
- Create: `tests/leaderboard-config.test.ts`
- Create: `tests/leaderboard-submission-queue.test.ts`

**Interfaces:**
- Consumes: `OrdinaryGameMode` from `src/meta/GameStats.ts`.
- Produces:

```ts
export const LEADERBOARD_NAMES = {
  winnable: 'standard_best_time',
  original: 'classic_best_time',
} as const satisfies Record<OrdinaryGameMode, string>;

export function getLeaderboardName(mode: OrdinaryGameMode): string;

export type LeaderboardSubmit = (
  technicalName: string,
  score: number,
) => Promise<void>;

export type LeaderboardDelay = (ms: number) => Promise<void>;
export type LeaderboardNow = () => number;

export class LeaderboardSubmissionQueue {
  constructor(
    submit: LeaderboardSubmit,
    delay?: LeaderboardDelay,
    now?: LeaderboardNow,
    minIntervalMs?: number,
  );

  enqueue(technicalName: string, score: number): Promise<void>;
  get pendingCount(): number;
}
```

Default `minIntervalMs` is exactly `1100`.

- [ ] **Step 1: Write config RED test**

`tests/leaderboard-config.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeaderboardName, LEADERBOARD_NAMES } from '../src/leaderboards/LeaderboardConfig.ts';

test('ordinary modes map to exact Yandex technical names', () => {
  assert.equal(LEADERBOARD_NAMES.winnable, 'standard_best_time');
  assert.equal(LEADERBOARD_NAMES.original, 'classic_best_time');
  assert.equal(getLeaderboardName('winnable'), 'standard_best_time');
  assert.equal(getLeaderboardName('original'), 'classic_best_time');
});
```

Add a source/type assertion that `daily` is not present in `LEADERBOARD_NAMES` and `getLeaderboardName` accepts `OrdinaryGameMode`, not `GameMode`.

- [ ] **Step 2: Write queue RED tests**

Use an injected fake clock/delay so tests never actually sleep:

```ts
test('submission queue serializes writes at least 1100 ms apart', async () => {
  let now = 0;
  const calls: Array<{ name: string; score: number; at: number }> = [];
  const waits: number[] = [];

  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => {
      calls.push({ name, score, at: now });
    },
    async (ms) => {
      waits.push(ms);
      now += ms;
    },
    () => now,
  );

  await Promise.all([
    queue.enqueue('standard_best_time', 5000),
    queue.enqueue('classic_best_time', 6000),
  ]);

  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.deepEqual(waits, [1100]);
});
```

Coalescing test:

```ts
test('pending writes for one board coalesce to the smallest score', async () => {
  const calls: Array<{ name: string; score: number }> = [];
  const queue = new LeaderboardSubmissionQueue(async (name, score) => {
    calls.push({ name, score });
  }, async () => undefined, () => 0);

  const first = queue.enqueue('standard_best_time', 7000);
  const second = queue.enqueue('standard_best_time', 5000);
  const third = queue.enqueue('standard_best_time', 6000);

  await Promise.all([first, second, third]);

  assert.deepEqual(calls, [
    { name: 'standard_best_time', score: 5000 },
  ]);
});
```

Also verify a failed submit rejects every waiter associated with that pending board and the queue continues draining later boards instead of becoming permanently stuck.

- [ ] **Step 3: Run RED**

```bash
pnpm test -- tests/leaderboard-config.test.ts tests/leaderboard-submission-queue.test.ts
```

Expected: FAIL because the files do not exist.

- [ ] **Step 4: Implement exact mode mapping**

`src/leaderboards/LeaderboardConfig.ts`:

```ts
import type { OrdinaryGameMode } from '../meta/GameStats.ts';

export const LEADERBOARD_NAMES = {
  winnable: 'standard_best_time',
  original: 'classic_best_time',
} as const satisfies Record<OrdinaryGameMode, string>;

export function getLeaderboardName(mode: OrdinaryGameMode): string {
  return LEADERBOARD_NAMES[mode];
}
```

- [ ] **Step 5: Implement queue with one microtask-started drain**

`LeaderboardSubmissionQueue` stores pending writes in insertion order:

```ts
interface PendingWrite {
  score: number;
  waiters: Array<{
    resolve(): void;
    reject(error: unknown): void;
  }>;
}
```

`enqueue()` validates a finite non-negative score, merges by `Math.min(existing.score, score)`, appends a waiter, then schedules the drain through `queueMicrotask()` only when no drain is already scheduled/running. Starting on a microtask is required so multiple synchronous enqueues for one board coalesce before the first actual write.

Before each actual submit after the first:

```ts
const waitMs = Math.max(0, this.minIntervalMs - (this.now() - this.lastSubmitAt));
if (waitMs > 0) await this.delay(waitMs);
this.lastSubmitAt = this.now();
await this.submit(technicalName, pending.score);
```

Set `lastSubmitAt` immediately before the network call so failed requests still count toward the one-request-per-second platform limit.

- [ ] **Step 6: Run GREEN/full regression**

```bash
pnpm test -- tests/leaderboard-config.test.ts tests/leaderboard-submission-queue.test.ts
pnpm test
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/leaderboards/LeaderboardConfig.ts src/leaderboards/LeaderboardSubmissionQueue.ts tests/leaderboard-config.test.ts tests/leaderboard-submission-queue.test.ts
git commit -m "feat: add rate-limited leaderboard submission queue"
```

---

### Task 3: Game-specific leaderboard service

**Files:**
- Create: `src/leaderboards/LeaderboardService.ts`
- Create: `tests/leaderboard-service.test.ts`

**Interfaces:**
- Consumes: `PlatformServices`, `OrdinaryGameMode`, `getLeaderboardName()`, `LeaderboardSubmissionQueue`.
- Produces:

```ts
export interface LeaderboardRow {
  readonly rank: number; // one-based UI rank
  readonly scoreMs: number;
  readonly publicName: string;
}

export type LeaderboardLoadResult =
  | {
      readonly status: 'ready';
      readonly entries: readonly LeaderboardRow[];
      readonly playerEntry: LeaderboardRow | null;
      readonly authorized: boolean;
    }
  | {
      readonly status: 'unavailable';
      readonly entries: readonly [];
      readonly playerEntry: null;
      readonly authorized: boolean;
    }
  | {
      readonly status: 'error';
      readonly entries: readonly [];
      readonly playerEntry: null;
      readonly authorized: boolean;
    };

export type LeaderboardSyncResult =
  | 'submitted'
  | 'unchanged'
  | 'skipped';

export class LeaderboardService {
  constructor(platform: PlatformServices);

  get available(): boolean;
  get authorized(): boolean;
  requestAuthorization(): Promise<boolean>;
  load(mode: OrdinaryGameMode): Promise<LeaderboardLoadResult>;
  syncBest(
    mode: OrdinaryGameMode,
    localBestMs: number | undefined,
  ): Promise<LeaderboardSyncResult>;
}
```

- [ ] **Step 1: Write load/normalization RED tests**

Add this concrete test helper at the top of `tests/leaderboard-service.test.ts`:

```ts
function fakePlatform(options: {
  available?: boolean;
  authorized?: boolean;
  authorize?: () => Promise<boolean>;
  getEntries?: PlatformServices['leaderboards']['getEntries'];
  getPlayerEntry?: PlatformServices['leaderboards']['getPlayerEntry'];
  setScore?: PlatformServices['leaderboards']['setScore'];
} = {}): PlatformServices {
  return {
    playerStorage: {
      load: async () => ({}),
      save: async () => undefined,
    },
    trustedClock: { nowMs: () => null },
    auth: {
      isAuthorized: () => options.authorized ?? false,
      requestAuthorization: options.authorize ?? (async () => options.authorized ?? false),
      onAccountSelectionClosed: () => () => undefined,
    },
    leaderboards: {
      available: options.available ?? true,
      getEntries: options.getEntries ?? (async () => []),
      getPlayerEntry: options.getPlayerEntry ?? (async () => null),
      setScore: options.setScore ?? (async () => undefined),
    },
    ready: () => undefined,
  };
}
```

```ts
test('load requests top 10 and converts SDK ranks to one-based rows', async () => {
  const calls: unknown[] = [];
  const platform = fakePlatform({
    authorized: false,
    getEntries: async (name, options) => {
      calls.push({ name, options });
      return [
        { rank: 0, score: 2500, playerId: 'a', publicName: 'Ada' },
        { rank: 1, score: 3000, playerId: 'b', publicName: '' },
      ];
    },
  });
  const service = new LeaderboardService(platform);

  assert.deepEqual(await service.load('winnable'), {
    status: 'ready',
    authorized: false,
    entries: [
      { rank: 1, scoreMs: 2500, publicName: 'Ada' },
      { rank: 2, scoreMs: 3000, publicName: 'Игрок' },
    ],
    playerEntry: null,
  });
  assert.deepEqual(calls, [{
    name: 'standard_best_time',
    options: { quantityTop: 10 },
  }]);
});
```

Add:

- unavailable platform returns `status:'unavailable'` without calling reads;
- authorized load also calls `getPlayerEntry()` and normalizes it;
- rejected leaderboard network call returns `status:'error'` rather than throwing into `GameScene`;
- blank names become `Игрок`;
- non-finite/negative score entries and negative/non-integer ranks are filtered out rather than rendered.

- [ ] **Step 2: Write safe-sync RED tests**

```ts
test('syncBest submits when local time is faster than server', async () => {
  const writes: Array<[string, number]> = [];
  const service = new LeaderboardService(fakePlatform({
    authorized: true,
    getPlayerEntry: async () => ({
      rank: 10,
      score: 8000,
      playerId: 'me',
      publicName: 'Me',
    }),
    setScore: async (name, score) => {
      writes.push([name, score]);
    },
  }));

  assert.equal(await service.syncBest('winnable', 5000), 'submitted');
  assert.deepEqual(writes, [['standard_best_time', 5000]]);
});
```

Also test:

```text
server score 4000 + local 5000 -> unchanged, no setScore
no server entry + local 5000 -> submitted
unauthorized + local 5000 -> skipped, no getPlayerEntry/setScore
undefined local best -> skipped
invalid local best <= 0/non-finite -> skipped
```

- [ ] **Step 3: Run RED**

```bash
pnpm test -- tests/leaderboard-service.test.ts
```

Expected: FAIL because `LeaderboardService.ts` does not exist.

- [ ] **Step 4: Implement UI-safe normalization**

Use:

```ts
function normalizeRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (
    !Number.isInteger(entry.rank)
    || entry.rank < 0
    || !Number.isFinite(entry.score)
    || entry.score < 0
  ) {
    return null;
  }

  return {
    rank: entry.rank + 1,
    scoreMs: entry.score,
    publicName: entry.publicName.trim() || 'Игрок',
  };
}
```

`available` returns `this.platform.leaderboards.available`; `authorized` returns `this.platform.auth.isAuthorized()`; `requestAuthorization()` delegates exactly to `this.platform.auth.requestAuthorization()`. `load()` checks `leaderboards.available` first; guest load never calls `getPlayerEntry()`. For an authorized player, load the public top first, then request the personal entry. If the public-top request fails, return the normalized `error` result. If only the personal-entry request fails unexpectedly, preserve the already-loaded public top and return `status:'ready'` with `playerEntry:null`; a missing player entry is already normalized to `null` by the platform adapter.

- [ ] **Step 5: Implement safe synchronization through one queue**

Construct one queue per service:

```ts
this.submissions = new LeaderboardSubmissionQueue(
  (technicalName, score) => platform.leaderboards.setScore(technicalName, score),
);
```

`syncBest()`:

```ts
if (
  !this.available
  || !this.authorized
  || localBestMs === undefined
  || !Number.isFinite(localBestMs)
  || localBestMs <= 0
) {
  return 'skipped';
}

const technicalName = getLeaderboardName(mode);
const server = await this.platform.leaderboards.getPlayerEntry(technicalName);
if (server !== null && server.score <= localBestMs) {
  return 'unchanged';
}

await this.submissions.enqueue(technicalName, localBestMs);
return 'submitted';
```

If the comparison read or write rejects, return `'skipped'` so leaderboard network failure never affects MetaSave/gameplay completion.

- [ ] **Step 6: Run GREEN/full regression**

```bash
pnpm test -- tests/leaderboard-service.test.ts tests/leaderboard-submission-queue.test.ts tests/platform-services.test.ts
pnpm test
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/leaderboards/LeaderboardService.ts tests/leaderboard-service.test.ts
git commit -m "feat: add safe ordinary leaderboard service"
```

---

### Task 4: No-scroll main menu + Statistics modal

**Files:**
- Modify: `src/game/view/MainMenuView.ts`
- Create: `src/game/view/StatisticsView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Modify: `tests/main-menu-wiring.test.ts`
- Modify: `tests/dom-ui.test.ts`
- Replace: `tests/menu-stats-wiring.test.ts`
- Create: `tests/statistics-view.test.ts`

**Interfaces:**
- Consumes: `MetaSave.stats`, current `MainMenuView`, `GameScene.refreshMenuMeta()`.
- Produces in `StatisticsView.ts`:

```ts
export interface StatisticsModeState {
  readonly played: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
}

export interface StatisticsViewState {
  readonly winnable: StatisticsModeState;
  readonly original: StatisticsModeState;
}

export interface StatisticsViewActions {
  readonly close: () => void;
}

export class StatisticsView {
  constructor(scene: Phaser.Scene, actions: StatisticsViewActions);
  show(state: StatisticsViewState): void;
  update(state: StatisticsViewState): void;
  hide(): void;
  destroy(): void;
}
```

`MainMenuView` no longer consumes ordinary stat rows. It gains compact secondary actions:

```ts
interface MainMenuActions {
  readonly play: (mode: GameMode) => void;
  readonly statistics: () => void;
  readonly leaderboard: () => void;
  readonly cancel: () => void;
}

interface MainMenuShowOptions {
  readonly canCancel: boolean;
  readonly selectedMode: GameMode | null;
  readonly daily: DailyMenuState;
  readonly leaderboardsAvailable: boolean;
}

updateLeaderboardsAvailable(available: boolean): void;
```

- [ ] **Step 1: Write no-scroll/modal RED tests**

`tests/menu-stats-wiring.test.ts` must verify:

```text
MainMenuView contains compact СТАТИСТИКА and ТАБЛИЦА ЛИДЕРОВ actions
MainMenuView does not render played/wins/best rows directly
statistics action calls actions.statistics()
leaderboard button remains disabled when unavailable
GameScene constructs StatisticsView once
GameScene builds StatisticsViewState from metaState.stats
openStatistics()/closeStatistics() only show/hide modal and do not alter deal
refreshMenuMeta() updates hidden/open statistics state
Esc closes StatisticsView before closing/cancelling MainMenu
```

`tests/statistics-view.test.ts` verifies:

```text
СТАТИСТИКА
СТАНДАРТ / КЛАССИКА
Партий / Побед / Процент побед / Лучшее время
Math.round(wins / played * 100)
played === 0 -> 0%
bestTimeMs === null -> —
ЗАКРЫТЬ -> actions.close()
no platform/MetaRepository imports
```

`tests/dom-ui.test.ts` adds hard no-scroll assertions:

```text
.main-menu-panel must not use overflow:auto or overflow:scroll
.meta-modal-panel/statistics panel must not use overflow:auto or overflow:scroll
html/body/game remain overflow:hidden
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/menu-stats-wiring.test.ts tests/statistics-view.test.ts tests/main-menu-wiring.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because `StatisticsView.ts` does not exist, statistics are still inline in the menu, and `.main-menu-panel` still uses `overflow:auto`.

- [ ] **Step 3: Implement passive StatisticsView**

Attach regular DOM to `scene.game.canvas.parentElement`, following `DailyCompleteView` / `GameCompleteView`. Render two mode blocks and one `ЗАКРЫТЬ` button. Helpers:

```ts
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getWinRate({ played, wins }: StatisticsModeState): number {
  return played === 0 ? 0 : Math.round((wins / played) * 100);
}

function formatBest(bestTimeMs: number | null): string {
  return bestTimeMs === null ? '—' : formatDuration(bestTimeMs);
}
```

The view owns no persistence/platform/network state. `show(state)` makes it visible and calls `update(state)`; `hide()` only hides; `destroy()` removes the root.

- [ ] **Step 4: Collapse MainMenuView back to primary navigation**

Remove the inline `.main-menu-stats` section and stat maps/helpers. Add a compact `.main-menu-meta-actions` row after Weekly with:

```text
[ СТАТИСТИКА ] [ ТАБЛИЦА ЛИДЕРОВ ]
```

`СТАТИСТИКА` is always enabled and calls `actions.statistics()`. `ТАБЛИЦА ЛИДЕРОВ` keeps the current disabled/unavailable behavior via `updateLeaderboardsAvailable(available)`. Keep `ЗАКРЫТЬ` below the row only when `canCancel`.

- [ ] **Step 5: Wire StatisticsView in GameScene**

Add:

```ts
private statisticsView!: StatisticsView;
private statisticsOpen = false;

private buildStatisticsViewState(): StatisticsViewState;
private openStatistics(): void;
private closeStatistics(): void;
private handleEscape = (): void => {
  if (this.statisticsOpen) {
    this.closeStatistics();
    return;
  }
  this.closeMainMenu();
};
```

Construct the view once in `create()`, wire `MainMenuView.statistics` to `openStatistics()`, replace the ESC listener with `handleEscape`, and destroy the view on shutdown. `refreshMenuMeta()` updates Daily state, leaderboard availability, and `statisticsView.update(this.buildStatisticsViewState())`. Every `mainMenu.show(...)` passes only `leaderboardsAvailable`.

Opening/closing Statistics must not call `flow.openMainMenu()`, `flow.cancelMenu()`, start/restart a deal, or touch the timer: it is a child modal of the already-open menu. Starting a deal defensively hides the StatisticsView.

- [ ] **Step 6: Enforce no-scroll responsive geometry**

In `src/styles.css`:

- change `.main-menu-panel` from `overflow:auto` to `overflow:hidden`;
- remove the long inline-stat styles;
- add `.main-menu-meta-actions` / `.main-menu-meta-button`;
- add reusable `.meta-modal-dom`, `.meta-modal-backdrop`, `.meta-modal-panel`, `.meta-modal-close` plus small `statistics-*` classes;
- use `@media (max-height: ...)` rules to reduce panel padding, mode spacing, title size, and button heights instead of adding scrolling;
- modal panel must also use `overflow:hidden`.

No `overflow:auto` or `overflow:scroll` may be introduced for these UI surfaces.

- [ ] **Step 7: Run GREEN/full regression**

```bash
pnpm test -- tests/menu-stats-wiring.test.ts tests/statistics-view.test.ts tests/main-menu-wiring.test.ts tests/dom-ui.test.ts tests/ordinary-stats-wiring.test.ts
pnpm test
pnpm build
```

- [ ] **Step 8: Commit replacement Task 4**

```bash
git add src/game/view/MainMenuView.ts src/game/view/StatisticsView.ts src/game/scenes/GameScene.ts src/styles.css tests/menu-stats-wiring.test.ts tests/statistics-view.test.ts tests/main-menu-wiring.test.ts tests/dom-ui.test.ts
git commit -m "feat: move statistics into no-scroll modal"
```

---

### Task 5: Passive no-scroll leaderboard DOM modal

**Files:**
- Create: `src/game/view/LeaderboardView.ts`
- Modify: `src/styles.css`
- Create: `tests/leaderboard-view.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Consumes: `OrdinaryGameMode`, `LeaderboardRow` from Task 3.
- Produces:

```ts
export type LeaderboardViewStatus =
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error';

export interface LeaderboardViewState {
  readonly mode: OrdinaryGameMode;
  readonly status: LeaderboardViewStatus;
  readonly entries: readonly LeaderboardRow[];
  readonly authorized: boolean;
  readonly playerEntry: LeaderboardRow | null;
  readonly authPending: boolean;
  readonly authorizationAllowed: boolean;
  readonly message?: string;
}

export interface LeaderboardViewActions {
  readonly selectMode: (mode: OrdinaryGameMode) => void;
  readonly authorize: () => void;
  readonly close: () => void;
}

export class LeaderboardView {
  constructor(scene: Phaser.Scene, actions: LeaderboardViewActions);
  show(state: LeaderboardViewState): void;
  update(state: LeaderboardViewState): void;
  hide(): void;
  destroy(): void;
}
```

- [ ] **Step 1: Write leaderboard-view RED tests**

`tests/leaderboard-view.test.ts` follows current source-view tests and verifies:

```text
ТАБЛИЦА ЛИДЕРОВ
СТАНДАРТ / КЛАССИКА tabs
formatDuration path for scoreMs
ready rows render rank/publicName/time
Ваш результат section
guest explanation + ВОЙТИ
authorizationAllowed=false disables ВОЙТИ but preserves public rows
authorize action
loading copy Загрузка…
empty copy Пока нет результатов
unavailable/error copy Таблица лидеров временно недоступна
ЗАКРЫТЬ action
long-name class exists for CSS truncation
no avatar usage
```

Example:

```ts
test('leaderboard overlay exposes tabs guest CTA personal result and close actions', () => {
  assert.match(source, /ТАБЛИЦА ЛИДЕРОВ/);
  assert.match(source, /СТАНДАРТ/);
  assert.match(source, /КЛАССИКА/);
  assert.match(source, /Ваш результат/);
  assert.match(source, /ВОЙТИ/);
  assert.match(source, /actions\.authorize\(\)/);
  assert.match(source, /actions\.selectMode\('winnable'\)/);
  assert.match(source, /actions\.selectMode\('original'\)/);
  assert.match(source, /ЗАКРЫТЬ/);
  assert.match(source, /actions\.close\(\)/);
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/leaderboard-view.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because `LeaderboardView.ts` is absent.

- [ ] **Step 3: Implement view structure**

Attach native DOM to `scene.game.canvas.parentElement`, exactly like existing menu/completion views. The view stores no network objects and never starts a deal.

`show(state)` makes the root visible then calls `update(state)`; `update(state)` changes selected tab, status copy, rows, auth/personal section, and button disabled state; `hide()` only hides the root; `destroy()` removes it.

For `status:'ready'` + empty entries, render `Пока нет результатов` instead of an empty list.

Guest block:

```text
Войдите с Яндекс ID, чтобы сохранить рекорд
и увидеть своё место в таблице.
ВОЙТИ
```

When `authPending === true`, disable `ВОЙТИ` and show `Вход…`. When `authorized === false && authorizationAllowed === false`, keep the public top visible, disable `ВОЙТИ`, and show `Завершите текущую партию, чтобы войти и сохранить рекорд.` This restriction applies only to authorization; browsing remains available.

For an authorized user with `playerEntry === null`, render `Ваш результат: пока нет результата` and do not show the login CTA.

- [ ] **Step 4: Style overlay in existing visual language**

Reuse the `.meta-modal-*` shell created in Task 4 and add `leaderboard-*` classes for the fixed top-10 layout. The modal must fit the viewport with `overflow:hidden`; do not add any scroll container. Long names must use:

```css
.leaderboard-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Do not add avatars, CSS pixel assertions, a new visual theme, `overflow:auto`, or `overflow:scroll`. If more than top 10 is ever required, add pagination in a future task instead of scrolling.

- [ ] **Step 5: Run GREEN/full regression**

```bash
pnpm test -- tests/leaderboard-view.test.ts tests/dom-ui.test.ts tests/daily-complete-view.test.ts tests/game-complete-view.test.ts
pnpm test
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/game/view/LeaderboardView.ts src/styles.css tests/leaderboard-view.test.ts tests/dom-ui.test.ts
git commit -m "feat: add leaderboard overlay view"
```

---

### Task 6: GameScene browsing, auth, bootstrap sync, and async race protection

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `tests/menu-stats-wiring.test.ts`
- Create: `tests/leaderboard-scene-wiring.test.ts`
- Modify: `tests/platform-services.test.ts` only if a fake helper needs to expose newly used auth state.

**Interfaces:**
- Consumes: `LeaderboardService`, `LeaderboardView`, existing no-scroll StatisticsView/modal lifecycle, `OrdinaryGameMode`, `MetaSave.stats`, generic `PlatformServices.auth`.
- Produces these `GameScene` fields:

```ts
private leaderboardView!: LeaderboardView;
private leaderboardService: LeaderboardService | null = null;
private leaderboardMode: OrdinaryGameMode = 'winnable';
private leaderboardOpen = false;
private leaderboardAuthPending = false;
private leaderboardRequestId = 0;
private unsubscribeAccountSelection: (() => void) | null = null;
private leaderboardViewState: LeaderboardViewState = {
  mode: 'winnable',
  status: 'unavailable',
  entries: [],
  authorized: false,
  playerEntry: null,
  authPending: false,
  authorizationAllowed: true,
};
```

And methods:

```ts
private openLeaderboard(): void;
private closeLeaderboard(): void;
private selectLeaderboardMode(mode: OrdinaryGameMode): void;
private loadLeaderboard(mode: OrdinaryGameMode): Promise<void>;
private authorizeLeaderboard(): Promise<void>;
private syncHistoricalLeaderboardBests(): Promise<void>;
private buildLeaderboardViewState(
  overrides?: Partial<LeaderboardViewState>,
): LeaderboardViewState;
private renderLeaderboardState(
  overrides?: Partial<LeaderboardViewState>,
): void;
```

- [ ] **Step 1: Write scene RED tests**

`tests/leaderboard-scene-wiring.test.ts` source-contract tests verify:

```text
LeaderboardView is constructed once in create()
MainMenuView receives leaderboard: () => openLeaderboard()
open defaults to winnable
leaderboardService is constructed only after initializePlatform()
refreshMenuMeta sees service availability after construction
authorized bootstrap calls historical sync
unauthorized bootstrap never calls requestAuthorization
load uses monotonically increasing request id
stale response checks request id + open + selected mode before view update
close invalidates outstanding request and hides view
authorizeLeaderboard is the only scene path calling platform.auth.requestAuthorization()
unfinished active game keeps public browsing but blocks authorizeLeaderboard/requestAuthorization
auth success syncs both existing bests then reloads current board
auth false/failure leaves overlay open and writes non-fatal message
ACCOUNT_SELECTION_DIALOG_CLOSED reloads the page from the menu/checkpointed state
shutdown unsubscribes the account-selection listener, invalidates requests, and destroys LeaderboardView
```

Add a strict negative assertion:

```ts
assert.doesNotMatch(sceneSource, /openAuthDialog|ysdk\.leaderboards|YaGames/);
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/leaderboard-scene-wiring.test.ts tests/menu-stats-wiring.test.ts
```

Expected: FAIL because the scene has no leaderboard view/lifecycle.

- [ ] **Step 3: Construct passive view in `create()`**

After `GameCompleteView` construction:

```ts
this.leaderboardView = new LeaderboardView(this, {
  selectMode: (mode) => this.selectLeaderboardMode(mode),
  authorize: () => { void this.authorizeLeaderboard(); },
  close: () => this.closeLeaderboard(),
});
```

Add to `MainMenuView` actions:

```ts
leaderboard: () => this.openLeaderboard(),
```

Before platform initialization, `buildOrdinaryMenuState().leaderboardsAvailable` remains false.

- [ ] **Step 4: Construct service after platform + MetaSave load**

In `initializeMeta()`, after `this.platform = await initializePlatform()` and after remote MetaSave has been merged through `MetaMutationQueue`, construct:

```ts
this.leaderboardService = new LeaderboardService(this.platform);
this.refreshMenuMeta();
```

Register the account-selection safety hook once:

```ts
this.unsubscribeAccountSelection?.();
this.unsubscribeAccountSelection = this.platform.auth.onAccountSelectionClosed(() => {
  window.location.reload();
});
```

The leaderboard is opened only from the main menu, so an active game has already been paused/checkpointed before the Yandex account/progress chooser can appear. Reloading lets the normal bootstrap load the progress the player selected instead of attempting an unsafe client-side merge.

Then, without blocking `platform.ready()` or gameplay:

```ts
if (this.leaderboardService.authorized) {
  void this.syncHistoricalLeaderboardBests();
}
```

There is **no** `requestAuthorization()` call here.

- [ ] **Step 5: Implement open/tab/load request-token behavior**

Opening never changes `GameFlow` state and never hides/replaces the current deal/menu:

```ts
private openLeaderboard(): void {
  const service = this.leaderboardService;
  this.leaderboardOpen = true;
  this.leaderboardMode = 'winnable';
  this.leaderboardAuthPending = false;

  if (service === null || !service.available) {
    this.leaderboardView.show(this.buildLeaderboardViewState({
      status: 'unavailable',
    }));
    return;
  }

  this.leaderboardViewState = this.buildLeaderboardViewState({ status: 'loading' });
  this.leaderboardView.show(this.leaderboardViewState);
  void this.loadLeaderboard('winnable');
}
```

`selectLeaderboardMode(mode)` returns early for the already-selected mode; otherwise changes mode, shows loading, and triggers one load.

`loadLeaderboard(mode)`:

```ts
const requestId = ++this.leaderboardRequestId;
const result = await service.load(mode);
if (
  requestId !== this.leaderboardRequestId
  || !this.leaderboardOpen
  || mode !== this.leaderboardMode
) {
  return;
}

this.renderLeaderboardState({
  status: result.status,
  entries: result.entries,
  authorized: result.authorized,
  playerEntry: result.playerEntry,
});
```

`closeLeaderboard()` sets `leaderboardOpen=false`, increments `leaderboardRequestId`, then hides the view.

- [ ] **Step 6: Implement explicit auth flow**

Add the exact guard:

```ts
private canAuthorizeLeaderboard(): boolean {
  return this.gameState === null || this.gameState.isWon;
}
```

Every leaderboard state render sets `authorizationAllowed: this.canAuthorizeLeaderboard()`. Public reads do not use this guard.

Only this method calls generic auth:

```ts
private async authorizeLeaderboard(): Promise<void> {
  const service = this.leaderboardService;
  if (
    service === null
    || this.leaderboardAuthPending
    || !this.canAuthorizeLeaderboard()
  ) return;

  this.leaderboardAuthPending = true;
  this.renderLeaderboardState({ authPending: true, message: undefined });

  const authorized = await service.requestAuthorization();
  this.leaderboardAuthPending = false;

  if (!this.leaderboardOpen) return;

  if (!authorized) {
    this.renderLeaderboardState({
      authPending: false,
      message: 'Вход не выполнен',
    });
    return;
  }

  await this.syncHistoricalLeaderboardBests();
  if (this.leaderboardOpen) {
    await this.loadLeaderboard(this.leaderboardMode);
  }
}
```

`buildLeaderboardViewState()` must preserve currently displayed rows/message during auth-pending updates instead of blanking the public top. The `leaderboardViewState` field is initialized as shown in the Interfaces block. Implement one scene helper `renderLeaderboardState(overrides)` that computes `{ ...this.leaderboardViewState, ...overrides }`, assigns it back to `leaderboardViewState`, and calls `leaderboardView.update(...)`; use `leaderboardView.show(...)` only when opening the overlay for the first time. This prevents individual async branches from reconstructing partial/default state and losing the visible public rows.

- [ ] **Step 7: Implement historical best sync**

```ts
private async syncHistoricalLeaderboardBests(): Promise<void> {
  const service = this.leaderboardService;
  if (service === null || !service.authorized) return;

  await Promise.all([
    service.syncBest('winnable', this.metaState.stats.winnable.bestTimeMs),
    service.syncBest('original', this.metaState.stats.original.bestTimeMs),
  ]);
}
```

The service queue serializes actual `setScore()` writes, so using `Promise.all` here is safe and lets same-tick requests coalesce/schedule centrally.

- [ ] **Step 8: Shutdown safely**

Before destroying views:

```ts
this.unsubscribeAccountSelection?.();
this.unsubscribeAccountSelection = null;
this.leaderboardOpen = false;
this.leaderboardRequestId += 1;
this.leaderboardView.destroy();
```

No late promise may call `show()` or mutate a destroyed overlay because every async load/auth continuation checks open/request state.

- [ ] **Step 9: Run GREEN/full regression**

```bash
pnpm test -- tests/leaderboard-scene-wiring.test.ts tests/menu-stats-wiring.test.ts tests/platform-services.test.ts tests/session-persistence-wiring.test.ts
pnpm test
pnpm build
```

- [ ] **Step 10: Commit**

```bash
git add src/game/scenes/GameScene.ts tests/leaderboard-scene-wiring.test.ts tests/menu-stats-wiring.test.ts tests/platform-services.test.ts
git commit -m "feat: wire leaderboard browsing and authorization"
```

---

### Task 7: New-record synchronization and mode isolation

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `tests/ordinary-stats-wiring.test.ts`
- Modify: `tests/leaderboard-scene-wiring.test.ts`
- Modify: `tests/daily-scene-wiring.test.ts`

**Interfaces:**
- Consumes: `ModeCompletionResult.improvedBest`, `LeaderboardService.syncBest()`.
- Produces: background synchronization of only newly improved ordinary best times.

- [ ] **Step 1: Write RED tests for completion-triggered sync**

Add scene source/behavior contracts:

```text
finishOrdinaryAttempt checks completion.improvedBest
improved best calls leaderboardService?.syncBest(mode, completion.stats.bestTimeMs)
slower win has no sync call path
Daily completion contains no leaderboard service call
MetaSave save/finalization occurs independently of leaderboard promise
if service is still null during an early win, no error occurs; later authorized bootstrap historical sync covers the merged best
```

Example source assertion. Add this helper in the test file first:

```ts
function extractMethod(source: string, name: string): string {
  const start = source.indexOf(`private ${name}`);
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}
```

Then assert:

```ts
test('only an improved ordinary best requests leaderboard synchronization', () => {
  assert.match(
    sceneSource,
    /completion\.improvedBest[\s\S]*leaderboardService\?\.syncBest\([\s\S]*mode[\s\S]*bestTimeMs/,
  );
  assert.doesNotMatch(
    extractMethod(sceneSource, 'finishDailyAttempt'),
    /leaderboardService|syncBest/,
  );
});
```

Also assert the sync is fire-and-forget (`void ...syncBest`) and does not precede or gate local `metaRepository.save(..., true)` / checkpoint cleanup.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/leaderboard-scene-wiring.test.ts tests/ordinary-stats-wiring.test.ts tests/daily-scene-wiring.test.ts
```

Expected: FAIL because ordinary completion does not call the leaderboard service.

- [ ] **Step 3: Implement new-best trigger**

In `finishOrdinaryAttempt()`, after `this.metaState` and `lastOrdinaryCompletion` have been updated, add:

```ts
const bestTimeMs = completion.stats.bestTimeMs;
if (completion.improvedBest && bestTimeMs !== undefined) {
  void this.leaderboardService?.syncBest(mode, bestTimeMs);
}
```

Do not await it. Keep current MetaSave flush, active-checkpoint clear, and win-screen path independent.

Do not add any leaderboard calls to `finishDailyAttempt()`.

- [ ] **Step 4: Refresh menu statistics after ordinary completion**

Ensure `refreshMenuMeta()` runs after the ordinary completion state mutation so opening the menu from the win overlay immediately shows the updated played/wins/best values.

- [ ] **Step 5: Run GREEN/full regression**

```bash
pnpm test -- tests/leaderboard-scene-wiring.test.ts tests/ordinary-stats-wiring.test.ts tests/daily-scene-wiring.test.ts tests/game-complete-view.test.ts
pnpm test
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/game/scenes/GameScene.ts tests/leaderboard-scene-wiring.test.ts tests/ordinary-stats-wiring.test.ts tests/daily-scene-wiring.test.ts
git commit -m "feat: sync improved ordinary best times"
```

---

### Task 8: Console configuration docs + final Phase C verification

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Regenerate: `TREE.txt`
- Keep unchanged unless implementation forced a factual interface change: `docs/superpowers/specs/2026-09-04-statistics-leaderboards-design.md`
- Keep: `docs/superpowers/plans/2026-09-04-statistics-leaderboards.md`

**Interfaces:** none.

- [ ] **Step 1: Regenerate context/tree from the real Git checkout**

```bash
pnpm context
git status --short
```

Keep generator-produced `TREE.txt` even if it differs from a hand-written tree.

- [ ] **Step 2: Update `CURRENT_STATE.md` with implemented behavior**

Record at minimum:

```text
Main menu exposes persistent Standard/Classic played/wins/win-rate/best time.
Local statistics remain available without Yandex SDK.
Public Yandex top 10 is readable by guests when leaderboard service is available.
Authorization is optional and only requested from leaderboard ВОЙТИ; the login action is disabled while an unfinished game exists, while public top browsing remains available.
Yandex account/progress selection close triggers a safe reload rather than client-side save merging.
Authorized bootstrap/login syncs historical ordinary bests.
Only improved ordinary bests request background synchronization.
Server-better scores are never overwritten by slower local scores.
setScore writes are serialized/coalesced with >=1100 ms spacing.
No Daily leaderboard exists.
Missing/misnamed Console leaderboard degrades to a non-fatal unavailable/error UI.
```

- [ ] **Step 3: Update `TECH.md` architecture**

Document:

```text
src/platform/services.ts -> generic auth/leaderboard boundary
src/platform/yandex.ts -> SDK-specific direct ysdk.leaderboards/auth adapter + account-selection event bridge
src/leaderboards/LeaderboardConfig.ts -> exact technical names
src/leaderboards/LeaderboardSubmissionQueue.ts -> global per-service serialized writes
src/leaderboards/LeaderboardService.ts -> ordinary mode mapping/load/safe sync
src/game/view/LeaderboardView.ts -> passive native DOM overlay
GameScene -> lifecycle/request token/auth orchestration only
MetaSave V2 remains authoritative for in-game stats
```

Document exact Yandex Console configuration:

```text
standard_best_time: time, milliseconds, ASC, decimal part 0, main=true
classic_best_time:  time, milliseconds, ASC, decimal part 0, main=false
```

- [ ] **Step 4: Full automated verification**

Run fresh:

```bash
pnpm test
pnpm build
```

Required: zero test failures and build exit code `0`. Existing Vite chunk-size warning remains informational unless it becomes a real runtime/performance issue.

- [ ] **Step 5: Local/fallback manual acceptance**

With plain:

```bash
pnpm dev
```

Verify:

```text
A. Standard/Classic menu stats survive F5.
B. played/wins/win-rate/best values match completed/started games.
C. no-best renders as — and zero played renders 0%.
D. leaderboard button is unavailable/disabled without Yandex SDK, but stats remain readable.
E. no auth dialog ever appears automatically.
F. short viewport shows the complete main menu without any scrollbar; spacing/typography compress responsively.
```

- [ ] **Step 6: Create the two leaderboards in Yandex Games Console**

Before live calls, create exact technical names:

```text
standard_best_time
classic_best_time
```

Both:

```text
type = time
unit = milliseconds
sort = ascending
fraction/decimal part = 0
```

Only `standard_best_time` is marked main.

Do not change code constants to compensate for a typo in Console; fix the Console name to match the committed constants.

- [ ] **Step 7: Yandex dev/draft manual acceptance**

Use the existing Yandex launch path (`pnpm yandex:dev` for mock/dev behavior; a registered draft/app-id for real auth/leaderboard verification).

Verify:

```text
G. Guest opens public Standard top 10 without an auth popup.
H. Guest switches to Classic and gets only Classic data.
I. Guest sees the ВОЙТИ explanation and button when no unfinished game exists.
I2. With an unfinished paused game, public top remains readable but ВОЙТИ is disabled with the finish-current-game explanation.
J. Only pressing enabled ВОЙТИ opens Yandex auth.
K. Cancelled/failed auth leaves public top visible and gameplay usable.
L. Successful auth without an account-selection switch reacquires Player, syncs existing Standard/Classic bests, reloads current tab, and shows personal result if present.
L2. If Yandex shows the account/progress selection dialog, closing it reloads the page; the selected progress is loaded through the normal bootstrap and the previously paused active game remains recoverable from its checkpoint when that selected save is the guest progress.
M. Two historical bests do not trigger setScore faster than one request per 1100 ms.
N. Faster local Standard time updates only standard_best_time.
O. Slower Standard win does not overwrite a faster server result.
P. Classic best writes only classic_best_time.
Q. Daily completion never writes either ordinary leaderboard.
R. Rapid Standard -> Classic -> Standard switching cannot let a stale earlier response overwrite the current tab.
S. Closing while loading never reopens/mutates the hidden overlay.
T. Temporarily rename/remove a Console leaderboard: UI shows non-fatal unavailable/error state instead of crashing.
```

- [ ] **Step 8: Final search for forbidden regressions**

```bash
rg "getLeaderboards\(|openAuthDialog\(" src/game src/leaderboards
rg "standard_best_time|classic_best_time" src/leaderboards CURRENT_STATE.md TECH.md
```

Expected:

- first command finds **no** `getLeaderboards()` and no raw `openAuthDialog()` outside `src/platform/yandex.ts` (run a separate `rg "openAuthDialog" src/platform/yandex.ts` to confirm the one intended adapter use);
- second command shows both exact names in config/docs;
- no Daily mapping exists.

- [ ] **Step 9: Commit final docs**

```bash
git add CURRENT_STATE.md TECH.md TREE.txt
git commit -m "docs: record statistics and leaderboard integration"
```

---

## Task / ZIP Delivery Sequence

Deliver one small replacement ZIP per task after each GREEN verification:

```text
Task 1  generic platform auth + leaderboard capabilities
Task 2  leaderboard config + rate-limited submission queue
Task 3  safe game-specific leaderboard service
Task 4  main-menu ordinary statistics
Task 5  leaderboard DOM overlay
Task 6  GameScene browsing/auth/bootstrap integration
Task 7  improved-best synchronization
Task 8  Console docs + final verification
```

The user applies each ZIP at project root, runs the listed verification commands, manually checks the task-specific behavior when applicable, then commits at that task's commit boundary before the next ZIP.

## Self-Review Against Spec

- **No-scroll secondary UI:** Task 4 keeps the main menu compact, moves Standard/Classic statistics into a dedicated modal, covers zero/no-best states/local fallback, and establishes the reusable no-scroll modal shell for Leaderboards and future Shop.
- **Exactly two leaderboards:** Task 2 freezes exact technical names and excludes Daily at the type boundary; Task 8 freezes Console settings.
- **Guest behavior:** Tasks 1, 3, 5, and 6 allow top-10 reads without auth and keep the CTA explicit.
- **Authorization:** Tasks 1, 5, and 6 ensure only the overlay action calls generic authorization, block account switching while an unfinished browser-local active game exists, and let the Yandex adapter bridge account-selection close so the scene safely reloads the progress chosen by the player.
- **Safe score sync:** Tasks 2, 3, 6, and 7 cover server comparison, absent player entry, serialization, coalescing, bootstrap/history sync, and improved-best-only runtime sync.
- **Rate limits:** Task 2 enforces >=1100 ms between actual writes; reads occur only on open/tab/post-auth reload via Task 6.
- **Race safety:** Task 6 uses monotonically increasing request ids plus `leaderboardOpen` and selected-mode checks; shutdown invalidates outstanding requests.
- **Failure isolation:** Tasks 1 and 3 normalize unavailable/error behavior; Task 7 keeps leaderboard promises independent from MetaSave completion/checkpoint cleanup.
- **No Daily leaderboard:** Tasks 2, 7, and 8 explicitly prevent Daily mapping/writes.
- **No deprecated API/raw SDK leakage:** Tasks 1, 6, and 8 enforce direct `ysdk.leaderboards` only in the platform adapter.
- **Non-goals preserved:** no custom backend, avatars, friends-only view, pagination, automatic login, leaderboard rewards, or Daily competition are introduced.
