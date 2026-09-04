# Cascade Solitaire Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve unfinished games across page reload, add persistent Standard/Classic statistics, and show a reusable ordinary-mode win summary without changing solitaire rules or Daily behavior.

**Architecture:** Keep the active board checkpoint separate from long-lived `MetaSave`: `cascadeActiveGame` is a frequent browser-local settled-state checkpoint, while `cascadeMeta` continues through `PlayerStorage`/Yandex with a persistent browser fallback when Yandex is unavailable. `GameScene` coordinates restoration, timers, checkpoints, statistics, and DOM completion views; `src/game/model/**` remains platform/persistence-neutral.

**Tech Stack:** TypeScript, Phaser 3.90, native DOM/CSS, browser `localStorage`, Yandex Games Player data behind `PlayerStorage`, Node built-in test runner, pnpm/Vite.

**Spec:** `docs/superpowers/specs/2026-09-04-persistent-stats-win-summary-design.md`

## Global Constraints

- Internal modes remain `winnable` = `СТАНДАРТ`, `original` = `КЛАССИКА`, `daily` = `ИСПЫТАНИЕ ДНЯ`.
- `src/game/model/**` must not import browser storage, Yandex SDK, `src/platform/**`, `src/persistence/**`, or `src/meta/**`.
- Active board checkpointing is browser-local and must not call Yandex `player.setData()` after each move.
- Active checkpoints represent settled logical state only; never persist transient Phaser positions or animation progress.
- Standard/Classic startup and restore must not wait for Yandex initialization or trusted time.
- Daily restore must wait for trusted current UTC Daily identity; never validate Daily against the device clock.
- Time while menu-paused, document-hidden, or page-closed is excluded from elapsed attempt time.
- Restoring a started attempt after reload must not increment `played` again.
- Restart is a new attempt; ordinary New Game is a fresh seed; Daily New Game/retry keeps the same Daily seed.
- Undo history remains runtime-only and resets after page reload.
- Existing gameplay legality, draw order, safe auto-foundation, undo transaction semantics, responsive layout, card assets, and parchment/bronze visual language remain unchanged.
- Phase B does not add XP, currency, shop, achievements UI, streaks, leaderboards, ads/IAP, localization implementation, mobile redesign, loss detection, or cross-device unfinished-board sync.

## Planned File Structure

```text
src/
  persistence/
    ActiveGameSave.ts          active checkpoint schema, normalization, Deal conversion
    ActiveGameRepository.ts    safe browser-local load/save/clear for cascadeActiveGame
  platform/
    services.ts                persistent browser PlayerStorage fallback, memory last resort
  meta/
    AttemptTimer.ts            generic pause-aware timer with restored elapsed support
    GameStats.ts               pure Standard/Classic played/wins/best rules
    MetaSave.ts                V1 -> V2 migration and ModeStats normalization
    MetaRepository.ts          same newest-snapshot write queue, now typed to MetaSaveV2
  game/
    model/
      GameSession.ts           pure resume(Deal)
      GameFlow.ts              pure resume(Deal, playing/menu-paused)
    view/
      GameCompleteView.ts      native DOM Standard/Classic victory summary
    scenes/
      GameScene.ts             bootstrap restore, checkpointing, timing, stats, overlays

tests/
  active-game-save.test.ts
  active-game-repository.test.ts
  platform-services.test.ts
  game-session.test.ts
  game-controls.test.ts
  attempt-timer.test.ts
  daily-attempt-timer.test.ts  removed/updated as timer migration lands
  meta-save.test.ts
  game-stats.test.ts
  game-complete-view.test.ts
  session-persistence-wiring.test.ts
  daily-restore-wiring.test.ts
  ordinary-stats-wiring.test.ts
```

---

### Task 1: Persistent browser PlayerStorage fallback

**Files:**
- Modify: `src/platform/services.ts`
- Modify: `tests/platform-services.test.ts`

**Interfaces:**
- Consumes: existing `PlayerStorage`, `TrustedClock`, `PlatformServices`.
- Produces:
  ```ts
  export interface BrowserStorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  }

  export function createBrowserPlayerStorage(
    storage?: BrowserStorageLike | null,
  ): PlayerStorage;

  export function createUnavailablePlatformServices(
    storage?: BrowserStorageLike | null,
  ): PlatformServices;
  ```
- Browser fallback key: `cascadePlayerData`.

- [ ] **Step 1: Write failing persistence/fallback tests**

Add tests that use a tiny in-memory `BrowserStorageLike` fake shared by two independently created adapters:

```ts
class FakeStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('browser player storage survives adapter recreation', async () => {
  const storage = new FakeStorage();
  await createBrowserPlayerStorage(storage).save({ cascadeMeta: { version: 1 } });

  assert.deepEqual(
    await createBrowserPlayerStorage(storage).load(),
    { cascadeMeta: { version: 1 } },
  );
});

test('unavailable platform falls back safely when browser storage throws', async () => {
  const broken = {
    getItem(): string | null { throw new Error('blocked'); },
    setItem(): void { throw new Error('blocked'); },
  };
  const platform = createUnavailablePlatformServices(broken);

  await platform.playerStorage.save({ value: 7 });
  assert.deepEqual(await platform.playerStorage.load(), { value: 7 });
  assert.equal(platform.trustedClock.nowMs(), null);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm test -- tests/platform-services.test.ts
```

Expected: FAIL because `createBrowserPlayerStorage`/injected persistent fallback do not exist.

- [ ] **Step 3: Implement browser-first, memory-last fallback**

Rules:

```ts
const PLAYER_DATA_KEY = 'cascadePlayerData';
```

`createBrowserPlayerStorage(storage)` must JSON-serialize one root object. If `getItem`, JSON parse, or `setItem` throws, the adapter must transparently continue with its internal memory snapshot instead of propagating the browser exception.

`createUnavailablePlatformServices()` should resolve `globalThis.localStorage` inside a try/catch when no storage is injected. Do not access `window.localStorage` at module evaluation time.

- [ ] **Step 4: Run GREEN and regression**

```bash
pnpm test -- tests/platform-services.test.ts
pnpm test
```

Expected: focused tests PASS; full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/services.ts tests/platform-services.test.ts
git commit -m "feat: persist fallback player data locally"
```

---

### Task 2: Active game save schema and browser-local repository

**Files:**
- Create: `src/persistence/ActiveGameSave.ts`
- Create: `src/persistence/ActiveGameRepository.ts`
- Create: `tests/active-game-save.test.ts`
- Create: `tests/active-game-repository.test.ts`

**Interfaces:**
- Consumes: `GameMode`, `SolitaireSnapshot`, `Deal`, `Card`, `SUITS` from model types; `createCard()` for canonical card reconstruction.
- Produces:

```ts
export const ACTIVE_GAME_SAVE_VERSION = 1 as const;

export interface ActiveGameSaveV1 {
  version: 1;
  mode: GameMode;
  seed: string;
  snapshot: SolitaireSnapshot;
  attemptStarted: boolean;
  elapsedMs: number;
  daily?: {
    dailyId: string;
    algorithmVersion: number;
  };
  uiState: 'playing' | 'menu-paused';
}

export interface ActiveGameCheckpointInput {
  mode: GameMode;
  seed: bigint;
  snapshot: SolitaireSnapshot;
  attemptStarted: boolean;
  elapsedMs: number;
  daily?: ActiveGameSaveV1['daily'];
  uiState: ActiveGameSaveV1['uiState'];
}

export function createActiveGameSave(
  input: ActiveGameCheckpointInput,
): ActiveGameSaveV1;

export function normalizeActiveGameSave(raw: unknown): ActiveGameSaveV1 | null;
export function activeGameSaveToDeal(save: ActiveGameSaveV1): Deal;

export interface ActiveGameStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ActiveGameRepository {
  constructor(storage?: ActiveGameStorageLike | null);
  load(): ActiveGameSaveV1 | null;
  save(save: ActiveGameSaveV1): void;
  clear(): void;
}
```

Repository key: `cascadeActiveGame`.

- [ ] **Step 1: Write failing schema tests**

Use a full 52-card deal from existing deal generation, convert it to a snapshot, then verify:

```ts
const normalized = normalizeActiveGameSave(JSON.parse(JSON.stringify(save)));
assert.equal(normalized?.seed, seed.toString());
assert.deepEqual(normalized?.snapshot.stock.map((card) => card.id), snapshot.stock.map((card) => card.id));
assert.equal(activeGameSaveToDeal(normalized!).seed, seed);
```

Also assert rejection for:

```text
unknown version
mode outside original/winnable/daily
seed "0" / non-BigInt decimal
negative or NaN elapsedMs
not exactly seven tableau piles
missing foundation suit
invalid rank/suit/id/color
same card id in two zones
ordinary save with daily metadata
daily save without daily metadata
Daily id not YYYY-MM-DD
algorithmVersion <= 0
card total != 52
```

- [ ] **Step 2: Run schema RED**

```bash
pnpm test -- tests/active-game-save.test.ts
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement strict normalization**

Normalize every card by validating `{id,suit,rank,color}`, then rebuilding through `createCard(suit, rank)` and requiring the incoming id/color to equal canonical values. Gather all zones and reject unless there are exactly 52 unique card ids.

Convert seed with:

```ts
const seed = BigInt(raw.seed);
if (seed <= 0n) return null;
```

Catch conversion errors and return `null`.

- [ ] **Step 4: Write repository RED tests**

Verify save/load/clear across repository recreation, corrupt JSON -> `null`, and throwing storage -> safe no-op/null.

- [ ] **Step 5: Implement repository**

`load()` parses and calls `normalizeActiveGameSave`; invalid data should be removed best-effort. `save()` writes only normalized/created state. Storage errors never escape.

