# Cascade Solitaire — Yandex Platform Lifecycle Design

**Date:** 2026-09-05  
**Status:** Approved in chat; awaiting written-spec review  
**Scope:** Yandex `game_api_pause` / `game_api_resume`, gameplay markup, timer/input coordination, and lifecycle cleanup.  
**Out of scope:** advertising calls, localization, purchases, economy, audio implementation, gameplay-rule changes, visual redesign.

## 1. Purpose

Cascade Solitaire already has several independent notions of "the game is not actively being played":

- the main menu can cover an unfinished board;
- a completion/result modal can end an attempt;
- the browser tab can become hidden;
- the current attempt timer can be paused;
- Yandex can externally pause the game while showing startup/fullscreen/rewarded ads, purchase UI, or while focus changes.

The next platform-hardening step must unify those conditions enough that they cannot accidentally fight each other.

The concrete goals are:

1. react correctly to Yandex `game_api_pause` and `game_api_resume`;
2. freeze player interaction and Phaser gameplay while Yandex says the game is externally paused;
3. keep the existing attempt timer consistent with menu, visibility, result, and Yandex pause state;
4. add correct `GameplayAPI.start()` / `GameplayAPI.stop()` markup for the game's own gameplay boundaries;
5. never resume gameplay merely because one pause reason disappeared while another reason is still active;
6. keep all raw Yandex SDK access inside `src/platform/yandex.ts`;
7. make startup-ad pause state observable even if it happens while player/meta initialization is still in progress;
8. unsubscribe every SDK listener during scene shutdown;
9. preserve Standard/Classic fallback play when the Yandex SDK or optional gameplay feature is unavailable.

## 2. Existing Architecture to Preserve

The current project already has the following boundaries and they remain authoritative:

- `src/game/scenes/GameScene.ts` coordinates flow, board, attempt timing, persistence, Daily/meta state, platform initialization, statistics, leaderboards, auth, and DOM views.
- `src/meta/AttemptTimer.ts` is the single timer implementation for all game modes.
- `src/platform/services.ts` contains platform-neutral interfaces and unavailable-browser fallbacks.
- `src/platform/yandex.ts` is the only adapter allowed to touch raw Yandex SDK APIs.
- `GameScene` currently resumes the attempt timer only when the attempt has started, is unfinished, the flow is `playing`, and the document is visible.
- `src/game/model/**` remains platform-neutral.
- Active-game checkpoint behavior, leaderboard behavior, Daily identity, solver/deal logic, undo, drag/drop, rendering, and visual assets are unchanged by this work.

This task extends the existing platform boundary; it does not introduce a second Yandex integration path.

## 3. Yandex Semantics Used by This Design

The implementation follows the current Yandex Games behavior:

- `game_api_pause` / `game_api_resume` tell the game when the gaming experience must be paused or resumed.
- These events cover startup/fullscreen/rewarded ads, purchase windows, tab switching, and window minimize/restore.
- Yandex aligns these events with `GameplayAPI.stop()` / `GameplayAPI.start()`.
- If the game has already explicitly stopped gameplay markup (for example because its own menu is open), a subsequent external pause/resume cycle must not make gameplay active again.
- `GameplayAPI.start()` is appropriate when gameplay actually begins or resumes.
- `GameplayAPI.stop()` is appropriate when gameplay is paused or ends, including opening the game's own menu or completing a game.
- `ysdk.on()` subscriptions must have matching `ysdk.off()` cleanup.

Important consequence: external Yandex pause/resume events and the game's own menu/result state are related but not interchangeable.

## 4. Platform-Neutral Interfaces

`PlatformServices` gains two small capabilities.

### 4.1. Platform pause state

Add a platform-neutral service conceptually equivalent to:

```ts
interface PlatformPauseService {
  readonly isPaused: () => boolean;
  readonly subscribe: (listener: (paused: boolean) => void) => () => void;
}
```

Requirements:

- `isPaused()` exposes the last known external platform pause state.
- `subscribe()` immediately gives `GameScene` a way to react to future changes.
- it returns an idempotent unsubscribe function;
- duplicate consecutive pause or resume events do not fan out duplicate logical transitions;
- unavailable/local fallback starts as `false` and never emits events.

The exact names may be adjusted in the implementation plan, but the semantics are fixed.

### 4.2. Gameplay markup

Add a platform-neutral service conceptually equivalent to:

```ts
interface GameplayMarkup {
  readonly start: () => void;
  readonly stop: () => void;
}
```

Requirements:

- Yandex implementation delegates to optional `ysdk.features.GameplayAPI?.start()` / `.stop()`;
- unavailable/local fallback is inert;
- missing optional Yandex feature is inert;
- SDK exceptions never break solitaire gameplay;
- `GameScene` decides *when the game's own state* says gameplay starts/stops;
- raw `GameplayAPI` is never called from `GameScene`.

`LoadingAPI.ready()` remains a separate existing platform concern.

## 5. Capturing Startup Pause Correctly

