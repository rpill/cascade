# Sawayama Game Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the reverse-engineered Zachtronics deal and draw behavior, add an offline-proven winnable seed pool, and let players choose original or guaranteed-winnable games from a modal menu.

**Architecture:** Keep deterministic card generation in the model layer, with a faithful 64-bit RNG and a single mode-aware deal factory. Generate the guaranteed seed pool offline with a native C++ solver that models the same forced draw-three ordering, then ship the compact result as TypeScript data. Keep Phaser UI state in `GameScene`, with a focused modal menu view and explicit restart/new-game actions.

**Tech Stack:** TypeScript 5.9, Node test runner, Phaser 3.90, Vite 7, C++20 offline solver compiled with `D:/msys64/ucrt64/bin/g++.exe`.

**Spec:** `docs/superpowers/specs/2026-09-02-sawayama-game-modes-design.md`

## Global Constraints

- The local reverse-engineered files under `D:/Games/The Zachtronics Solitaire Collection Sources` are the source of truth for original mode.
- Original mode must use the reverse-engineered 64-bit mixer, xorshift128+, modulo-bounded Fisher-Yates, in-place retry shuffle, opening filter, row-wise deal from the end, and forced draw-three swap.
- Guaranteed mode must never fall back to an unproved seed.
- `РЕСТАРТ R` preserves mode and seed; `НОВАЯ ИГРА N` opens the mode menu.
- No new runtime dependencies.

---

### Task 1: Faithful deterministic deal generator

**Files:**
- Create: `src/game/model/OriginalRandom.ts`
- Modify: `src/game/model/types.ts`
- Modify: `src/game/model/deal.ts`
- Test: `tests/deal-original.test.ts`
- Modify: `tests/game.test.ts`

**Interfaces:**
- Produces: `type DealSeed = bigint`, `class OriginalRandom`, `createOriginalDeal(seed: DealSeed): Deal`, and compatibility alias `createSawayamaDeal(seed?): Deal`.
- Consumes: `createDeck()` and existing `Card`/`Deal` types.

- [ ] **Step 1: Write failing RNG and fixed-deal tests**

Add tests which instantiate `new OriginalRandom(1n)` and assert the first five `nextUint64()` values are:

```ts
[
  0x34913d26a7e2cd2fn,
  0x62ac15b85e3ec0can,
  0xd8aeece78eacc5f8n,
  0x5931f371585f5891n,
  0xf41b2a7be06c7e13n,
]
```

Add a fixed-seed deal assertion for seed `1n`. The reference algorithm accepts
its third shuffle attempt. Assert exposed card IDs
`['hearts-9', 'clubs-7', 'spades-2', 'diamonds-13', 'hearts-13', 'spades-4', 'hearts-7']`
and next stock card IDs `['diamonds-3', 'hearts-1', 'clubs-2']`. These literals
come from a standalone transcription of the decompiled C# algorithm, not from
the production helper. Retain tests for 52 unique cards, column sizes, and the
opening predicate.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
& 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd' test -- tests/deal-original.test.ts
```

Expected: FAIL because `OriginalRandom.ts`, `DealSeed`, and `createOriginalDeal` do not exist.

- [ ] **Step 3: Implement the original RNG**

Implement unsigned overflow with `BigInt.asUintN(64, value)`, the two mixer constants `18397679294719823053n` and `14181476777654086739n`, and xorshift128+ exactly as in the decompilation. Reject seed `0n`. `nextInt(maxExclusive)` returns `Number(nextUint64() % BigInt(maxExclusive))`.

- [ ] **Step 4: Implement original shuffle, retry, and deal direction**

In `deal.ts`, construct the suit/rank ordered list, mutate it with Fisher-Yates, inspect shuffled indices `[51, 44, 38, 33, 29, 26, 24]`, and retry on an Ace or any adjacent-rank opposite-colour pair. Keep the same list and RNG between retries. Pop/deal from the end row-wise; keep remaining stock with its accessible card at the final array element.

- [ ] **Step 5: Run focused and full tests and verify GREEN**

Run `pnpm test -- tests/deal-original.test.ts`, then `pnpm test`. Expected: all tests pass.

- [ ] **Step 6: Commit the faithful generator**

```powershell
git add src/game/model/OriginalRandom.ts src/game/model/types.ts src/game/model/deal.ts tests/deal-original.test.ts tests/game.test.ts
git commit -m "feat: reproduce original Sawayama deals"
```

### Task 2: Exact draw-three exposure rule

**Files:**
- Modify: `src/game/model/SolitaireGame.ts`
- Test: `tests/game.test.ts`

**Interfaces:**
- Produces: `SolitaireGame.draw()` with the original forced first/third swap.
- Consumes: existing foundation and tableau stacking rules.

- [ ] **Step 1: Write three failing draw-order tests**

Use hand-built deals with non-empty tableau columns. Cover:

1. First drawn card is playable but third is not: after `draw()`, the first drawn card must be `waste.at(-1)`.
2. Third drawn card is playable: it remains `waste.at(-1)`.
3. Third drawn card can only move to an empty tableau column: it still counts as unplayable for this heuristic, so the first card becomes exposed.

Name the first test `draw exposes the first card when the normal third card has no original destination`; this catches restoring the current incorrect `drawn.some(...)` branch.

- [ ] **Step 2: Run the focused test and verify RED**

Run `pnpm test -- tests/game.test.ts`. Expected: the first and empty-column fixtures expose the third card instead of the first.

- [ ] **Step 3: Implement the minimal exact predicate**

Replace `canPlayCardAnywhere` with a private predicate that tests one card only against foundations and non-empty tableau tops. In `draw()`, inspect `drawn.at(-1)` and reverse the batch only when that one card has no valid destination.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run `pnpm test -- tests/game.test.ts`, then `pnpm test`. Expected: all tests pass.

- [ ] **Step 5: Commit the draw rule**

```powershell
git add src/game/model/SolitaireGame.ts tests/game.test.ts
git commit -m "fix: match original three-card draw order"
```

### Task 3: Offline solver and generated winnable pool

**Files:**
- Create: `tools/sawayama_solver.cpp`
- Create: `src/game/model/winnableSeeds.ts`
- Create: `tests/winnable-pool.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `WINNABLE_SEEDS: readonly bigint[]`, generator command `pnpm generate:winnable-pool`, and native `--seed` verification.
- Consumes: the exact deal and draw rules established in Tasks 1 and 2.