- [ ] **Step 6: Run GREEN and full regression**

```bash
pnpm test -- tests/active-game-save.test.ts tests/active-game-repository.test.ts
pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add src/persistence/ActiveGameSave.ts src/persistence/ActiveGameRepository.ts tests/active-game-save.test.ts tests/active-game-repository.test.ts
git commit -m "feat: add active game checkpoints"
```

---

### Task 3: Pure model/session resume API

**Files:**
- Modify: `src/game/model/GameSession.ts`
- Modify: `src/game/model/GameFlow.ts`
- Modify: `tests/game-session.test.ts`
- Modify: `tests/game-controls.test.ts`

**Interfaces:**
- Consumes: normalized `Deal` from Task 2; no persistence imports.
- Produces:

```ts
GameSession.resume(deal: Deal): Deal
GameFlow.resume(
  deal: Deal,
  state: 'playing' | 'menu-paused',
): Deal
```

- [ ] **Step 1: Write GameSession RED test**

```ts
test('resume installs the exact saved deal without re-dealing', () => {
  const session = new GameSession({ nextSeed: () => 999n, winnableSeeds: [101n] });
  const resumed = session.resume(savedDeal);

  assert.equal(resumed.seed, savedDeal.seed);
  assert.equal(resumed.mode, savedDeal.mode);
  assert.deepEqual(resumed.tableau, savedDeal.tableau);
  assert.deepEqual(resumed.stock, savedDeal.stock);
});
```

Ensure the returned/held deal clones mutable arrays rather than aliasing caller arrays.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/game-session.test.ts tests/game-controls.test.ts
```

Expected: FAIL because `resume()` does not exist.

- [ ] **Step 3: Implement pure clone/resume**

Add a private `cloneDeal(deal)` helper in `GameSession.ts` that clones tableau/stock/waste/foundations and passes through immutable cards, seed, mode, freeCell. `resume()` stores the clone and returns it.

`GameFlow.resume()` must reject `menu-required`, accept only `'playing' | 'menu-paused'`, call `session.resume(deal)`, set `pendingMode = deal.mode`, and set the requested flow state.

- [ ] **Step 4: Add flow restore tests**

Verify both restored states:

```ts
flow.resume(savedDeal, 'playing');
assert.equal(flow.state, 'playing');
assert.equal(flow.selectedMode, savedDeal.mode);

flow.resume(savedDeal, 'menu-paused');
assert.equal(flow.state, 'menu-paused');
assert.equal(flow.canCancelMenu, true);
```

- [ ] **Step 5: Run GREEN/full regression**

```bash
pnpm test -- tests/game-session.test.ts tests/game-controls.test.ts
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/game/model/GameSession.ts src/game/model/GameFlow.ts tests/game-session.test.ts tests/game-controls.test.ts
git commit -m "feat: resume saved solitaire deals"
```

---

### Task 4: Generic attempt timer with restored elapsed duration

**Files:**
- Create: `src/meta/AttemptTimer.ts`
- Delete: `src/meta/DailyAttemptTimer.ts`
- Create: `tests/attempt-timer.test.ts`
- Delete: `tests/daily-attempt-timer.test.ts`
- Modify: `src/game/scenes/GameScene.ts` only to rename the existing Daily import/class; no new persistence behavior yet.

**Interfaces:**
- Produces:

```ts
export class AttemptTimer {
  get running(): boolean;
  get paused(): boolean;
  start(nowMs: number, initialElapsedMs?: number): void;
  elapsed(nowMs: number): number;
  pause(nowMs: number): void;
  resume(nowMs: number): void;
  finish(nowMs: number): number;
  reset(): void;
}
```

`elapsed(nowMs)` returns non-negative rounded accumulated time without mutating timer state. `finish()` retains the existing minimum successful value of `1` ms.

- [ ] **Step 1: Write timer RED tests**

Cover restored duration explicitly:

```ts
timer.start(1000, 4500);
assert.equal(timer.elapsed(1250), 4750);
timer.pause(1500);
assert.equal(timer.elapsed(9999), 5000);
timer.resume(12000);
assert.equal(timer.finish(12500), 5500);
```

Reject negative/non-finite initial elapsed and backwards timestamps.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/attempt-timer.test.ts
```

- [ ] **Step 3: Extract implementation without changing Daily semantics**

Move current `DailyAttemptTimer` behavior into `AttemptTimer`, add restored elapsed plus `elapsed()`, update `GameScene` to import `AttemptTimer`, then delete `DailyAttemptTimer.ts` and its old test. The new `attempt-timer.test.ts` must contain all previous Daily timer cases plus the restored-elapsed cases, so no coverage is lost.

- [ ] **Step 4: Run GREEN/full regression**

```bash
pnpm test -- tests/attempt-timer.test.ts tests/daily-scene-wiring.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add -A src/meta src/game/scenes/GameScene.ts tests/attempt-timer.test.ts tests/daily-attempt-timer.test.ts
git commit -m "refactor: generalize attempt timer"
```

