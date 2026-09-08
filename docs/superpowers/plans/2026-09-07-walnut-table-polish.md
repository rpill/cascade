# Walnut Table Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the current `walnut_study` gameplay screen in-place: improve the wood, unify placeholders, make the stock/free-cell affordance readable, restyle gameplay controls, and show the active Standard/Classic/Daily mode without changing gameplay geometry.

**Architecture:** Preserve the existing `ViewportLayout` and gameplay model entirely. `BoardView` continues to own Phaser board cosmetics; `GameControlsView` continues to own native-DOM gameplay controls and already receives `GameMode`; the existing theme/runtime boundary remains the only source of theme cosmetics. Visual QA is performed against the real runtime with an identical deal before/after.

**Tech Stack:** TypeScript, Phaser 3.90, native DOM/CSS, Vite, Node built-in test runner, existing theme registry/runtime, JPEG/PNG/SVG assets as appropriate.

**Spec:** `docs/superpowers/specs/2026-09-07-walnut-table-polish-design.md`

## Global Constraints

- The current runtime gameplay geometry is locked.
- Do not change card sizes, positions, gaps, `ViewportLayout`, hit areas, drag/drop behavior, rules, scoring, persistence, or card-face art.
- Do not use a generated full-screen screenshot as a runtime asset or geometry reference.
- Keep `walnut_study` as default/fallback.
- Use existing theme/runtime and shared UI boundaries; no scattered theme-ID branches.
- Visual acceptance must use real runtime screenshots at desktop and compact landscape.
- Use RED → GREEN → REFACTOR for behavioral/structural code changes.
- Do not hash-lock temporary artwork or exact decorative pixels in tests.

---

## File map

Expected files to inspect/modify:

- `public/assets/theme/fine-grained-wood.jpg` — Walnut board surface.
- `src/game/view/BoardView.ts` — board surface tint, empty tableau/foundation/stock-free-cell placeholder rendering.
- `src/game/view/GameControlsView.ts` — gameplay controls and active-mode label.
- `src/styles.css` — gameplay control skin and mode-label presentation.
- `src/theme/ThemeDefinition.ts` — extend cosmetic tokens only if the existing contract cannot express the accepted Walnut treatment cleanly.
- `src/theme/ThemeRegistry.ts` — Walnut cosmetic values only if token tuning is needed.
- Existing board/theme/HUD tests — extend structurally; do not encode exact art pixels.
- `CURRENT_STATE.md` — update only after user visual acceptance.

Files explicitly out of scope:

- gameplay model/rules;
- deal/RNG code;
- `ViewportLayout` geometry;
- card-face assets;
- drag/drop/input legality code;
- Yandex persistence/platform logic.

---

### Task 1: Lock the real-runtime visual baseline

**Files:**
- No production changes.
- Use existing runtime and screenshot workflow.

**Interfaces:**
- Consumes: current `walnut_study` runtime.
- Produces: before screenshots and a fixed visual comparison baseline.

- [ ] **Step 1: Capture the current real board at desktop**

Run the current project with `walnut_study` and capture a representative active deal at the same viewport used for the user's reference screenshot.

Record:
- card positions;
- card sizes;
- foundation positions;
- stock/free-cell position;
- top-right controls;
- empty tableau state if available.

- [ ] **Step 2: Capture a board state with an empty tableau column**

The screenshot must visibly show the card-sized empty tableau destination.

- [ ] **Step 3: Capture stock/free-cell states**

Capture the state where the stock/free-cell placeholder needs to communicate that a card can be placed there.

- [ ] **Step 4: Capture compact landscape**

Use the current minimum supported compact-landscape viewport.

- [ ] **Step 5: Do not commit**

This task is a visual baseline only.

---

### Task 2: Add the gameplay mode label without changing geometry

**Files:**
- Modify: `src/game/view/GameControlsView.ts`
- Modify: `src/styles.css`
- Test: existing `GameControlsView`/DOM tests or a focused new test if needed.

**Interfaces:**
- Consumes: existing `show(mode: GameMode)` call.
- Produces: a compact gameplay mode label with text `STANDARD`, `CLASSIC`, or `DAILY`.

