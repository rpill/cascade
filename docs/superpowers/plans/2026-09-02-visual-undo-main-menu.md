# Visual, Undo, and Main Menu Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch to the Horizontal2 card faces, add shallow curved flights and safer drop geometry, implement complete-action undo, and make mode selection part of a persistent main menu while New Game remains immediate.

**Architecture:** Keep geometry, Bézier interpolation, snapshots, history, and flow transitions pure and independently testable. `SolitaireGame` owns restorable gameplay state, `GameHistory` owns pre-action snapshots, `GameFlow` owns menu/game transitions, and Phaser views only translate those decisions into input and animation.

**Tech Stack:** TypeScript 5.9, Node test runner, Phaser 3.90, Vite 7, PNG assets from `Decks/Horizontal2/pngs`.

**Spec:** `docs/superpowers/specs/2026-09-02-visual-undo-main-menu-design.md`

## Global Constraints

- Keep deal generation, original draw-three behavior, and the solver-proven seed pool unchanged.
- One undo restores the state before one player action and its complete automatic-foundation chain.
- `НОВАЯ ИГРА N` starts immediately in the current mode; only the main menu changes the mode.
- Use the existing rendered card dimensions and texture keys.
- Do not add runtime dependencies.

---

### Task 1: Horizontal2 artwork and raised board layout

**Files:**
- Modify: `public/assets/cards/*.png`
- Modify: `src/game/view/layout.ts`
- Modify: `src/game/view/BoardView.ts`
- Create: `tests/card-assets.test.ts`
- Modify: `tests/render-config.test.ts`

**Interfaces:**
- Produces: the existing `/assets/cards/<name>.png` URLs backed by Horizontal2 faces and `TABLEAU_Y = 236`.
- Consumes: `Decks/Horizontal2/pngs/*.png`, existing texture keys, and current `CARD_WIDTH`/`CARD_HEIGHT`.

- [ ] **Step 1: Write failing asset and layout tests**

Create `tests/card-assets.test.ts` that enumerates the 52 expected suit/rank filenames, asserts that every runtime file exists, and compares its SHA-256 bytes with `Decks/Horizontal2/pngs`. Extend `tests/render-config.test.ts` with:

```ts
assert.equal(TABLEAU_Y, 236);
assert.doesNotMatch(boardViewSource, /createSlot\(WASTE_X,\s*STOCK_Y/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
& 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test tests/card-assets.test.ts tests/render-config.test.ts
```

Expected: face hashes differ, `TABLEAU_Y` is 260, and `BoardView` still creates the waste rectangle.

- [ ] **Step 3: Replace only the 52 face images**

Copy `club{2..10,Ace,Jack,Queen,King}.png`, `diamond...`, `heart...`, and `spade...` from `Decks/Horizontal2/pngs` to `public/assets/cards`. Do not replace jokers, sprite sheets, or introduce new texture names. `redBack.png` may remain because it is byte-identical.

- [ ] **Step 4: Raise tableau and remove waste placeholder**

Set:

```ts
export const TABLEAU_Y = 236;
```

Delete only `this.createSlot(WASTE_X, STOCK_Y, 0.22);` from `createSlots()`. Keep `WASTE_X` for real waste placement.

- [ ] **Step 5: Run focused and full tests**

Run the focused command, then all Node tests. Expected: all pass.

- [ ] **Step 6: Commit the artwork/layout change**

```powershell
git add public/assets/cards src/game/view/layout.ts src/game/view/BoardView.ts tests/card-assets.test.ts tests/render-config.test.ts
git commit -m "feat: switch to horizontal card faces"
```

### Task 2: Shallow curved card flights

**Files:**
- Create: `src/game/view/CardFlight.ts`
- Modify: `src/game/view/CardAnimation.ts`
- Modify: `src/game/view/BoardView.ts`
- Create: `tests/card-flight.test.ts`
- Modify: `tests/card-animation.test.ts`

**Interfaces:**
- Produces: `getCardFlightPoint(start: Point, end: Point, progress: number): Point` and one `BoardView.animateCardTo(...)` path for all non-drag motion.
- Consumes: existing motion durations, placement depths, Phaser counter tweens, and `Point`.

- [ ] **Step 1: Write failing pure curve tests**

Cover exact endpoints, finite coordinates, and midpoint curvature for horizontal and vertical routes:

```ts
assert.deepEqual(getCardFlightPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), { x: 0, y: 0 });
assert.deepEqual(getCardFlightPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 1), { x: 100, y: 0 });
assert.equal(getCardFlightPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5).y, -18);
assert.notEqual(getCardFlightPoint({ x: 0, y: 100 }, { x: 0, y: 0 }, 0.5).x, 0);
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL because `CardFlight.ts` does not exist.

- [ ] **Step 3: Implement the quadratic curve**

Normalize the segment perpendicular, flip it when necessary so its vertical component faces upward, and place the control point 36 pixels away from the linear midpoint. Evaluate:

```ts
const inverse = 1 - progress;
return {
  x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
  y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
};
```

Clamp progress to `[0, 1]`; for a zero-length route return the endpoint.

- [ ] **Step 4: Centralize Phaser flight animation**

Add `activeFlights: Map<Image, Tween>` and `animateCardTo(image, placement, motion, delay, onComplete?)`. Use `scene.tweens.addCounter({ from: 0, to: 1, ... })`, update position with `getCardFlightPoint`, retain active depth for the whole tween, and set resting depth on completion. Stop an image's prior flight before starting another and stop every active flight in `destroy()`.

Replace straight x/y tweens in initial deal, stock draw, `sync('player')`, rejected returns, foundation motion, and undo motion with this helper. Preserve existing durations and draw stagger.

- [ ] **Step 5: Run curve, animation, and full tests**

Expected: all tests pass and no straight non-drag card tween remains in `BoardView`.

- [ ] **Step 6: Commit curved motion**

```powershell
git add src/game/view/CardFlight.ts src/game/view/CardAnimation.ts src/game/view/BoardView.ts tests/card-flight.test.ts tests/card-animation.test.ts
git commit -m "feat: animate card movement along shallow arcs"
```

### Task 3: Deliberate inner-card drop geometry

**Files:**
- Create: `src/game/view/DropGeometry.ts`
- Modify: `src/game/view/BoardView.ts`
- Create: `tests/drop-geometry.test.ts`

**Interfaces:**
- Produces: `isCommittedCardDrop(moving: RectLike, target: RectLike, inset?: number): boolean` with default inset 18.
- Consumes: `tableauCardY`, the moving card bounds, target card/slot bounds, and existing `SolitaireGame.canMove` legality checks.

- [ ] **Step 1: Write failing geometry tests**

Use 108×151 rectangles. Assert a centered moving card is accepted and placements whose centers are at or outside each 18-pixel inset boundary are rejected. Assert a point one pixel inside every boundary is accepted.

- [ ] **Step 2: Run focused test and verify RED**

Expected: FAIL because `DropGeometry.ts` does not exist.

- [ ] **Step 3: Implement the pure committed-drop predicate**

Compute the moving rectangle center and require strict containment in:

```ts
{
  left: target.x + 18,
  right: target.x + target.width - 18,
  top: target.y + 18,
  bottom: target.y + target.height - 18,
}
```

Reject non-finite or non-positive rectangles.

- [ ] **Step 4: Replace broad target rectangles in BoardView**

For each tableau pile, target the actual visible top card rectangle at
`tableauCardY(pile.length, pile.length - 1)`; use `TABLEAU_Y` for an empty pile.
Use exact card rectangles for foundation and free-cell targets. Filter first by
`isCommittedCardDrop`, then by `game.canMove`, then retain nearest-center sorting.

- [ ] **Step 5: Run focused and full tests**

Expected: all pass.

- [ ] **Step 6: Commit safer drop targeting**

```powershell
git add src/game/view/DropGeometry.ts src/game/view/BoardView.ts tests/drop-geometry.test.ts
git commit -m "fix: require deliberate centered card drops"
```

### Task 4: Complete-action undo history

**Files:**
- Modify: `src/game/model/types.ts`
- Modify: `src/game/model/SolitaireGame.ts`
- Create: `src/game/model/GameHistory.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/view/BoardView.ts`
- Create: `tests/game-history.test.ts`
- Modify: `tests/game.test.ts`

**Interfaces:**
- Produces: `SolitaireSnapshot`, `SolitaireGame.snapshot()`, `SolitaireGame.restore(snapshot)`, and `GameHistory.execute(game, action, changed)`, `undo(game)`, `clear()`, `canUndo`.
- Consumes: all mutable `SolitaireGame` piles and existing scene action callbacks.

- [ ] **Step 1: Write failing snapshot and history tests**

Test that `snapshot()` is a deep copy; `restore()` restores tableau, stock, waste, foundations, and free cell; a successful draw/move records one entry; a failed move and empty draw record none; repeated undo is LIFO; `clear()` disables undo.

Add an automatic-chain fixture: record the snapshot, perform a player move, call `autoMoveToFoundation()` until null, then undo and assert both the player move and every automatic foundation card are restored together.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because snapshot/history APIs do not exist.

- [ ] **Step 3: Implement deep snapshots in SolitaireGame**

Define:

```ts
export interface SolitaireSnapshot {
  readonly tableau: readonly (readonly Card[])[];
  readonly stock: readonly Card[];
  readonly waste: readonly Card[];
  readonly foundations: Readonly<Record<Suit, readonly Card[]>>;
  readonly freeCell: Card | null;
}
```

`snapshot()` copies every array. `restore()` replaces contents with copied values while preserving the `SolitaireGame` object identity.

- [ ] **Step 4: Implement transactional GameHistory**

Use a private `SolitaireSnapshot[]`. `execute<T>(game, action, changed)` captures before, runs the action, pushes before only if `changed(result)` is true, and returns the result. `undo(game)` pops and restores; `clear()` empties the stack.

- [ ] **Step 5: Route every player mutation through history**

In `GameScene`, wrap draw (`cards.length > 0`), drag move (`result === true`), and manual foundation (`result === true`). Leave automatic foundation steps unwrapped so they remain part of the preceding entry. Clear history whenever `startDeal` creates a new/restarted deal.

Add `undo: () => boolean` to board actions. `BoardView.requestUndo()` ignores input while locked; after a successful undo, lock input, call `sync('undo')`, and unlock after the undo motion duration without scheduling automatic foundation moves.

- [ ] **Step 6: Add undo control and shortcut**

Add `undo` to `CardMotionKind` with the player-settle duration. Add `ОТМЕНА  Z` to board controls. Register `keydown-Z` in `GameScene` and remove it on shutdown.

- [ ] **Step 7: Run history, full tests, and build**

Expected: all pass; TypeScript build succeeds.

- [ ] **Step 8: Commit undo**

```powershell
git add src/game/model/types.ts src/game/model/SolitaireGame.ts src/game/model/GameHistory.ts src/game/scenes/GameScene.ts src/game/view/BoardView.ts tests/game-history.test.ts tests/game.test.ts
git commit -m "feat: add complete-action undo"
```

### Task 5: Persistent main menu and immediate New Game

**Files:**
- Modify: `src/game/model/GameFlow.ts`
- Replace: `src/game/view/ModeMenuView.ts` with `src/game/view/MainMenuView.ts`
- Modify: `src/game/view/BoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `tests/game-controls.test.ts`