---

### Task 5: Standard/Classic active-session bootstrap and checkpoint lifecycle

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Create: `tests/session-persistence-wiring.test.ts`
- Modify: `tests/game-session.test.ts` only if architecture guard needs the new `src/persistence/**` boundary reflected.

**Interfaces:**
- Consumes: `ActiveGameRepository`, `ActiveGameSaveV1`, `createActiveGameSave`, `activeGameSaveToDeal`, `AttemptTimer`, `GameFlow.resume()`.
- Produces GameScene private coordination methods with these responsibilities:

```ts
private activeGameRepository!: ActiveGameRepository;
private pendingActiveSave: ActiveGameSaveV1 | null;
private readonly attemptTimer = new AttemptTimer();
private attemptStarted = false;

private tryRestoreOrdinarySession(): boolean;
private checkpointActiveGame(gameState: SolitaireGame): void;
private getElapsedForCheckpoint(): number;
private handlePageHide(): void;
```

Do not introduce ordinary stats yet.

- [ ] **Step 1: Write source/wiring RED tests**

The test should assert structural contracts rather than CSS/pixels:

```text
GameScene constructs ActiveGameRepository during create/boot
local checkpoint load happens before/independently of await initializePlatform()
original/winnable saves call flow.resume(activeGameSaveToDeal(save), save.uiState)
restored board starts from saved snapshot rather than playInitialDeal animation
attemptStarted is restored from save
AttemptTimer starts with save.elapsedMs only when attemptStarted is true
pagehide listener exists and checkpoints
visibility/menu pause routes checkpoint elapsed time
on successful undo/settled action checkpoint path exists
ordinary win clears the unfinished checkpoint and leaves the completed board visible; Task 9 replaces that exact branch with stats-first finalization before clear
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/session-persistence-wiring.test.ts
```

- [ ] **Step 3: Refactor `startDeal` into new-vs-restored board startup**

Use an options object instead of boolean flags:

```ts
interface StartDealOptions {
  readonly restored?: ActiveGameSaveV1;
}

private startDeal(deal: Deal, options: StartDealOptions = {}): void
```

For a new deal:
- clear history;
- create `SolitaireGame(deal)`;
- create the first checkpoint immediately with `attemptStarted: false`, `elapsedMs: 0`;
- run `board.playInitialDeal()`.

For a restored ordinary deal:
- clear history;
- create `SolitaireGame(deal)` from saved zones;
- sync/render the board directly in settled state; do not replay the initial deal animation;
- restore `attemptStarted` and timer accumulated time;
- if saved `uiState === 'menu-paused'`, show menu over the restored board;
- do not increment any attempts in this task.

Add the explicit public API:

```ts
BoardView.showRestoredState(): void
```

It must sync the current logical game without auto-foundation or animations and unlock input. `GameScene` decides whether the menu overlays it; BoardView does not know persistence or flow state.

- [ ] **Step 4: Centralize checkpoint calls at settled boundaries**

After each logical player transaction plus automatic chain settles, call `checkpointActiveGame(gameState)`. Add one required scene callback to `BoardActions`:

```ts
readonly settled: () => void;
```

Invoke it after successful undo animation finishes and after any BoardView path that returns to a fully settled player-input state without already routing through `autoFoundationStep -> onBoardSettled`. The callback routes to `GameScene.onBoardSettled(gameState)`. BoardView remains unaware of persistence.

Checkpoint on menu open, hidden transition, and `pagehide` after pausing/reading timer elapsed.

- [ ] **Step 5: Verify ordinary reload behavior**

Focused tests must cover save state `attemptStarted: false` and `true`, plus `playing` and `menu-paused`.

```bash
pnpm test -- tests/session-persistence-wiring.test.ts tests/undo-wiring.test.ts tests/daily-scene-wiring.test.ts
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/game/scenes/GameScene.ts src/game/view/BoardView.ts tests/session-persistence-wiring.test.ts tests/undo-wiring.test.ts
git commit -m "feat: restore ordinary games after reload"
```

---

### Task 6: Trusted Daily session restore

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Create: `tests/daily-restore-wiring.test.ts`
- Modify: `tests/daily-scene-wiring.test.ts`

**Interfaces:**
- Consumes: existing `DailyContext`, `getDailyId`, `getDailySeed`, `AttemptTimer`, active save from Task 2.
- Produces:

```ts
private pendingDailyRestore: ActiveGameSaveV1 | null;
private tryRestoreDailySession(save: ActiveGameSaveV1): boolean;
```

- [ ] **Step 1: Write Daily restore RED tests**

Verify source/behavior contracts:

```text
Daily active save is not resumed in synchronous local bootstrap
initializeMeta() derives trusted dailyId first
restore requires save.daily.dailyId === current dailyId
restore requires save.daily.algorithmVersion === metaState.daily.algorithmVersion
restore requires BigInt(save.seed) === dailyContext.seed
stale/mismatched Daily save is cleared
no Date.now()/new Date() path validates Daily identity
Daily restored attempt uses persisted elapsed and attemptStarted
restored started Daily does not call beginDailyAttempt again
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/daily-restore-wiring.test.ts tests/daily-scene-wiring.test.ts
```

- [ ] **Step 3: Implement deferred Daily restore**

At local bootstrap, retain a valid Daily checkpoint as `pendingDailyRestore` and keep the normal menu while platform init proceeds. After trusted context exists, validate all three identities: `dailyId`, algorithm version, and deterministic seed.

On success:
- `flow.resume(deal, save.uiState)`;
- hide/replace menu as appropriate;
- restore board directly;
- restore Daily timer accumulated elapsed;
- preserve `dailyAttemptStarted = save.attemptStarted`.

On stale/invalid identity: `activeGameRepository.clear()` and continue with current Daily menu state.

- [ ] **Step 4: Run GREEN/full regression**

```bash
pnpm test -- tests/daily-restore-wiring.test.ts tests/daily-scene-wiring.test.ts tests/daily-calendar.test.ts tests/daily-progress.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/GameScene.ts tests/daily-restore-wiring.test.ts tests/daily-scene-wiring.test.ts
git commit -m "feat: restore current Daily after trusted validation"
```

---

### Task 7: MetaSave V2 migration and pure ordinary statistics

**Files:**
- Modify: `src/meta/MetaSave.ts`
- Modify: `src/meta/MetaRepository.ts`
- Modify: `src/meta/DailyProgress.ts`
- Create: `src/meta/GameStats.ts`
- Modify: `tests/meta-save.test.ts`
- Modify: `tests/meta-repository.test.ts`
- Modify: `tests/daily-progress.test.ts`
- Create: `tests/game-stats.test.ts`

**Interfaces:**
- Produces:

```ts
export const META_SAVE_VERSION = 2 as const;

export interface ModeStats {
  played: number;
  wins: number;
  bestTimeMs?: number;
}

export interface MetaSaveV2 {
  version: 2;
  collection: MetaSaveV1['collection'];
  equipped: MetaSaveV1['equipped'];
  achievements: string[];
  stats: {
    original: ModeStats;
    winnable: ModeStats;
  };
  daily: MetaSaveV1['daily'];
  weekly: MetaSaveV1['weekly'];
}

export type MetaSave = MetaSaveV2;
export function createDefaultMetaSave(): MetaSaveV2;
export function normalizeMetaSave(raw: unknown): MetaSaveV2;

export type OrdinaryGameMode = 'original' | 'winnable';

export interface ModeCompletionResult {
  state: MetaSaveV2;
  stats: ModeStats;
  improvedBest: boolean;
}

export function beginModeAttempt(
  state: MetaSaveV2,
  mode: OrdinaryGameMode,
): MetaSaveV2;

export function completeModeAttempt(
  state: MetaSaveV2,
  mode: OrdinaryGameMode,
  elapsedMs: number,
): ModeCompletionResult;

export function getModeStats(
  state: MetaSaveV2,
  mode: OrdinaryGameMode,
): ModeStats;
```

- [ ] **Step 1: Write V1 -> V2 migration RED tests**

Construct a populated V1 containing collection/equipped/achievements, multiple Daily records, and weekly milestones. Assert all fields survive and both stats modes start at `{played:0,wins:0}`.

Add V2 normalization cases:

```text
negative/fractional played -> 0
negative/fractional wins -> 0
wins > played -> clamp to played
best <= 0/non-finite -> removed
wins === 0 -> best removed
malformed original stats does not destroy valid winnable/Daily fields
```

- [ ] **Step 2: Run MetaSave RED**

```bash
pnpm test -- tests/meta-save.test.ts tests/meta-repository.test.ts tests/daily-progress.test.ts
```

Expected: failures because only V1 is accepted/returned.

- [ ] **Step 3: Implement migration and update existing meta types**

Keep an internal `MetaSaveV1` type solely for migration compatibility. All runtime helpers/repository should return/use `MetaSaveV2` (or alias `MetaSave`). DailyProgress signatures change from `MetaSaveV1` to `MetaSave` with no behavior change.

- [ ] **Step 4: Write GameStats RED tests**

```ts
let state = createDefaultMetaSave();
state = beginModeAttempt(state, 'winnable');
assert.deepEqual(getModeStats(state, 'winnable'), { played: 1, wins: 0 });

const first = completeModeAttempt(state, 'winnable', 5000);
assert.equal(first.stats.wins, 1);
assert.equal(first.stats.bestTimeMs, 5000);
assert.equal(first.improvedBest, true);
```

Then a second attempt + slower win preserves 5000; third faster win replaces it. Type-level/source test should ensure `'daily'` is not an accepted ordinary mode.

- [ ] **Step 5: Implement pure statistics rules**