- [ ] **Step 1: Write a failing pool contract test**

Assert that `WINNABLE_SEEDS` is non-empty, contains only unique non-zero `bigint` values, and is frozen/read-only from the consumer perspective. The production change that breaks this is shipping an empty or malformed generated artifact.

- [ ] **Step 2: Run the pool test and verify RED**

Run `pnpm test -- tests/winnable-pool.test.ts`. Expected: FAIL because `winnableSeeds.ts` does not exist.

- [ ] **Step 3: Port the exhaustive solver as an offline C++20 tool**

Implement fixed-capacity piles, canonicalized/sorted tableau columns, a transposition table, iterative DFS, safe automatic foundations, optional unsafe foundation moves, tableau/waste/free-cell moves, and deterministic draw. The draw child must pop three, inspect the normal exposed third card against foundations and non-empty columns, reverse when unavailable, then append to waste. The deal routine must use the exact Task 1 RNG, retry indices, and deal direction.

Support:

```text
--seed N --budget N
--genpool --start N --count N --budget N --out PATH
```

Exit non-zero on invalid arguments or output failure. Only `SOLVED` seeds are written as TypeScript bigint literals; `UNSOLVABLE` and `UNDETERMINED` are excluded.

- [ ] **Step 4: Compile and sanity-check the solver**

Run:

```powershell
& 'D:/msys64/ucrt64/bin/g++.exe' -std=c++20 -O3 -pthread tools/sawayama_solver.cpp -o tools/sawayama_solver.exe
./tools/sawayama_solver.exe --seed 1 --budget 2000000
```

Expected: a valid `SOLVED`, `UNSOLVABLE`, or `UNDETERMINED` result with node count and no crash.

- [ ] **Step 5: Generate a practical proven pool**

Scan seeds `[1, 4097)` with a two-million-node budget and write the first 512
solved seeds to `src/game/model/winnableSeeds.ts`. If fewer than 512 seeds are
proved within that range, extend the end by blocks of 4096; do not lower the
proof criterion. Record scan start/count/budget in generated comments.

- [ ] **Step 6: Add the reproducible package command**

Add `generate:winnable-pool` which compiles the solver and invokes
`--genpool --start 1 --count 4096 --limit 512 --budget 2000000 --out src/game/model/winnableSeeds.ts`.
Do not include the `.exe` in source control.

- [ ] **Step 7: Verify the generated pool and tests**

Run the solver against every shipped seed at the recorded budget, then run `pnpm test -- tests/winnable-pool.test.ts` and `pnpm test`. Expected: every seed reports `SOLVED`; all tests pass.

- [ ] **Step 8: Commit solver and pool**

```powershell
git add tools/sawayama_solver.cpp src/game/model/winnableSeeds.ts tests/winnable-pool.test.ts package.json
git commit -m "feat: add solver-proven Sawayama deals"
```

### Task 4: Mode-aware deal selection and restart semantics

**Files:**
- Create: `src/game/model/GameSession.ts`
- Modify: `src/game/model/types.ts`
- Modify: `src/game/model/deal.ts`
- Test: `tests/game-session.test.ts`

**Interfaces:**
- Produces: `type GameMode = 'original' | 'winnable'`; `class GameSession` with `startNew(mode)`, `restart()`, `currentMode`, `currentSeed`, and `currentDeal`.
- Consumes: `createOriginalDeal(seed)` and `WINNABLE_SEEDS`.

- [ ] **Step 1: Write failing session tests**

Inject a deterministic entropy sequence and a literal pool such as `[11n, 22n]`. Assert:

- `startNew('original')` uses fresh non-zero entropy and avoids the current seed;
- `startNew('winnable')` selects only a supplied pool member and avoids the current seed when possible;
- `restart()` returns a deal with the same mode, seed, tableau card IDs, and stock card IDs;
- `restart()` before a first game throws a clear development error.

- [ ] **Step 2: Run session tests and verify RED**

Run `pnpm test -- tests/game-session.test.ts`. Expected: FAIL because `GameSession` and `GameMode` do not exist.

- [ ] **Step 3: Implement minimal session state**

Keep seed selection pure through injected `nextSeed` and `winnableSeeds` constructor options. Default entropy uses two `crypto.getRandomValues` 32-bit words, combines them into 64 bits, and falls back to mixed time/random data. Normalize zero to `1n`. Store the produced deal so restart can reproduce it from the stored seed and mode.

- [ ] **Step 4: Run session and full tests and verify GREEN**

Run `pnpm test -- tests/game-session.test.ts`, then `pnpm test`. Expected: all tests pass.

- [ ] **Step 5: Commit mode-aware session state**

```powershell
git add src/game/model/GameSession.ts src/game/model/types.ts src/game/model/deal.ts tests/game-session.test.ts
git commit -m "feat: add original and winnable game sessions"
```

### Task 5: Mode menu and separate New Game/Restart controls

**Files:**
- Create: `src/game/model/GameFlow.ts`
- Create: `src/game/view/ModeMenuView.ts`
- Modify: `src/game/view/BoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/game-controls.test.ts`

**Interfaces:**
- Produces: `GameFlow` with launch/menu/playing state transitions;
  `ModeMenuView` with `show(canCancel)`, `hide()`, and `destroy()`; board actions
  `newGame()` and `restart()`.
- Consumes: `GameSession.startNew(mode)` and `GameSession.restart()`.

- [ ] **Step 1: Write failing pure control-state tests**

Create a small `src/game/model/GameFlow.ts` state machine so tests can exercise
launch, select mode, open menu, cancel, restart, and select a new mode without
mocking Phaser. Assert launch requires a selection, New Game preserves the
visible deal until selection, Escape can cancel only when a deal exists, and
Restart preserves seed/mode.

- [ ] **Step 2: Run control tests and verify RED**

Run `pnpm test -- tests/game-controls.test.ts`. Expected: FAIL because the flow/controller interfaces are missing.

- [ ] **Step 3: Implement the modal menu**

Create a Phaser overlay above all cards with a dim blocker, title `НОВАЯ ИГРА`, explanatory copy, buttons `ОРИГИНАЛЬНЫЙ` and `ГАРАНТИРОВАННО РЕШАЕМЫЙ`, and an Escape/cancel path only for an existing game. Every created object and event belongs to the view and is destroyed cleanly.

- [ ] **Step 4: Add both board buttons**

Replace the one-button helper with a controls helper that renders `НОВАЯ ИГРА  N` and `РЕСТАРТ  R` without overlap. Wire them to distinct actions. Buttons remain interactive during deal animation.

- [ ] **Step 5: Integrate scene lifecycle and keyboard shortcuts**

On launch show the menu before creating a deal. `N` opens it, `R` restarts only when a deal exists, selecting a mode destroys the prior board only after selection and starts a new animated deal, and Escape closes only a cancellable menu. Prevent duplicate keyboard listeners on scene recreation.

- [ ] **Step 6: Run tests and production build**

Run `pnpm test`, then `pnpm build`. Expected: all tests pass and Vite builds without TypeScript errors.

- [ ] **Step 7: Commit the UI flow**

```powershell
git add src/game/view/ModeMenuView.ts src/game/view/BoardView.ts src/game/scenes/GameScene.ts tests/game-controls.test.ts
git commit -m "feat: add game mode menu and new game control"
```

### Task 6: Documentation and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-02-sawayama-game-modes-design.md` only if implementation discovered a factual correction.

**Interfaces:**
- Consumes: completed behavior from Tasks 1-5.
- Produces: user-facing run instructions and verification evidence.

- [ ] **Step 1: Update README behavior documentation**

Document both modes, menu controls, `N`, `R`, the faithful draw-three adjustment, and how to regenerate the guaranteed seed pool. Remove the current inaccurate statement that no full-solver mode exists.

- [ ] **Step 2: Run fresh automated verification**

Run `pnpm test` and `pnpm build`. Expected: zero test failures and successful production output.

- [ ] **Step 3: Run browser verification**

Start `pnpm dev`, open the local URL, and verify: initial modal; both descriptions; original selection; New Game button and `N`; cancellable Escape; guaranteed selection; Restart button and `R`; identical card IDs/positions after restart; a different opening after New Game; and no console errors.

- [ ] **Step 4: Inspect repository changes**

Run `git status --short` and `git diff --check`. Expected: only intended files and no whitespace errors.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md docs/superpowers/specs/2026-09-02-sawayama-game-modes-design.md
git commit -m "docs: explain Sawayama game modes"
```
