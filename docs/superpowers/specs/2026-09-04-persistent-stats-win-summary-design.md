# Cascade Solitaire — Session Persistence, Persistent Statistics, and Win Summary Design

Date: 2026-09-04
Status: approved for implementation

## Goal

Phase B adds the persistence foundation required for a shippable Yandex Games solitaire before adding ordinary-mode statistics and a reusable win summary.

The order is intentional:

1. restore an unfinished game after page reload;
2. persist Standard/Classic statistics without losing pre-load events;
3. show a generic Standard/Classic completion summary.

This phase does not add economy, progression grind, leaderboards, ads, or new gameplay rules.

The feature must preserve the existing architecture:

- Phaser owns gameplay cards, board interaction, movement, and animation.
- Native DOM owns text-heavy menus and completion overlays.
- `src/game/model/**` stays independent from Yandex/platform services.
- Yandex Player data remains behind platform/persistence adapters.
- Daily keeps its deterministic seed, Daily records, weekly progress, and dedicated Daily completion overlay.

## Platform requirements driving this design

This design was reviewed against the Yandex Games requirements current on 2026-09-04. The requirements page reports a last-change date of 2026-08-18.

Architecture-relevant requirements include:

- 1.2: the game must be usable without mandatory authorization; guest play is supported and guest progress is preserved;
- 1.9: progress must not be lost after page refresh or mobile orientation changes;
- 1.19.2: `LoadingAPI.ready()` must be called when the game is actually ready for the player;
- 2.14: language auto-detection through the Yandex SDK is mandatory, even if only one language is declared;
- 4.2: game state must survive leaving through an advertisement and returning;
- 4.4: advertising must be shown only at logical pauses;
- 4.7: gameplay and sound must pause during fullscreen/rewarded advertising.

Yandex Player `setData()` is not suitable as a per-move checkpoint transport: the SDK currently limits `player.setData()` to 100 calls per 5 minutes. Active-game checkpointing therefore uses browser-local persistence, while cloud/meta writes remain coalesced behind the existing repository boundary.

Language auto-detection, advertising, and the unified platform pause controller are release requirements but are not implemented inside Phase B unless explicitly listed below. They are recorded as follow-up moderation work so they are not forgotten.

## Phase B sequence

### Phase B1 — Session Persistence

- browser-local active-game checkpoint;
- restore unfinished Standard/Classic after reload;
- restore current Daily only after trusted-date validation;
- elapsed-time checkpoint/restore;
- safe corruption handling;
- browser-local fallback for persistent guest/meta data where platform storage is unavailable.

### Phase B2 — Persistent Statistics

- MetaSave schema migration;
- separate Standard and Classic statistics;
- generic ordinary-game timer;
- persistence/load race handling.

### Phase B3 — Standard/Classic Win Summary

- generic native DOM completion overlay;
- ordinary statistics display;
- fresh game / menu actions.

## Product mode naming

Internal model names remain:

- `winnable` = product label `СТАНДАРТ`;
- `original` = product label `КЛАССИКА`;
- `daily` = `ИСПЫТАНИЕ ДНЯ` and remains separate from ordinary-mode statistics.

---

# Phase B1 — Session Persistence

## Persistence goals

A page refresh during a playable deal must not erase the deal.

For a valid unfinished session, restoration must preserve at least:

- mode;
- seed;
- tableau;
- stock;
- waste;
- foundations;
- free cell;
- whether the gameplay attempt has reached the playable/started boundary;
- accumulated attempt time;
- Daily identity when the active mode is Daily.

The persisted state is a checkpoint of the current board, not a replay log.

Undo history remains runtime-only in Phase B1. After reload, the board resumes correctly but the pre-refresh multi-step undo stack is cleared. Persisting every historical snapshot would greatly expand storage and is not required to preserve the current board/progress. This trade-off must be documented in `CURRENT_STATE.md` when implemented.

## ActiveGameSave schema