`beginModeAttempt` increments only selected mode `played`. `completeModeAttempt` requires positive finite elapsed, increments wins but must never silently create a win beyond played; throw if completion is called with `wins >= played` because the scene must begin an attempt first.

- [ ] **Step 6: Run GREEN/full regression**

```bash
pnpm test -- tests/meta-save.test.ts tests/meta-repository.test.ts tests/daily-progress.test.ts tests/game-stats.test.ts
pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add src/meta/MetaSave.ts src/meta/MetaRepository.ts src/meta/DailyProgress.ts src/meta/GameStats.ts tests/meta-save.test.ts tests/meta-repository.test.ts tests/daily-progress.test.ts tests/game-stats.test.ts
git commit -m "feat: add persistent ordinary game statistics"
```

---

### Task 8: Pre-load MetaSave mutation replay queue

**Files:**
- Create: `src/meta/MetaMutationQueue.ts`
- Create: `tests/meta-mutation-queue.test.ts`

**Interfaces:**
- Consumes: `MetaSave` from Task 7.
- Produces:

```ts
export type MetaMutation = (state: MetaSave) => MetaSave;

export class MetaMutationQueue {
  get loaded(): boolean;
  get pendingCount(): number;
  apply(state: MetaSave, mutation: MetaMutation): MetaSave;
  settleLoadedState(loaded: MetaSave): MetaSave;
}
```

Behavior:
- before remote load settles, `apply(current, mutation)` applies the mutation immediately to runtime state and queues the pure mutation;
- `settleLoadedState(loaded)` replays queued mutations in order over loaded state exactly once, clears the queue, and marks the queue loaded;
- after load, `apply()` only mutates the passed state and does not queue;
- a second `settleLoadedState()` call throws `Error('Meta state was already settled.')`.

- [ ] **Step 1: Write mutation-queue RED tests**

```ts
const queue = new MetaMutationQueue();
let runtime = createDefaultMetaSave();
runtime = queue.apply(runtime, (state) => beginModeAttempt(state, 'winnable'));
runtime = queue.apply(
  runtime,
  (state) => completeModeAttempt(state, 'winnable', 4000).state,
);

assert.equal(queue.pendingCount, 2);

const base = createDefaultMetaSave();
const remote: MetaSave = {
  ...base,
  stats: {
    original: { played: 2, wins: 1, bestTimeMs: 9000 },
    winnable: { played: 10, wins: 3, bestTimeMs: 3000 },
  },
};
const merged = queue.settleLoadedState(remote);

assert.deepEqual(merged.stats.original, remote.stats.original);
assert.deepEqual(merged.stats.winnable, { played: 11, wins: 4, bestTimeMs: 3000 });
assert.equal(queue.loaded, true);
assert.equal(queue.pendingCount, 0);
assert.throws(
  () => queue.settleLoadedState(remote),
  /Meta state was already settled/,
);
```