**Interfaces:**
- Produces: `GameFlow.selectMenuMode(mode)`, `playSelectedMode()`, `startNewInCurrentMode()`, `openMainMenu()`, `cancelMenu()`, `selectedMode`; `MainMenuView.show({ canCancel, selectedMode })`.
- Consumes: `GameSession.startNew(mode)`, active `Deal.mode`, and four distinct board actions.

- [ ] **Step 1: Rewrite flow tests first**

Assert:

- launch has no selected mode and Play is unavailable;
- selecting a mode does not create a deal until `playSelectedMode()`;
- Play starts the selected mode and remembers it;
- New Game immediately changes seed while keeping mode and never opens menu;
- opening menu from a game preselects the active mode and preserves the board;
- cancelling restores play without mutation;
- selecting another mode has no effect until Play;
- restart preserves seed/mode.

- [ ] **Step 2: Run flow tests and verify RED**

Expected: old `GameFlow.selectMode()` starts immediately and `openNewGameMenu()` has the wrong semantics.

- [ ] **Step 3: Implement the new pure state transitions**

Keep `menu-required | menu-paused | playing`. Add pending `selectedMode`. `selectMenuMode` updates only pending state. `playSelectedMode` throws when null, starts a new session deal, and enters playing. `startNewInCurrentMode` starts a different seed using `currentDeal.mode` and stays playing. `openMainMenu` enters menu-paused and copies current mode into pending selection.

- [ ] **Step 4: Build MainMenuView**

Rename the modal class/file. Keep the two descriptions but make the mode rows selection controls with a visible selected stroke/fill. Add an `ИГРАТЬ` button that is disabled until a mode is selected. `show` receives current selection and cancel availability; selection updates the view without closing it.

- [ ] **Step 5: Rewire board buttons and scene**

Render four non-overlapping controls: `В МЕНЮ`, `НОВАЯ ИГРА  N`, `ОТМЕНА  Z`, and `РЕСТАРТ  R`. New Game calls `flow.startNewInCurrentMode()` directly. Main Menu shows the modal. Play is the only menu action that destroys/replaces the board. While menu state is not playing, ignore N/Z/R. Escape only cancels `menu-paused`.

- [ ] **Step 6: Run flow, full tests, and build**

Expected: all pass.

- [ ] **Step 7: Commit main-menu flow**

```powershell
git add src/game/model/GameFlow.ts src/game/view/ModeMenuView.ts src/game/view/MainMenuView.ts src/game/view/BoardView.ts src/game/scenes/GameScene.ts tests/game-controls.test.ts
git commit -m "feat: add persistent main menu flow"
```

### Task 6: Documentation and browser verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: current controls, undo semantics, artwork, and menu behavior documentation.

- [ ] **Step 1: Update README**

Document `В МЕНЮ`, immediate `N`, complete-action `Z`, `R`, Horizontal2 artwork, and mode selection through the main menu.

- [ ] **Step 2: Run fresh automated verification**

Run all Node tests, `pnpm build`, `git diff --check`, and compile/run the existing native solver against seed 1 to ensure gameplay-only changes did not alter solver/deal behavior.

- [ ] **Step 3: Verify in the browser**

At 1152×768 verify: Horizontal2 rank/suit visibility; tableau starts 24 pixels higher; no empty waste rectangle; shallow curved initial deal/draw/foundation/return; edge-only drop returns; centered drop succeeds; undo restores a draw and an action with auto-foundation; `N` immediately creates a different same-mode deal; `В МЕНЮ` preserves the current board until Play; changed mode starts only on Play; Escape cancels; buttons do not overlap; no console errors.

- [ ] **Step 4: Inspect final repository state**

Run `git status --short` and confirm only intended source, asset, test, tool, and documentation changes remain.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md
git commit -m "docs: explain undo and main menu controls"
```