Active-game persistence has its own schema/version independent from MetaSave.

Conceptual shape:

```ts
export const ACTIVE_GAME_SAVE_VERSION = 1 as const;

interface ActiveGameSaveV1 {
  version: 1;
  mode: GameMode;
  seed: string; // decimal bigint representation
  snapshot: SolitaireSnapshot;
  attemptStarted: boolean;
  elapsedMs: number;
  daily?: {
    dailyId: string;
    algorithmVersion: number;
  };
  uiState: 'playing' | 'menu-paused';
}
```

Rules:

- BigInt seeds are serialized as decimal strings and parsed/validated on load.
- `elapsedMs` must be finite and non-negative.
- `daily` is required only for Daily saves and rejected/ignored for ordinary modes.
- a Daily save without a valid Daily identity is invalid.
- malformed/corrupt active saves never crash boot; they are discarded safely.

The exact persisted card representation may reuse `SolitaireSnapshot` if its JSON representation remains stable and validated. Persistence code must not depend on Phaser objects.

## Active-game repository

Add a browser-local repository dedicated to the active deal, for example:

```text
src/persistence/ActiveGameRepository.ts
```

Responsibilities:

- synchronously or near-synchronously save the latest normalized active checkpoint to browser storage;
- load and normalize the checkpoint at boot;
- clear it when the active deal is definitively complete or intentionally discarded;
- degrade safely if browser storage is unavailable/throws.

Suggested browser key:

```text
cascadeActiveGame
```

The active game is intentionally not written to Yandex Player data after every move. Browser-local persistence is the immediate same-device reload checkpoint. Cloud synchronization of an in-progress board across multiple devices is out of scope for Phase B.

## Browser-local platform fallback

The current no-Yandex fallback stores PlayerStorage data only in memory. Phase B1 replaces that as the normal browser fallback with local persistent storage when available.

Expected hierarchy:

```text
Yandex PlayerStorage available -> use Yandex-backed meta storage
Yandex unavailable             -> browser localStorage-backed meta storage
localStorage unavailable       -> last-resort in-memory storage
```

This preserves Standard/Classic guest/meta progress across refresh outside the SDK environment and keeps gameplay functional in restrictive browsers.

The Yandex adapter itself remains isolated behind `PlayerStorage`.

## Checkpoint boundaries

Do not persist transient animation positions. Save only settled logical state.

Create/replace an active checkpoint:

- when a new deal is created, including before the initial deal animation finishes;
- after the board reaches its first playable settled state;
- after each successful state-changing player transaction has fully settled, including its automatic foundation chain;
- after a successful undo restore;
- when opening the main menu over an active deal;
- when gameplay timing is paused because the document becomes hidden;
- on `pagehide` as a final best-effort elapsed-time checkpoint.

Do not create a new checkpoint for:

- failed/illegal moves that changed no logical state;
- resize/layout changes;
- animation-only frames.

A central board-settled checkpoint is preferred over scattering storage writes through every card animation callback.

## Restore flow — Standard and Classic

Browser-local active-game load must not wait for Yandex SDK initialization.

At boot:

1. read/normalize local active checkpoint;
2. if it is valid Standard/Classic, restore the exact logical deal using the saved mode, seed, and snapshot;
3. restore accumulated attempt time;
4. restore whether the attempt had already crossed the `played` boundary;
5. restore menu-paused vs playing UI state where practical;
6. continue without counting the same attempt as a new attempt again.

A restored ordinary game should resume automatically rather than silently starting a new deal. If the checkpoint is invalid, discard it and follow the normal main-menu startup path.

## Restore flow — Daily

Daily restoration requires trusted current Daily identity.

At boot:

1. local Daily checkpoint may be discovered immediately;
2. do not resume it until platform/meta initialization provides trusted server time;
3. derive the current `dailyId` and deterministic seed using the saved/current Daily algorithm rules;
4. restore only when the checkpoint `dailyId` is still the current Daily and its seed/algorithm identity is valid;
5. if the UTC Daily has changed, discard the stale active Daily checkpoint and show the current Daily state instead.