Also verify `apply()` after settle changes state but leaves `pendingCount === 0`.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/meta-mutation-queue.test.ts
```

Expected: FAIL because `MetaMutationQueue` does not exist.

- [ ] **Step 3: Implement pure queue**

The queue must contain only pure functions. No repository, Phaser, DOM, Yandex, or browser-storage imports.

- [ ] **Step 4: Run GREEN/full regression**

```bash
pnpm test -- tests/meta-mutation-queue.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/meta/MetaMutationQueue.ts tests/meta-mutation-queue.test.ts
git commit -m "feat: queue meta mutations before cloud load"
```

---

### Task 9: Ordinary attempt timing and persistent statistics scene integration

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Create: `tests/ordinary-stats-wiring.test.ts`
- Modify: `tests/session-persistence-wiring.test.ts`
- Modify: `tests/daily-scene-wiring.test.ts`
- Modify: `tests/daily-restore-wiring.test.ts`

**Interfaces:**
- Consumes: `MetaMutationQueue`, `beginModeAttempt`, `completeModeAttempt`, `AttemptTimer`, active checkpoint APIs.
- Produces the unified runtime attempt state:

```ts
private readonly metaMutations = new MetaMutationQueue();
private readonly attemptTimer = new AttemptTimer();
private attemptStarted = false;
private attemptFinalized = false;
```

- [ ] **Step 1: Write ordinary scene RED tests**

Verify:

```text
first ordinary settled/playable boundary -> beginModeAttempt exactly once
timer starts at that same boundary
checkpoint after boundary has attemptStarted=true
restored checkpoint with attemptStarted=true -> no begin mutation
Restart -> new deal eventually increments played again
New Game -> new deal eventually increments played again
menu/hidden pauses ordinary timer and checkpoints elapsed
visible/menu-close resumes only while playing
ordinary win finalizes once, updates wins/best, then clears active checkpoint
ordinary completion before remote meta load is replayed over loaded stats exactly once
existing remote statistics survive the replay
Daily still uses DailyProgress and never writes GameStats
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/ordinary-stats-wiring.test.ts tests/session-persistence-wiring.test.ts tests/daily-scene-wiring.test.ts tests/daily-restore-wiring.test.ts
```

- [ ] **Step 3: Unify Daily/ordinary timer state**

Replace Daily-only timer flags with the generic fields above. At the first settled boundary:

```text
if restored attemptStarted -> do not count again; only establish correct pause/resume state
else -> mark started, start timer, then mutate metadata by mode
Daily -> beginDailyAttempt
original/winnable -> beginModeAttempt through metaMutations.apply
```

After the state mutation, save meta if a repository is already available, update menu state where relevant, and checkpoint the active game with the now-true `attemptStarted`.

- [ ] **Step 4: Finalize wins by mode exactly once**

Guard with `attemptFinalized`. Finish the timer once.

Daily path remains:

```text
completeDailyAttempt
flush meta save
clear active checkpoint
show DailyCompleteView
```

Ordinary path becomes:

```text
completeModeAttempt through metaMutations.apply
save/flush newest meta when repository is available
clear active checkpoint only after state finalization
store the completion result for Task 10 view wiring
leave completed board visible
```

Do not show `DailyCompleteView` for ordinary modes.

- [ ] **Step 5: Merge remote MetaSave without losing pre-load events**

`initializeMeta()` must use this order:

```ts
const loaded = await this.metaRepository.load();
this.metaState = this.metaMutations.settleLoadedState(loaded);
if (this.metaMutations.loaded) {
  void this.metaRepository.save(this.metaState);
}
```

Do not assign `loaded` directly over runtime `metaState` before replay. It is fine to save the merged state unconditionally once after settle; repository coalescing handles the write.

- [ ] **Step 6: Preserve checkpoint/timer semantics**

Menu open, hidden document, and `pagehide` must pause/read the single active timer regardless of mode. Resume only when `attemptStarted && !attemptFinalized && flow.state === 'playing' && document.visibilityState === 'visible'`.

- [ ] **Step 7: Run focused/full verification**

```bash
pnpm test -- tests/ordinary-stats-wiring.test.ts tests/meta-mutation-queue.test.ts tests/session-persistence-wiring.test.ts tests/daily-scene-wiring.test.ts tests/daily-restore-wiring.test.ts
pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/GameScene.ts tests/ordinary-stats-wiring.test.ts tests/session-persistence-wiring.test.ts tests/daily-scene-wiring.test.ts tests/daily-restore-wiring.test.ts
git commit -m "feat: persist ordinary attempt statistics"
```

---

### Task 10: Standard/Classic completion overlay

**Files:**
- Create: `src/game/view/GameCompleteView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Create: `tests/game-complete-view.test.ts`
- Modify: `tests/ordinary-stats-wiring.test.ts`

**Interfaces:**
- Produces:

```ts
export interface GameCompleteState {
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly bestTimeMs: number;
  readonly improvedBest: boolean;
  readonly wins: number;
  readonly played: number;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
}

export class GameCompleteView {
  constructor(scene: Phaser.Scene, actions: GameCompleteActions);
  show(state: GameCompleteState): void;
  hide(): void;
  destroy(): void;
}
```

- [ ] **Step 1: Write view RED tests**

Use the existing DOM-view source-testing pattern. Verify:

```text
ПОБЕДА
mode label mapping winnable -> СТАНДАРТ, original -> КЛАССИКА
elapsed and best formatting path
Новый рекорд conditional path
Победы: X / Y
Math.round(wins / played * 100) derived display
ЕЩЁ ПАРТИЯ invokes newGame
В МЕНЮ invokes menu
```