The Yandex adapter must subscribe to `game_api_pause` and `game_api_resume` as soon as an initialized `ysdk` is available, before waiting on slower player/meta work such as `getPlayer()` or cloud data loading.

The adapter owns the cached `paused` boolean.

This matters because Yandex may show a fullscreen ad at startup. `GameScene` can finish initialization after the external pause began; when it receives `PlatformServices`, it must be able to read `platformPause.isPaused()` and start in the paused state rather than briefly starting gameplay behind the ad.

The platform adapter, not `GameScene`, owns the raw `ysdk.on()` / `ysdk.off()` callbacks.

## 6. GameScene Activity Reconciliation

`GameScene` gains one central lifecycle reconciliation path instead of adding ad-specific or platform-specific timer calls throughout the file.

Conceptually, every relevant transition calls one method such as:

```text
reconcileGameplayActivity()
```

The exact method name is not contractual.

It derives current activity from existing truth rather than maintaining a second game-flow state machine.

Inputs include:

- whether a board exists and has reached its playable/settled boundary;
- `flow.state`;
- whether the attempt has started;
- whether the attempt has finalized;
- whether a result overlay represents a finished game;
- `document.visibilityState`;
- cached Yandex platform pause state.

### 6.1. Attempt timer

The attempt timer runs only when all are true:

- attempt has started;
- attempt is not finalized;
- current flow is `playing`;
- document is visible;
- platform is not externally paused.

Therefore any one of the following pauses it:

- opening the main menu;
- hiding the tab;
- `game_api_pause`;
- finishing the attempt.

Removing one blocker does not resume the timer while another blocker remains.

Examples:

```text
playing
→ open menu
→ game_api_pause
→ game_api_resume
= still paused, because menu is still open
```

```text
playing
→ game_api_pause
→ tab becomes hidden
→ game_api_resume
= still paused, because document is hidden
```

Only after the last blocker disappears may the timer resume.

### 6.2. Input and Phaser motion

While the platform is externally paused:

- board/gameplay input must not mutate the model;
- active Phaser gameplay tweens/timers must not continue advancing behind the platform overlay;
- rendering may remain as the last static frame.

The preferred implementation is to use Phaser scene pause/resume for the external platform suspension, because it naturally freezes scene timers/tweens together.

However:

- `GameScene` must remember whether the pause was caused by this platform lifecycle path;
- it must not blindly `resume()` a scene paused for an unrelated future reason;
- menu/result state still controls logical gameplay independently;
- after `game_api_resume`, the scene may resume rendering/update underneath a menu, but board interaction and the attempt timer remain blocked by existing menu/flow state.

If implementation testing shows Phaser scene pause does not safely freeze the current BoardView interaction path, the plan may instead use an explicit BoardView lifecycle input lock plus tween/timer pause. That would be an implementation substitution, not a change to the behavior defined here.

## 7. GameplayAPI Markup Rules

The game explicitly owns markup for its *internal* gameplay boundaries.

### Call `GameplayAPI.start()` when

all of these are true at the transition point:

- a board is playable;
- flow is `playing`;
- the game is not completed/finalized;
- no game-owned menu/result blocker is active;
- the document is visible;
- the platform is not currently externally paused.

Typical transitions:

- opening deal reaches the playable boundary;
- restored unfinished game becomes playable;
- main menu closes back to an unfinished game;
- a new/restarted game reaches its playable boundary;
- the final local blocker disappears after an external pause has already ended.

### Call `GameplayAPI.stop()` when

the game itself stops or ends gameplay, including:

- main menu opens over a game;
- ordinary or Daily completion finalizes the attempt;
- scene shutdown/teardown while gameplay was active.

### External Yandex pause/resume

`game_api_pause` / `game_api_resume` callbacks are primarily used to pause/resume the actual game state.

The game must **not** build a second unconditional pair of `GameplayAPI.stop()` / `start()` calls directly into those callbacks. Yandex already aligns these events with gameplay markup, including the important rule that a game stopped by its own menu must remain stopped after the external pause ends.

The reconciliation logic may call `GameplayAPI.start()` after `game_api_resume` only when the game had previously stopped markup for one of its own blockers and all blockers are now gone.

This prevents:

```text
menu open
→ external pause
→ external resume
→ accidental GameplayAPI.start()
```

## 8. Visibility Handling

Keep `document.visibilityState` as a first-class local blocker even though Yandex pause events also cover focus/tab changes.

Reasons:

- plain local development has no Yandex events;
- browser lifecycle ordering is not guaranteed to be identical across environments;
- active-game checkpoint logic already uses visibility;
- timer correctness must not depend on SDK availability.

The central reconciliation function makes duplicate visibility/platform transitions idempotent.

Visibility handling continues to checkpoint the active game exactly as it does now.

## 9. Persistence Semantics

This task does not change the save schema.

On external pause:

- pause the timer at the current monotonic time;
- checkpoint the active game at a settled/lifecycle boundary using the existing repository;
- do not increment `played`;
- do not create a new attempt;
- do not finalize statistics.