- [ ] **Step 1: Write a failing test**

Assert that `GameControlsView` owns a mode-label element and that calling `show(mode)` maps:
- `standard` → `STANDARD`
- `classic` → `CLASSIC`
- `daily` → `DAILY`

Also retain the existing Daily behavior that hides New Game.

- [ ] **Step 2: Run the focused test and verify RED**

Run the relevant `GameControlsView` test file.

Expected: FAIL because the mode label does not exist yet.

- [ ] **Step 3: Implement the minimal DOM label**

Create the label inside the gameplay HUD, reuse the already supplied `GameMode`, and update text in `show(mode)`.

Do not introduce a second source of mode state.

- [ ] **Step 4: Style without reserving board geometry**

Use absolute/flex placement inside the existing HUD bounds or another existing screen-space HUD region.

Requirements:
- compact;
- no card movement;
- no `ViewportLayout` changes;
- same Walnut brass/ivory language as controls;
- readable at compact landscape.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/view/GameControlsView.ts src/styles.css tests
git commit -m "feat: show active gameplay mode"
```

---

### Task 3: Simplify and restyle gameplay controls

**Files:**
- Modify: `src/game/view/GameControlsView.ts` and/or existing shared UI icon file used by the current tree.
- Modify: `src/styles.css`
- Test: gameplay HUD/icon tests.

**Interfaces:**
- Consumes: existing four actions and existing HUD geometry.
- Produces: same actions/order/hit areas with improved Walnut visual skin and readable New Game icon.

- [ ] **Step 1: Write a failing structural icon test**

Protect only semantic structure:
- New Game glyph contains a clear card shape and plus sign, or equivalent simple two-part construction.
- Undo/Restart/Home remain their current semantic actions.
- Control order and button count do not change.

Do not test exact SVG path strings unless necessary.

- [ ] **Step 2: Run focused test and verify RED**

Expected: FAIL for the old noisy New Game glyph.

- [ ] **Step 3: Replace only the New Game glyph**

Use a simple card-outline + plus symbol.

Do not redesign action order or change labels/tooltips.

- [ ] **Step 4: Restyle buttons in CSS**

Target:
- dark/medium Walnut-compatible base;
- muted brass border;
- warm ivory/brass icon;
- restrained shadow;
- clear hover/focus;
- no glossy plastic effect.

Preserve exact current hit dimensions and HUD placement.

- [ ] **Step 5: Run focused/full HUD tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/view/GameControlsView.ts src/styles.css tests
git commit -m "style: polish walnut gameplay controls"
```

---

### Task 4: Replace the placeholder visual language in BoardView

**Files:**
- Modify: `src/game/view/BoardView.ts`
- Modify if needed: `src/theme/ThemeDefinition.ts`
- Modify if needed: `src/theme/ThemeRegistry.ts`
- Test: board/theme visual-contract tests.

**Interfaces:**
- Consumes: current `layout.cardWidth`, `layout.cardHeight`, theme colors/tokens.
- Produces: one shared runtime frame language for foundations, empty tableau, and stock/free-cell.

- [ ] **Step 1: Write failing structural tests**

Protect these requirements:
- empty tableau uses a visible card-sized runtime placeholder;
- foundation slots share one frame routine/treatment rather than bespoke geometry per suit;
- stock/free-cell placement state uses a card-placement glyph, not only a lone downward arrow;
- no placeholder changes card coordinates or input geometry.

- [ ] **Step 2: Run board-focused tests and verify RED**

Expected: FAIL for at least the stock/free-cell affordance and/or current frame implementation.

- [ ] **Step 3: Extract/reuse one shared placeholder frame treatment**

In `BoardView`, use one helper or one consistent drawing path for card-sized frames.

Visual direction:
- thin muted brass;
- continuous border;
- clean corners;
- no protruding corner sticks;
- low opacity behind cards.

Do not move any slot.

- [ ] **Step 4: Apply foundation symbols**

Keep centered suit symbols.
Use restrained muted red for Hearts/Diamonds if required.
No extra decoration.