Do not assert exact dimensions, colors, or pixel values.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/game-complete-view.test.ts
```

- [ ] **Step 3: Implement DOM view using existing host/style conventions**

Mirror `DailyCompleteView` lifecycle/host attachment patterns, but do not subclass or merge the views. Share a tiny time-format helper only if duplication is material; otherwise keep the task local.

CSS may share existing parchment/bronze variables/classes, but tests must not freeze styling constants.

- [ ] **Step 4: Wire ordinary completion actions**

On ordinary win, show `GameCompleteView` with completion result from Task 9.

`ЕЩЁ ПАРТИЯ`:

```ts
this.gameCompleteView.hide();
this.startNewDeal();
```

This must use `GameFlow.startNewInCurrentMode()`, therefore fresh seed for original/winnable.

`В МЕНЮ` hides the completion view and opens the menu over the completed board. Do not clear/replace the board until Play selects/starts another deal.

Starting/restarting any new deal must hide both completion views.

- [ ] **Step 5: Run focused/full verification**

```bash
pnpm test -- tests/game-complete-view.test.ts tests/ordinary-stats-wiring.test.ts tests/daily-complete-view.test.ts tests/daily-scene-wiring.test.ts
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/game/view/GameCompleteView.ts src/game/scenes/GameScene.ts src/styles.css tests/game-complete-view.test.ts tests/ordinary-stats-wiring.test.ts
git commit -m "feat: add ordinary game win summary"
```

---

### Task 11: Phase B final integration, truth docs, and moderation register

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Regenerate: `TREE.txt`
- Modify: `docs/superpowers/specs/2026-09-04-persistent-stats-win-summary-design.md` only if implementation forced a factual interface/name change; do not silently change product requirements.
- Keep: this plan file.

**Interfaces:** none; documentation/final verification only.

- [ ] **Step 1: Run context and inspect actual tree**

```bash
pnpm context
git status --short
```

Keep the generator-produced `TREE.txt` even if it differs from a hand-written tree.

- [ ] **Step 2: Update CURRENT_STATE with implemented behavior**

Record at minimum:

```text
unfinished Standard/Classic resumes after F5
current Daily resumes only after trusted-date validation
active checkpoint key cascadeActiveGame is browser-local
active checkpoint includes board zones, mode/seed, attemptStarted, elapsed time, ui state
pre-refresh undo history intentionally resets
fallback PlayerStorage uses localStorage, memory only when unavailable
MetaSave V2 ordinary stats: played/wins/best per Standard/Classic
reload does not double-count played; Restart does
ordinary timer excludes menu/hidden/closed-page time
ordinary win overlay and actions
moderation follow-up: language auto-detection, unified game_api pause/resume, ads, platform declarations/mobile verification, release F5 checklist
```

- [ ] **Step 3: Update TECH architecture/constraints**

Document `src/persistence/**`, `AttemptTimer`, `GameStats`, `MetaMutationQueue`, `GameCompleteView`, and exact separation between active local checkpoint vs cloud/meta repository.

- [ ] **Step 4: Full verification**

Run fresh:

```bash
pnpm test
pnpm build
```

Required result: zero test failures; build exit code 0. Vite chunk-size warning remains informational unless measurements show a real issue.

- [ ] **Step 5: Manual acceptance checklist**

Manually verify in browser:

```text
A. Standard: make several moves -> F5 -> exact board resumes.
B. Classic: make several moves -> F5 -> exact board resumes.
C. Exhaust stock -> Undo -> stock visual still restores (previous regression).
D. Open menu for several seconds -> return -> timer did not include menu time.
E. Hide tab for several seconds -> return -> timer did not include hidden time.
F. F5 after started ordinary attempt -> played does not increment twice.
G. Restart -> same seed but played increments as a new attempt after ready boundary.
H. New Game -> fresh seed and new attempt.
I. Win ordinary game -> stats update once, active checkpoint clears, ordinary summary appears.
J. ЕЩЁ ПАРТИЯ -> fresh seed same mode.
K. Daily same UTC date -> F5 resumes only after trusted validation.
L. Simulate stale Daily checkpoint -> it is discarded, not resumed from device clock.
M. Disable/mock YaGames -> Standard/Classic + local persistence still work across F5.
```

- [ ] **Step 6: Commit final docs**

```bash
git add CURRENT_STATE.md TECH.md TREE.txt
git commit -m "docs: record session persistence and ordinary stats"
```

---

## Task / ZIP delivery sequence

Implementation should be delivered to the user as one small replacement ZIP per task:

```text
Task 1  persistent browser PlayerStorage fallback
Task 2  ActiveGameSave + ActiveGameRepository
Task 3  pure GameSession/GameFlow resume
Task 4  generic AttemptTimer
Task 5  Standard/Classic restore + checkpoint integration
Task 6  trusted Daily restore
Task 7  MetaSave V2 + GameStats
Task 8  pre-load MetaSave mutation queue
Task 9  ordinary timer/stats scene integration
Task 10 ordinary GameCompleteView
Task 11 docs + final verification
```

Each ZIP contains only files created/modified by that task. The user applies it at the project root, runs the listed verification commands, and commits at the task's commit boundary before proceeding.

## Self-review against spec

- Session Persistence: Tasks 1-6 cover local fallback, active schema/repository, pure restore boundary, restored elapsed time, settled checkpoints, ordinary restore, trusted Daily restore, corruption handling, pagehide, and runtime-only undo history.
- Persistent Statistics: Tasks 7-9 cover MetaSave V2 migration, per-mode stats, derived win-rate inputs, Restart/New Game attempt semantics, abandoned attempts, generic timing, and pre-load Yandex merge/replay.
- Win Summary: Task 10 covers separate native DOM ordinary completion UI and fresh-game/menu actions while leaving Daily overlay unchanged.
- Architecture: model remains persistence/platform-neutral; `GameScene` stays coordinator; active board is not sent to Yandex per move.
- Moderation follow-up: Task 11 records language detection, platform pause/resume, ads, mobile/platform declaration, Game Ready, and release persistence checks without implementing them prematurely.
- No Phase B task changes solitaire legality, Daily seed algorithm, card art, or current responsive visual design.