On resume:

- resume the same attempt only if the existing attempt lifecycle says it may run;
- no new checkpoint schema fields are required for transient platform pause state;
- page reload while externally paused still restores from the ordinary existing saved elapsed time and board state.

Platform pause is ephemeral runtime state, not persistent game progress.

## 10. Subscription Lifetime

After platform initialization, `GameScene` subscribes once to the platform-neutral pause service.

The returned unsubscribe function is stored on the scene.

On Phaser shutdown/destroy:

- invalidate late async work as already done for leaderboard lifecycle;
- unsubscribe platform pause listener;
- remove document lifecycle listeners using existing cleanup patterns;
- stop gameplay markup if this scene had active gameplay;
- never allow an old scene instance to respond to a later SDK event.

Yandex adapter unsubscribe must use the exact callback reference previously supplied to `ysdk.on()`.

## 11. Error Handling and Fallbacks

Platform lifecycle support is best-effort and must never make Standard/Classic unplayable.

- no Yandex SDK → inert pause service + inert gameplay markup;
- no `GameplayAPI` feature → inert markup only;
- no event API → treat external platform pause service as permanently unpaused;
- SDK callback/method throws → swallow at the adapter boundary and preserve local gameplay;
- Daily trusted-time behavior is unchanged;
- leaderboard/auth failures remain unrelated and unchanged.

No user-facing technical error modal is added for lifecycle failures.

## 12. Testing Strategy

Implementation must follow TDD.

### Platform adapter tests

Add/update tests proving:

- unavailable services expose inert pause state and markup;
- Yandex `game_api_pause` changes cached state and notifies subscribers;
- Yandex `game_api_resume` clears cached state;
- duplicate same-state events do not create duplicate logical notifications;
- unsubscribe calls `ysdk.off()` with the original event callback;
- listeners are attached before the mocked `getPlayer()` promise resolves;
- `GameplayAPI.start/stop` delegate when present;
- missing gameplay feature and thrown SDK calls remain non-fatal.

### GameScene lifecycle tests

Add wiring/behavior tests proving:

- playable board starts gameplay markup;
- opening menu stops gameplay markup;
- closing menu restarts it only when visible and not platform-paused;
- completed game stops gameplay markup;
- platform pause pauses the attempt timer;
- platform resume restarts timer only when no other blocker exists;
- `menu → platform pause → platform resume` remains paused;
- `hidden → platform resume` remains paused;
- startup-paused platform does not briefly start the attempt/markup after bootstrap;
- shutdown unsubscribes and prevents stale callbacks.

### Regression

Run:

```bash
pnpm test
pnpm build
```

No gameplay/model tests are intentionally changed except where a wiring test must recognize the new lifecycle integration.

## 13. Real Yandex Draft Acceptance

Use the Yandex debug panel after the automated suite is green.

Required checks:

1. First launch with startup advertising never allows the board/timer to progress behind the external pause.
2. Debug-panel Play/Pause control:
   - pause freezes gameplay;
   - resume restores gameplay when the board was actively playing.
3. Open the main menu:
   - gameplay gamepad indicator becomes stopped/red;
   - trigger external pause/resume;
   - indicator remains stopped after resume because menu is still open.
4. Close menu:
   - gameplay becomes active/green immediately if no external blocker exists.
5. Switch browser tabs:
   - timer does not count hidden time;
   - gameplay does not advance;
   - return resumes only if no menu/result blocker exists.
6. Finish a game:
   - gameplay markup remains stopped while the result view is open.
7. F5 an unfinished game:
   - board and elapsed-time persistence behavior remains correct.
8. Standard/Classic remain playable if optional gameplay-markup APIs are unavailable.

These debug checks are release gates, not automated-unit-test substitutes.

## 14. Explicit Non-Goals

This phase does **not**:

- call `showFullscreenAdv()` or `showRewardedVideo()`;
- decide ad frequency;
- introduce ad rewards;
- add audio or music;
- add a general pause-menu UI;
- change Daily/Weekly/meta rewards;
- change leaderboards;
- change localization;
- alter solitaire rules, solvability, undo, drag/drop, or rendering;
- persist external platform-pause state.

Advertising will be a later bounded layer built on top of this lifecycle, so ad callbacks do not need to invent another pause/timer policy.

## 15. Completion Criteria

The lifecycle phase is complete when:

- platform-neutral pause and gameplay-markup services exist;
- raw Yandex event/feature calls remain isolated to `src/platform/yandex.ts`;
- startup pause state is cached before slow player/meta loading;
- `GameScene` has one reconciliation path for timer and gameplay activity;
- nested blockers cannot accidentally resume an attempt;
- external pause freezes Phaser gameplay/input;
- internal menu/result transitions correctly mark gameplay start/stop;
- SDK absence/errors remain non-fatal;
- subscriptions are cleaned up;
- full tests and build pass;
- the Yandex debug-panel acceptance checklist passes.