- [ ] **Step 5: Apply empty-tableau state**

Use the same frame with **no center icon**.

Verify it appears whenever a tableau column becomes empty and remains the existing legal drop target.

- [ ] **Step 6: Replace the stock/free-cell arrow**

Use a compact card-placement glyph:
- small card outline;
- clear downward arrow associated with the card;
- centered inside the same shared frame;
- legible at current gameplay size.

Do not change stock/free-cell rules or hit area.

- [ ] **Step 7: Run board-focused and full tests**

```bash
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/view/BoardView.ts src/theme/ThemeDefinition.ts src/theme/ThemeRegistry.ts tests
git commit -m "style: unify walnut board placeholders"
```

Only add theme files if they actually changed.

---

### Task 5: Refine the Walnut board asset

**Files:**
- Modify: `public/assets/theme/fine-grained-wood.jpg`
- Test: existing asset/theme tests.

**Interfaces:**
- Consumes: accepted dark-wood direction.
- Produces: improved real Walnut board texture without baked gameplay geometry.

- [ ] **Step 1: Create/refine the wood texture only**

Requirements:
- dark premium walnut/mahogany;
- natural grain;
- restrained local contrast;
- no green felt;
- no outer border;
- no card slots baked into the bitmap;
- no suit ornaments;
- no decorative tableau line;
- no baked vignette tied to one viewport.

- [ ] **Step 2: Replace only the runtime board asset**

Keep the same runtime asset path unless the asset contract explicitly requires a new versioned path.

- [ ] **Step 3: Run asset/theme tests and build**

```bash
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Capture the exact same real deal as Task 1**

Compare before/after.

Reject if card readability is worse or the wood becomes the visual focus.

- [ ] **Step 5: Commit only after visual review**

```bash
git add public/assets/theme/fine-grained-wood.jpg
git commit -m "art: refine walnut table surface"
```

---

### Task 6: Real-runtime acceptance gate

**Files:**
- Modify only if fixes are required.
- Update `CURRENT_STATE.md` only after approval.

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces: user-approved Walnut gameplay screen.

- [ ] **Step 1: Capture desktop real-runtime screenshot**

Use the same deal and viewport as the baseline.

Check:
- card sizes/positions identical;
- mode label visible;
- controls same location;
- New Game readable;
- placeholders coherent;
- empty tableau clear;
- stock/free-cell affordance clear;
- wood improved.

- [ ] **Step 2: Capture empty-tableau state**

Verify the empty rectangle reads as a valid card destination without an icon.

- [ ] **Step 3: Capture stock/free-cell placement state**

Verify the card-placement glyph is immediately understandable.

- [ ] **Step 4: Capture compact landscape**

No overlaps and no layout workaround.

- [ ] **Step 5: Run final verification**

```bash
pnpm test
pnpm build
```

Expected: both exit 0.

- [ ] **Step 6: User visual gate**

Do not continue to card-back or another theme until the user explicitly approves this Walnut gameplay screen.

- [ ] **Step 7: Update current state after approval**

Record:
- Walnut table polish accepted;
- mode label shipped;
- placeholder language accepted;
- controls accepted;
- no gameplay/layout changes.

- [ ] **Step 8: Commit documentation**

```bash
git add CURRENT_STATE.md docs/superpowers/specs/2026-09-07-walnut-table-polish-design.md docs/superpowers/plans/2026-09-07-walnut-table-polish.md
git commit -m "docs: record walnut table polish"
```

---

## Self-review

### Spec coverage
Every accepted requirement maps to a task:
- mode label → Task 2;
- buttons/New Game icon → Task 3;
- frames/foundation/empty tableau/stock-free-cell → Task 4;
- wood → Task 5;
- locked geometry and real-runtime validation → Tasks 1 and 6.

### Placeholder scan
No implementation step contains TBD/TODO/FIXME placeholders.

### Type consistency
The plan reuses the existing `GameMode`, `GameControlsView.show(mode)`, `ViewportLayout`, `ThemeDefinition`, and `ThemeRegistry` boundaries rather than inventing parallel state.