Daily never falls back to the device clock for challenge identity.

## Restoring a game into the pure model

Persistence must not be imported by `src/game/model/**`.

The model/flow may gain a platform-neutral restoration API, for example:

```ts
GameSession.resume(deal)
GameFlow.resume(deal)
```

or an equivalent pure method that accepts already-normalized game data.

`SolitaireGame` continues to own mutable rules/state. It must not know where the restored data came from.

## Timer checkpoint and restore

`performance.now()` cannot survive a page reload, so persisted timers store accumulated elapsed duration rather than a raw monotonic timestamp.

The generic timer introduced by Phase B must support restoring an existing elapsed duration, conceptually:

```ts
start(nowMs, initialElapsedMs = 0)
```

or an equivalent restore operation.

Checkpoint rules:

- save elapsed duration after settled actions;
- update elapsed duration when menu/visibility pauses timing;
- checkpoint again on `pagehide`;
- time while the page is closed is not counted, consistent with the existing hidden-tab pause semantics;
- resumed Daily and ordinary attempts continue from the stored elapsed duration.

## Clearing/replacing active checkpoints

- New Game replaces the old active checkpoint with the new deal.
- Restart replaces it with the restarted same-seed deal.
- switching modes replaces it once the new deal is actually created.
- winning clears active-game persistence after the completion state/statistics have been finalized safely.
- merely opening the main menu does not clear it.

If a page reload occurs while a completion overlay is already finalized, the completed board must not be restored as an unfinished attempt.

## Active-save validation

Normalization must reject impossible/corrupt structures safely.

At minimum validate:

- known save version;
- valid mode;
- parseable non-zero seed;
- seven tableau piles;
- known suit foundation keys;
- finite non-negative elapsed time;
- no malformed card values;
- no duplicate card IDs across logical zones;
- Daily identity consistency when mode is Daily.

A stricter 52-card invariant is desirable for normal production deals, but validation must account for the snapshot representation correctly before enforcing it.

---

# Phase B2 — Persistent Statistics

## Statistics

Each ordinary mode stores exactly:

```ts
interface ModeStats {
  played: number;
  wins: number;
  bestTimeMs?: number;
}
```

Separate records exist for `winnable` and `original`.

Win rate is derived at display time:

```text
wins / played
```

It is never stored separately.

## When `played` increments

An attempt counts as played once, at the same gameplay-ready boundary used by Daily timing:

1. initial deal animation has finished;
2. initial automatic foundation movement has settled;
3. player input is available.

Each actual new attempt increments `played` exactly once:

- starting Standard from the main menu;
- starting Classic from the main menu;
- `Новая игра` / `N` in Standard or Classic;
- `Restart` / `R` in Standard or Classic.

`Restart` counts as a new attempt even though it preserves the seed.

These do not increment `played`:

- restoring the same active attempt after reload;
- opening/closing the main menu;
- undo;
- resize;
- tab visibility changes.

If the player abandons a started attempt by replacing it with another deal or switching mode, the already-started attempt remains in `played` and does not increment `wins`.

The active checkpoint's `attemptStarted` field prevents a restored attempt from incrementing `played` a second time.

## When `wins` increments

A win is recorded once when all 52 cards reach foundations and the current ordinary attempt has not already been finalized.

On win:

- `wins += 1`;
- timer stops;
- `bestTimeMs` updates only for a first/faster successful result;
- active-game persistence is cleared after finalization;
- completion summary is shown.

Repeated win callbacks must be idempotent. A completed attempt cannot write a second win.

## Classic solvability

Classic (`original`) may be unsolvable by design. No explicit loss result is introduced. An abandoned Classic attempt contributes to `played`, not `wins`.

## Generic attempt timing

Standard and Classic use the same semantics as Daily:

- start when opening/deal automation settles;
- pause under main menu;
- pause while document is hidden;
- resume only when visible and actually playable;
- stop on win;
- reset for a new attempt;
- restore from persisted elapsed duration after reload.

The existing `DailyAttemptTimer` behavior is generic and should be extracted into a shared `AttemptTimer` rather than duplicated.

Daily timing behavior must remain unchanged except for gaining restore-from-elapsed support required by session persistence.

## MetaSave V2

Phase B2 advances MetaSave from version 1 to version 2.

Conceptual shape:

```ts
interface MetaSaveV2 {
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
```

Active-game state is not embedded into MetaSave V2. It has its own local checkpoint schema/key because its write frequency and lifecycle are different.

## MetaSave migration

`normalizeMetaSave()` accepts both V1 and V2.

For V1:

- preserve collection;
- preserve equipped cosmetics;
- preserve achievements;
- preserve every Daily record/attempt/completion/best;
- preserve weekly id/completed Daily ids/claimed milestones;
- initialize both ordinary stats records to defaults;
- return normalized V2.

For V2 mode statistics:

- `played` and `wins` are finite non-negative integers;
- invalid fields fall back safely;
- clamp `wins` to `played` if necessary;
- `bestTimeMs` must be finite and > 0;
- discard best time if normalized wins are zero;
- malformed one-mode stats must not discard unrelated valid save sections.

`MetaRepository` keeps the existing `cascadeMeta` Yandex data key and newest-write queue behavior.

## Meta persistence and browser fallback

Long-lived meta state continues to use Yandex Player storage when available.

Where Yandex storage is unavailable, Phase B1's browser-local PlayerStorage fallback makes ordinary stats persistent across refresh instead of runtime-only.

Storage failures never crash gameplay.

Daily still requires trusted server time; ordinary stats do not.

## Platform initialization race

Standard/Classic must remain immediately playable while Yandex platform/meta load is pending.

Therefore ordinary gameplay must never wait for Yandex before starting/restoring.

Statistics mutations occurring before the remote meta load finishes are queued as ordered pure mutations and replayed over loaded state exactly once.

Conceptually:

```text
boot / local gameplay available
remote meta load pending
attempt begins              -> queue begin mutation
attempt wins                -> queue completion mutation
remote load resolves        -> normalize remote save
                            -> replay queued mutations
                            -> persist newest merged state
```

Required properties:

- a pre-load started attempt is not lost;
- a pre-load win is not lost;
- existing loaded statistics are preserved;
- queued events apply exactly once;
- active-game restore does not duplicate `played`;
- gameplay is never blocked on platform initialization.

Exact cross-device conflict-free merging of simultaneous independent sessions is out of scope for Phase B. The existing Yandex cloud behavior is preserved; Phase B's hard requirement is same-device reload continuity plus safe current-runtime load races.

## Pure statistics domain

Ordinary statistics rules live in a pure module such as:

```text
src/meta/GameStats.ts
```

Conceptual operations:

```ts
beginModeAttempt(state, mode)
completeModeAttempt(state, mode, elapsedMs)
getModeStats(state, mode)
```

Only `original` and `winnable` are accepted. Daily cannot accidentally write into ordinary stats.

---

# Phase B3 — Standard/Classic Completion Summary

## View

Add a native DOM completion view separate from `DailyCompleteView`, suggested:

```text
src/game/view/GameCompleteView.ts
```

Use the existing parchment/bronze DOM language.

## Displayed information

Show:

- `ПОБЕДА`;
- `СТАНДАРТ` or `КЛАССИКА`;
- successful run time;
- best successful time for that mode;
- `Новый рекорд` when appropriate;
- `Победы: X / Y`;
- derived win rate percentage.

The first win is a new best. Win rate may be rounded to a whole percentage.

## Actions

Exactly two primary actions:

- `ЕЩЁ ПАРТИЯ` — fresh seed in the same ordinary mode;
- `В МЕНЮ` — open main menu while leaving the completed board underneath until another game is selected.

`ЕЩЁ ПАРТИЯ` is not Restart:

- Standard gets a fresh solver-proven seed;
- Classic gets a fresh original seed.

Daily retains its own same-seed `ПОВТОРИТЬ` behavior.

---

# GameScene coordination

`GameScene` remains coordinator for:

- flow/session restoration;
- BoardView creation;
- active-game checkpoints;
- attempt timing;
- meta statistics;
- completion overlays;
- visibility/menu pause state.

No Yandex or browser-storage persistence dependency enters `SolitaireGame`, `GameHistory`, `GameSession`, or other model rule files.

## Board-settled routing

The settled boundary routes by mode:

```text
Daily       -> Daily start/win + active checkpoint
Standard    -> ordinary start/win + active checkpoint
Classic     -> ordinary start/win + active checkpoint
```

A checkpoint is taken only after the logical transaction and its automatic chain have settled, never halfway through animation.

## Menu / visibility / platform pause direction

Phase B keeps existing menu/visibility timing semantics and makes them compatible with checkpointing.

On menu open or document hidden:

- pause the active attempt timer;
- checkpoint elapsed duration and active state.

On resume:

- resume only when the active attempt is playable and the document is visible.

A later moderation phase should centralize browser visibility plus Yandex `game_api_pause` / `game_api_resume` into one platform pause controller so advertisements and platform overlays pause both gameplay and audio consistently. Do not add a second incompatible pause state machine in Phase B.

---

# Error handling

- Corrupt active checkpoint -> discard checkpoint, continue to menu safely.
- Browser storage exception -> gameplay continues; use last-resort memory behavior.
- Failed MetaSave load -> safe defaults/current fallback behavior.
- Failed cloud save -> gameplay continues; newest queued state is retained.
- Missing Yandex SDK -> Standard/Classic and browser-local persistence continue.
- Missing trusted clock -> Daily unavailable/restore deferred; ordinary modes unaffected.
- Stale Daily active checkpoint -> discard after trusted Daily identity check.

---

# Testing strategy

Tests protect behavior, not cosmetic pixels.

## Session persistence tests

Verify:

- ActiveGameSave serialize/normalize round trip;
- bigint seed round trip;
- Standard/Classic snapshot restore preserves every gameplay zone;
- corrupt/duplicate-card saves are rejected safely;
- elapsed time restores correctly;
- restored started attempts do not become new attempts;
- active save is replaced on New Game/Restart;
- active save clears on finalized win;
- menu/hidden/pagehide checkpoint paths exist;
- browser local PlayerStorage persists across recreated adapter instances;
- memory remains the last-resort fallback when localStorage is unavailable.

## Daily restore tests

Verify:

- current Daily checkpoint restores only after trusted Daily validation;
- same Daily id/algorithm/seed restores;
- stale Daily id is discarded;
- device clock is never used to validate Daily restore.

## Save/migration tests

Verify:

- V1 -> V2 preserves all Phase A meta fields;
- stats initialize correctly;
- valid V2 stats survive;
- invalid counts/best times normalize safely;
- `wins <= played` invariant.

## Statistics-domain tests

Verify:

- begin increments only `played`;
- completion increments `wins`;
- first/faster win becomes best;
- slower win does not replace best;
- Daily is not accepted by ordinary stats helpers;
- restored attempt does not double-count `played`.

## Timer tests

Verify:

- start;
- start with restored elapsed duration;
- pause/resume;
- paused time excluded;
- finish;
- reset;
- finite/forward timestamp checks.

Existing Daily timer behavior remains green.

## Completion-view tests

Verify API/source wiring for:

- mode label;
- elapsed/best/new-record state;
- wins/played/win rate;
- fresh-game action;
- menu action.

Do not freeze exact CSS dimensions/colors.

## Scene integration tests

Verify boundaries for:

- local active-game bootstrap;
- ordinary restore before Yandex load;
- Daily restore after trusted initialization;
- checkpoint after settled state changes;
- clear checkpoint on win;
- pre-load stat mutation replay exactly once;
- timer/menu/visibility coordination;
- `GameCompleteView` and existing `DailyCompleteView` remain separate;
- no `YaGames`/`ysdk` imports under `src/game/model/**`.

Run full `pnpm test` and production `pnpm build` after integration.

---

# Moderation follow-up register

These are confirmed platform obligations or release risks but are intentionally outside the implementation scope of Phase B unless promoted into a later plan:

1. **SDK language auto-detection (2.14).** At startup use Yandex `environment.i18n.lang`; required even for a one-language game.
2. **Unified platform pause/resume.** Consume Yandex `game_api_pause` / `game_api_resume` and ensure gameplay/audio pause during fullscreen/rewarded ads.
3. **Advertising.** Integrate only through Yandex SDK and only at logical pauses; completion/new-game transitions are candidate locations for this turn-based game.
4. **Responsive/mobile declaration.** Only declare platforms that the actual build supports; verify resize, no clipping/system scrolling, and touch behavior before declaring mobile.
5. **Release persistence test.** Moderation checklist must explicitly test F5 during Standard, Classic, and Daily plus guest/no-auth flow.
6. **Game Ready.** Keep `LoadingAPI.ready()` at the point the build is actually usable, including restoration startup paths.

These items must remain visible in project truth/launch checklist so a later feature pass does not erase them.

---

# Non-goals

Phase B does not add:

- XP;
- currency;
- shop;
- unlock rewards;
- achievement UI;
- win/daily streaks;
- total playtime;
- move/undo counts;
- best move count;
- loss/dead-end detection;
- leaderboard/social comparison;
- ads/IAP implementation;
- full localization implementation;
- card/table/theme selection UI;
- mobile layout redesign;
- gameplay-rule changes;
- Daily seed-algorithm changes;
- cloud continuation of an unfinished board across multiple devices;
- persistence of the entire pre-refresh undo history.

---

# Acceptance criteria

Phase B is complete when all of the following are true:

1. Refreshing a valid unfinished Standard/Classic deal restores its logical board instead of starting over.
2. Active session stores mode, seed, all gameplay zones, started state, and elapsed duration.
3. Active checkpoints are written at settled logical boundaries rather than transient animation frames.
4. Restored attempts do not double-count `played`.
5. Current Daily can resume only after trusted Daily identity validation; stale Daily checkpoints are discarded.
6. Browser-local persistence is used as the normal fallback when Yandex Player storage is unavailable; memory is last resort only.
7. Active board persistence does not call Yandex `setData()` after every move.
8. Existing V1 MetaSave migrates to V2 without losing Daily/weekly data.
9. Standard and Classic independently persist `played`, `wins`, and successful `bestTimeMs`.
10. Win rate is derived, not persisted.
11. Restart is a new attempt; menu/reload resume is not.
12. Abandoned started attempts remain in `played` without becoming wins.
13. Ordinary/Daily timers exclude menu/hidden time and can resume from persisted elapsed duration.
14. Standard/Classic wins finalize exactly once and clear the unfinished-game checkpoint.
15. Generic parchment/bronze DOM win summary shows time, best, wins/played, and win rate.
16. `ЕЩЁ ПАРТИЯ` uses a fresh seed in the same ordinary mode.
17. Daily keeps same-seed retry, Daily best, weekly progress, and trusted-time requirement.
18. Standard/Classic remain playable without trusted time and without waiting for Yandex initialization.
19. Ordinary mutations occurring before remote meta load are merged exactly once over loaded state.
20. No platform/Yandex persistence dependency enters `src/game/model/**`.
21. Existing gameplay rules, undo behavior, responsive layout, assets, and visual language remain unchanged except for explicitly documented restore behavior (undo history resets after page reload).
22. The moderation follow-up register remains documented for later release work.
