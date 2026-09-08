# Cascade Solitaire — Responsive Board, Mobile Landscape & HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cascade Solitaire reliable under repeated Yandex reloads and fully usable on desktop plus landscape phones/tablets with a shared board/HUD geometry contract, compact icon controls, and no-scroll compact meta UI.

**Architecture:** First isolate the observed Yandex F5/WebGL startup race without changing renderer policy. Then introduce a new pure `ViewportLayout` contract alongside the current layout, migrate Phaser board geometry onto it, extract gameplay controls into their own DOM view, wire safe-area insets through a browser adapter, and finally reorganize menu/meta/result DOM for short landscape viewports. Each task is independently testable and committed before the next task; Task 0 has a mandatory real-Yandex reload gate before responsive work continues.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 7, native DOM/CSS UI, Node built-in test runner, Yandex Games SDK integration.

**Spec:** `docs/superpowers/specs/2026-09-05-responsive-board-ui-design.md`

## Global Constraints

- Desktop remains supported; mobile/tablet gameplay is supported in **landscape only**; portrait gameplay is intentionally unsupported.
- The Yandex Games draft must declare `Landscape` orientation for mobile so the platform owns the rotate-device experience.
- Do not change deal generation, draw-three behavior, free-cell rules, tableau/foundation legality, auto-foundation safety, undo semantics, attempt timing, Daily identity/progress, persistence formats, leaderboard rules, or Yandex lifecycle policy.
- Main gameplay, main menu, statistics, leaderboard, Daily completion, and ordinary completion must fit supported viewports without browser-page scrolling.
- Preserve `Phaser.Scale.RESIZE`, camera zoom `1`, camera scroll `0`, normal antialiasing, `pixelArt: false`, and `roundPixels: false` unless Task 0 proves a separate renderer/scale workaround is required.
- Task 0 must not switch from `Phaser.AUTO`/WebGL to Canvas as part of the first hypothesis.
- Preserve card aspect ratio `151 / 108` and quality-safe maximum displayed card width `180` CSS/logical px.
- Standard profile keeps the existing desktop card-width floor of `84`; compact-landscape may reduce the floor to `64` when geometry requires it.
- Primary gameplay HUD controls must expose at least `44×44 CSS px` interactive targets.
- Gameplay control icons must be project-owned inline SVG, not emoji or platform-dependent Unicode glyphs.
- DOM controls remain screen-space native DOM; cards/board remain Phaser objects.
- Safe-area insets are explicit layout inputs; pure layout code never reads browser CSS environment variables directly.
- Tests protect geometry/accessibility invariants, not artwork bytes, exact colours, or permanent pixel coordinates.
- Delivery follows the existing handoff workflow: each implementation task produces a small ZIP containing only files changed by that task; after replacing them locally, run `pnpm test` and `pnpm build`, then commit before starting the next task.

---

## File Structure

New files introduced by this phase:

- `src/bootstrap/GameBootstrap.ts` — pure/testable delayed game-start helper that waits for a positive rendered host size and forwards that measured size exactly once.
- `src/game/view/ViewportLayout.ts` — single pure responsive geometry contract for HUD, board, cards, waste lane, foundations, and tableau.
- `src/game/view/GameControlsView.ts` — native DOM HUD with icon-only gameplay actions, accessible names, tooltips, and Daily-aware New Deal visibility.
- `src/game/view/SafeArea.ts` — browser adapter that reads `env(safe-area-inset-*)` through a hidden probe and returns numeric `SafeAreaInsets`.
- `tests/game-bootstrap.test.ts` — startup/F5 regression tests independent of Phaser.
- `tests/viewport-layout.test.ts` — full responsive viewport matrix and geometry invariants.
- `tests/game-controls-view.test.ts` — source/DOM contract tests for the extracted HUD.
- `tests/safe-area.test.ts` — parsing/adapter tests for numeric safe-area values.
- `docs/YANDEX_RESPONSIVE_ACCEPTANCE.md` — real-browser/Yandex reload, resize, mobile-landscape, orientation, and safe-area release checklist.

Files migrated or updated:

- `src/main.ts` — boot through measured host size rather than constructing Phaser immediately from `window.innerWidth/innerHeight`.
- `src/game/view/layout.ts` — derive board slots, waste fan, and tableau vertical compression from `ViewportLayout` bounds.
- `src/game/view/BoardView.ts` — remove DOM controls and vertical foundation rail; render horizontal foundations and bounded waste lane from the shared layout.
- `src/game/scenes/GameScene.ts` — own current `ViewportLayout`, safe-area reader, and `GameControlsView`; relayout all three on Phaser resize.
- `src/game/view/MainMenuView.ts` — add semantic mode/side group wrappers for compact two-column landscape composition.
- `src/game/view/StatisticsView.ts` — add a statistics-mode wrapper that can become a two-column compact grid.
- `src/game/view/LeaderboardView.ts` — keep top-10 DOM order but expose structure that CSS can flow into two rank columns on short landscape.
- `src/game/view/DailyCompleteView.ts` — group summary values so compact landscape can place them horizontally.
- `src/game/view/GameCompleteView.ts` — group summary values so compact landscape can place them horizontally.
- `src/styles.css` — replace fixed-width gameplay controls, add HUD/icon/tooltip/safe-area rules, and redesign short-landscape menu/meta/result layouts without scroll.
- `index.html` — add `viewport-fit=cover` after safe-area integration.
- `PROJECT.md`, `CURRENT_STATE.md`, `TECH.md` — replace the old vertical-foundation/fixed-controls description with the final responsive contract.
- Existing wiring/layout tests are updated to assert the new architecture instead of the intentionally removed one.

`src/game/view/LayoutMetrics.ts` is deleted only after Task 2 has migrated all runtime consumers to `ViewportLayout.ts`, keeping Task 1 independently buildable.

---

### Task 0: Isolate Yandex F5 / Startup Host-Size Stability

**Files:**
- Create: `src/bootstrap/GameBootstrap.ts`
- Create: `tests/game-bootstrap.test.ts`
- Modify: `src/main.ts`
- Modify: `tests/render-config.test.ts`
- Modify: `tests/responsive-layout.test.ts`

**Interfaces:**
- Produces:
  - `interface HostSize { readonly width: number; readonly height: number }`
  - `type ReadHostSize = () => HostSize`
  - `type WaitForNextMeasurement = () => Promise<void>`
  - `waitForUsableHostSize(readSize, waitForNextMeasurement?): Promise<HostSize>`
  - `startWhenHostReady<T>(readSize, createGame, waitForNextMeasurement?): Promise<T>`
- Runtime consumer: `src/main.ts` reads `#game.getBoundingClientRect()` and passes the first positive measured size into the Phaser config.

- [ ] **Step 1: Write the failing startup regression tests**

Create `tests/game-bootstrap.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  startWhenHostReady,
  waitForUsableHostSize,
} from '../src/bootstrap/GameBootstrap.ts';

test('zero-sized host waits until both rendered dimensions are positive', async () => {
  const sizes = [
    { width: 0, height: 390 },
    { width: 844, height: 0 },
    { width: 844.8, height: 390.2 },
  ];
  let index = 0;

  const size = await waitForUsableHostSize(
    () => sizes[index],
    async () => { index += 1; },
  );

  assert.deepEqual(size, { width: 844, height: 390 });
  assert.equal(index, 2);
});

test('first usable host size creates the game exactly once and forwards that size', async () => {
  const sizes = [
    { width: 0, height: 0 },
    { width: 915, height: 412 },
    { width: 932, height: 430 },
  ];
  let index = 0;
  const created: Array<{ width: number; height: number }> = [];

  const result = await startWhenHostReady(
    () => sizes[index],
    (size) => {
      created.push(size);
      return 'game';
    },
    async () => { index += 1; },
  );

  assert.equal(result, 'game');
  assert.deepEqual(created, [{ width: 915, height: 412 }]);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test tests/game-bootstrap.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `src/bootstrap/GameBootstrap.ts` does not exist.

- [ ] **Step 3: Implement the minimal host-size waiting boundary**

Create `src/bootstrap/GameBootstrap.ts`:

```ts
export interface HostSize {
  readonly width: number;
  readonly height: number;
}

export type ReadHostSize = () => HostSize;
export type WaitForNextMeasurement = () => Promise<void>;

function normalizeSize(size: HostSize): HostSize {
  return {
    width: Math.max(0, Math.floor(Number.isFinite(size.width) ? size.width : 0)),
    height: Math.max(0, Math.floor(Number.isFinite(size.height) ? size.height : 0)),
  };
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function waitForUsableHostSize(
  readSize: ReadHostSize,
  waitForNextMeasurement: WaitForNextMeasurement = waitForAnimationFrame,
): Promise<HostSize> {
  for (;;) {
    const size = normalizeSize(readSize());
    if (size.width > 0 && size.height > 0) {
      return size;
    }
    await waitForNextMeasurement();
  }
}

export async function startWhenHostReady<T>(
  readSize: ReadHostSize,
  createGame: (size: HostSize) => T,
  waitForNextMeasurement?: WaitForNextMeasurement,
): Promise<T> {
  const size = await waitForUsableHostSize(readSize, waitForNextMeasurement);
  return createGame(size);
}
```

- [ ] **Step 4: Verify the focused startup tests are GREEN**

Run:

```bash
node --test tests/game-bootstrap.test.ts
```

Expected: `2/2 PASS`, `0 fail`.

- [ ] **Step 5: Move Phaser construction behind the measured-host boundary**

Replace immediate construction in `src/main.ts` with:

```ts
import Phaser from 'phaser';

import './styles.css';

import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';

const host = document.getElementById('game');
if (!(host instanceof HTMLElement)) {
  throw new Error('Cascade Solitaire requires a #game host element.');
}

void startWhenHostReady(
  () => {
    const bounds = host.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  },
  ({ width, height }) => new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width,
    height,
    backgroundColor: '#393937',
    disableContextMenu: true,
    scene: [BootScene, GameScene],
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoRound: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
  }),
);
```

- [ ] **Step 6: Replace the old source assertions that require `window.innerWidth/innerHeight`**

In `tests/responsive-layout.test.ts`, replace the old initial-dimensions test with:

```ts
test('initial Phaser canvas waits for a measured positive game-host size', () => {
  assert.match(mainSource, /startWhenHostReady/);
  assert.match(mainSource, /getBoundingClientRect\(\)/);
  assert.match(mainSource, /width,\s*height/);
  assert.doesNotMatch(mainSource, /width:\s*window\.innerWidth/);
  assert.doesNotMatch(mainSource, /height:\s*window\.innerHeight/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
});
```

In `tests/render-config.test.ts`, add:

```ts
test('startup keeps the existing renderer and resize policy while delaying construction', () => {
  assert.match(mainSource, /type:\s*Phaser\.AUTO/);
  assert.match(mainSource, /startWhenHostReady/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
  assert.doesNotMatch(mainSource, /Phaser\.CANVAS/);
});
```

- [ ] **Step 7: Run automated Task 0 verification**

Run:

```bash
node --test tests/game-bootstrap.test.ts tests/render-config.test.ts tests/responsive-layout.test.ts
pnpm test
pnpm build
```

Expected: all tests PASS and build exits `0`.

- [ ] **Step 8: Commit Task 0 before any responsive code**

```bash
git add src/bootstrap/GameBootstrap.ts src/main.ts tests/game-bootstrap.test.ts tests/render-config.test.ts tests/responsive-layout.test.ts
git commit -m "fix: wait for usable game host before Phaser boot"
```

- [ ] **Step 9: Mandatory real Yandex Draft gate**

Build/upload a fresh Draft and verify with DevTools closed:

```text
1. Ordinary F5 ten times in succession.
2. Ctrl+F5 once.
3. Ordinary F5 at least five more times.
4. Confirm every launch renders a board/menu.
5. Confirm Console never reports "Framebuffer status: Incomplete Attachment".
```

If the exact framebuffer failure still reproduces, **stop this plan before Task 1**. Collect the failing console stack and test the renderer/`Scale.RESIZE` boundary as a separate debugging hypothesis; do not hide the problem inside responsive changes.

---

### Task 1: Add the Pure `ViewportLayout` Contract and Full Viewport Matrix

**Files:**
- Create: `src/game/view/ViewportLayout.ts`
- Create: `tests/viewport-layout.test.ts`
- Keep unchanged for this task: `src/game/view/LayoutMetrics.ts`

**Interfaces:**
- Produces:
  - `type LayoutProfile = 'standard' | 'compact-landscape'`
  - `interface SafeAreaInsets { top; right; bottom; left }`
  - `interface LayoutPoint { x; y }`
  - `interface LayoutBounds { x; y; width; height }`
  - `interface ViewportLayout` with explicit `hudBounds`, `boardBounds`, `stock`, `wasteLaneBounds`, `foundations`, `tableauX`, `tableauY`, card sizes/gaps, and safe-area data.
  - `ZERO_SAFE_AREA`
  - `calculateViewportLayout(viewportWidth, viewportHeight, safeArea?): ViewportLayout`
- Task 2 consumes this module and deletes the old `LayoutMetrics.ts` only after all runtime imports migrate.

- [ ] **Step 1: Write the failing responsive-matrix contract tests**

Create `tests/viewport-layout.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_ASPECT_RATIO,
  MAX_CARD_WIDTH,
  STANDARD_MIN_CARD_WIDTH,
  calculateViewportLayout,
  type LayoutBounds,
} from '../src/game/view/ViewportLayout.ts';

const VIEWPORTS = [
  [844, 390], [915, 412], [932, 430],
  [1024, 576], [960, 540], [960, 640],
  [1366, 768], [1920, 1080], [2560, 1440],
  [2560, 1080], [3440, 1440],
] as const;

function right(bounds: LayoutBounds): number {
  return bounds.x + bounds.width;
}

function bottom(bounds: LayoutBounds): number {
  return bounds.y + bounds.height;
}

function intersects(left: LayoutBounds, rightBounds: LayoutBounds): boolean {
  return left.x < right(rightBounds)
    && right(left) > rightBounds.x
    && left.y < bottom(rightBounds)
    && bottom(left) > rightBounds.y;
}

for (const [width, height] of VIEWPORTS) {
  test(`${width}x${height} keeps HUD and primary board geometry non-overlapping`, () => {
    const layout = calculateViewportLayout(width, height);

    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.ok(layout.hudBounds.y >= layout.safeArea.top);
    assert.ok(layout.hudBounds.x >= layout.safeArea.left);
    assert.ok(right(layout.hudBounds) <= width - layout.safeArea.right + 1e-9);
    assert.ok(layout.boardBounds.y >= bottom(layout.hudBounds));
    assert.ok(bottom(layout.boardBounds) <= height - layout.safeArea.bottom + 1e-9);
    assert.equal(intersects(layout.hudBounds, layout.boardBounds), false);

    assert.equal(layout.foundations.length, 4);
    assert.ok(layout.stock.x >= layout.boardBounds.x);
    assert.ok(layout.stock.y >= layout.boardBounds.y);
    assert.ok(layout.stock.x + layout.cardWidth <= right(layout.boardBounds) + 1e-9);
    assert.ok(layout.foundations.every((point) => point.x >= layout.boardBounds.x));
    assert.ok(layout.foundations.every((point) => point.x + layout.cardWidth <= right(layout.boardBounds) + 1e-9));
    assert.equal(layout.tableauX.length, 7);
    assert.ok(layout.tableauX.every((x) => x >= layout.boardBounds.x));
    assert.ok(layout.tableauX.every((x) => x + layout.cardWidth <= right(layout.boardBounds) + 1e-9));
    assert.ok(layout.tableauY >= layout.wasteLaneBounds.y + layout.cardHeight);
    assert.ok(layout.wasteLaneBounds.x >= layout.stock.x + layout.cardWidth);
    assert.ok(right(layout.wasteLaneBounds) <= layout.foundations[0].x + 1e-9);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - CARD_ASPECT_RATIO) < 1e-9);
    assert.ok(layout.cardWidth <= MAX_CARD_WIDTH);
  });
}

test('phone-sized landscapes select compact profile and may shrink below old desktop floor', () => {
  const phone = calculateViewportLayout(844, 390);
  const desktop = calculateViewportLayout(1366, 768);

  assert.equal(phone.profile, 'compact-landscape');
  assert.ok(phone.cardWidth < STANDARD_MIN_CARD_WIDTH);
  assert.ok(phone.cardWidth >= 64);
  assert.equal(desktop.profile, 'standard');
  assert.ok(desktop.cardWidth >= STANDARD_MIN_CARD_WIDTH);
});

test('synthetic safe-area insets move the usable geometry inward', () => {
  const plain = calculateViewportLayout(932, 430);
  const inset = calculateViewportLayout(932, 430, {
    top: 12,
    right: 28,
    bottom: 10,
    left: 24,
  });

  assert.equal(inset.safeArea.left, 24);
  assert.equal(inset.safeArea.right, 28);
  assert.ok(inset.hudBounds.x > plain.hudBounds.x);
  assert.ok(inset.boardBounds.x > plain.boardBounds.x);
  assert.ok(right(inset.boardBounds) < right(plain.boardBounds));
});

test('wide screens keep tableau gaps bounded instead of stretching edge-to-edge', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1080], [3440, 1440]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.ok(layout.tableauColumnGap <= layout.cardWidth * 0.4 + 1e-9);
  }
});
```

- [ ] **Step 2: Run the viewport-layout tests and verify RED**

```bash
node --test tests/viewport-layout.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `ViewportLayout.ts`.

- [ ] **Step 3: Implement the pure responsive contract without changing runtime consumers yet**

Create `src/game/view/ViewportLayout.ts`:

```ts
export const CARD_ASPECT_RATIO = 151 / 108;
export const COMPACT_MIN_CARD_WIDTH = 64;
export const STANDARD_MIN_CARD_WIDTH = 84;
export const BASE_CARD_WIDTH = 108;
export const MAX_CARD_WIDTH = 180;

const REFERENCE_HEIGHT = 768;
const COMPACT_MAX_HEIGHT = 620;
const STANDARD_HUD_HEIGHT = 56;
const COMPACT_HUD_HEIGHT = 48;

export type LayoutProfile = 'standard' | 'compact-landscape';

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface LayoutPoint {
  readonly x: number;
  readonly y: number;
}

export interface LayoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportLayout {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly profile: LayoutProfile;
  readonly safeArea: SafeAreaInsets;
  readonly hudBounds: LayoutBounds;
  readonly boardBounds: LayoutBounds;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly stock: LayoutPoint;
  readonly wasteLaneBounds: LayoutBounds;
  readonly foundations: readonly LayoutPoint[];
  readonly tableauX: readonly number[];
  readonly tableauY: number;
  readonly tableauColumnGap: number;
  readonly tableauCardGap: number;
  readonly wasteGap: number;
  readonly bottomMargin: number;
}

export const ZERO_SAFE_AREA: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeInset(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateViewportLayout(
  viewportWidth: number,
  viewportHeight: number,
  safeArea: SafeAreaInsets = ZERO_SAFE_AREA,
): ViewportLayout {
  const width = normalizeDimension(viewportWidth);
  const height = normalizeDimension(viewportHeight);
  const insets = {
    top: normalizeInset(safeArea.top),
    right: normalizeInset(safeArea.right),
    bottom: normalizeInset(safeArea.bottom),
    left: normalizeInset(safeArea.left),
  };
  const safeWidth = Math.max(1, width - insets.left - insets.right);
  const safeHeight = Math.max(1, height - insets.top - insets.bottom);
  const profile: LayoutProfile = safeHeight <= COMPACT_MAX_HEIGHT
    ? 'compact-landscape'
    : 'standard';
  const compact = profile === 'compact-landscape';
  const hudHeight = compact ? COMPACT_HUD_HEIGHT : STANDARD_HUD_HEIGHT;
  const edgeMargin = clamp(compact ? 8 : 14, safeWidth * 0.018, compact ? 18 : 32);
  const boardGap = compact ? 4 : 8;
  const boardX = insets.left + edgeMargin;
  const boardY = insets.top + hudHeight + boardGap;
  const boardRight = width - insets.right - edgeMargin;
  const boardBottom = height - insets.bottom - edgeMargin;
  const boardWidth = Math.max(1, boardRight - boardX);
  const boardHeight = Math.max(1, boardBottom - boardY);
  const minCardWidth = compact ? COMPACT_MIN_CARD_WIDTH : STANDARD_MIN_CARD_WIDTH;
  const minColumnGap = compact ? 6 : 18;
  const preferredCardWidth = clamp(
    minCardWidth,
    BASE_CARD_WIDTH * (safeHeight / REFERENCE_HEIGHT),
    MAX_CARD_WIDTH,
  );
  const widthFitCardWidth = (boardWidth - minColumnGap * 6) / 7;
  const cardWidth = clamp(
    minCardWidth,
    Math.min(preferredCardWidth, widthFitCardWidth),
    MAX_CARD_WIDTH,
  );
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;
  const topRowY = boardY;
  const foundationGap = clamp(compact ? 5 : 8, cardWidth * 0.08, compact ? 9 : 14);
  const foundationWidth = cardWidth * 4 + foundationGap * 3;
  const foundationStartX = boardRight - foundationWidth;
  const foundations = Array.from({ length: 4 }, (_, index) => ({
    x: foundationStartX + index * (cardWidth + foundationGap),
    y: topRowY,
  }));
  const zoneGap = clamp(compact ? 8 : 16, cardWidth * 0.15, compact ? 14 : 28);
  const stock = { x: boardX, y: topRowY };
  const wasteX = stock.x + cardWidth + zoneGap;
  const wasteRight = foundationStartX - zoneGap;
  const wasteLaneBounds = {
    x: wasteX,
    y: topRowY,
    width: Math.max(cardWidth, wasteRight - wasteX),
    height: cardHeight,
  };
  const maximumGapFromWidth = Math.max(0, (boardWidth - cardWidth * 7) / 6);
  const preferredColumnGap = clamp(
    compact ? 6 : 18,
    cardWidth * (compact ? 0.16 : 0.3),
    compact ? 18 : 40,
  );
  const tableauColumnGap = Math.min(
    preferredColumnGap,
    maximumGapFromWidth,
    cardWidth * 0.4,
  );
  const tableauWidth = cardWidth * 7 + tableauColumnGap * 6;
  const firstTableauX = boardX + Math.max(0, (boardWidth - tableauWidth) / 2);
  const tableauX = Array.from(
    { length: 7 },
    (_, index) => firstTableauX + index * (cardWidth + tableauColumnGap),
  );
  const rowGap = clamp(compact ? 8 : 24, safeHeight * (compact ? 0.02 : 0.04), compact ? 14 : 52);
  const tableauY = topRowY + cardHeight + rowGap;
  const tableauCardGap = clamp(
    compact ? 8 : 20,
    cardHeight * (compact ? 0.15 : 28 / 151),
    compact ? 18 : 46,
  );
  const wasteGap = clamp(compact ? 12 : 18, cardWidth * 0.24, compact ? 24 : 40);
  const bottomMargin = compact ? 8 : 18;

  return {
    viewportWidth: width,
    viewportHeight: height,
    profile,
    safeArea: insets,
    hudBounds: {
      x: insets.left,
      y: insets.top,
      width: safeWidth,
      height: hudHeight,
    },
    boardBounds: {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
    },
    cardWidth,
    cardHeight,
    stock,
    wasteLaneBounds,
    foundations,
    tableauX,
    tableauY,
    tableauColumnGap,
    tableauCardGap,
    wasteGap,
    bottomMargin,
  };
}
```

- [ ] **Step 4: Run the pure layout tests and tune only constants if an invariant fails**

Run:

```bash
node --test tests/viewport-layout.test.ts
```

Expected: all matrix tests PASS. If a listed viewport fails, change only the layout constants/formulas in `ViewportLayout.ts`; do not weaken the invariant assertions or special-case device names.

- [ ] **Step 5: Run the existing full suite to prove the additive module did not disturb runtime behavior**

```bash
pnpm test
pnpm build
```

Expected: existing suite and build stay GREEN because runtime still uses `LayoutMetrics.ts` in this task.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/game/view/ViewportLayout.ts tests/viewport-layout.test.ts
git commit -m "feat: add responsive viewport layout contract"
```

---

### Task 2: Migrate the Phaser Board to Horizontal Foundations and a Bounded Waste Lane

**Files:**
- Modify: `src/game/view/layout.ts`
- Modify: `src/game/view/BoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Delete: `src/game/view/LayoutMetrics.ts`
- Modify: `tests/board-layout.test.ts`
- Modify: `tests/responsive-layout.test.ts`
- Modify: `tests/foundation-visibility.test.ts`
- Modify: `tests/render-config.test.ts`

**Interfaces:**
- Consumes: `ViewportLayout` and `calculateViewportLayout()` from Task 1.
- Produces runtime geometry where:
  - stock/free-cell uses `layout.stock`;
  - waste card x positions stay inside `layout.wasteLaneBounds`;
  - foundations use `layout.foundations[0..3]` horizontally;
  - tableau vertical compression uses the bottom of `layout.boardBounds` rather than the full viewport;
  - the old `foundationX`, `foundationY`, `utilityDividerX`, `compositionBounds`, and vertical utility rail no longer exist.

- [ ] **Step 1: Write failing derived-layout tests for waste and long tableau piles**

Replace `tests/board-layout.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { getBoardSlots, tableauCardY, wasteCardX } from '../src/game/view/layout.ts';

for (const [width, height] of [[844, 390], [960, 540], [1366, 768], [1920, 1080]] as const) {
  test(`${width}x${height} keeps a 20-card tableau pile inside board bounds`, () => {
    const layout = calculateViewportLayout(width, height);
    const boardBottom = layout.boardBounds.y + layout.boardBounds.height;

    assert.ok(
      tableauCardY(layout, 20, 19) + layout.cardHeight
        <= boardBottom - layout.bottomMargin + 1e-9,
    );
  });

  test(`${width}x${height} keeps every waste position inside the bounded lane`, () => {
    const layout = calculateViewportLayout(width, height);
    const laneRight = layout.wasteLaneBounds.x + layout.wasteLaneBounds.width;

    for (let count = 1; count <= 24; count += 1) {
      for (let index = 0; index < count; index += 1) {
        const x = wasteCardX(layout, count, index);
        assert.ok(x >= layout.wasteLaneBounds.x - 1e-9);
        assert.ok(x + layout.cardWidth <= laneRight + 1e-9);
      }
    }
  });
}

test('board slots expose four horizontal foundations, one stock, and seven tableau slots', () => {
  const layout = calculateViewportLayout(1920, 1080);
  const slots = getBoardSlots(layout);
  const foundations = slots.filter((slot) => slot.kind === 'foundation');

  assert.equal(foundations.length, 4);
  assert.deepEqual(foundations.map(({ x, y }) => ({ x, y })), layout.foundations);
  assert.equal(slots.filter((slot) => slot.kind === 'stock').length, 1);
  assert.equal(slots.filter((slot) => slot.kind === 'tableau').length, 7);
  assert.equal(slots.some((slot) => String(slot.kind) === 'waste'), false);
});
```

- [ ] **Step 2: Run the board-layout tests and verify RED**

```bash
node --test tests/board-layout.test.ts
```

Expected: TypeScript/import failures because `layout.ts` still consumes `LayoutMetrics` and old waste/foundation fields.

- [ ] **Step 3: Migrate the pure derived helpers to `ViewportLayout`**

Replace `src/game/view/layout.ts` with:

```ts
import type { ViewportLayout } from './ViewportLayout.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type BoardSlotKind = 'foundation' | 'stock' | 'tableau';

export interface BoardSlot extends Point {
  readonly kind: BoardSlotKind;
  readonly alpha: number;
}

export function getBoardSlots(layout: ViewportLayout): BoardSlot[] {
  return [
    ...layout.foundations.map((point) => ({
      kind: 'foundation' as const,
      x: point.x,
      y: point.y,
      alpha: 0.32,
    })),
    {
      kind: 'stock' as const,
      x: layout.stock.x,
      y: layout.stock.y,
      alpha: 0.32,
    },
    ...layout.tableauX.map((x) => ({
      kind: 'tableau' as const,
      x,
      y: layout.tableauY,
      alpha: 0.16,
    })),
  ];
}

export function tableauCardY(
  layout: ViewportLayout,
  cardCount: number,
  index: number,
): number {
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;
  const available = boardBottom
    - layout.tableauY
    - layout.cardHeight
    - layout.bottomMargin;
  const gap = cardCount <= 1
    ? layout.tableauCardGap
    : Math.min(
      layout.tableauCardGap,
      Math.max(0, available / (cardCount - 1)),
    );

  return layout.tableauY + index * gap;
}

export function wasteCardX(
  layout: ViewportLayout,
  cardCount: number,
  index: number,
): number {
  const available = Math.max(0, layout.wasteLaneBounds.width - layout.cardWidth);
  const gap = cardCount <= 1
    ? layout.wasteGap
    : Math.min(layout.wasteGap, available / (cardCount - 1));

  return layout.wasteLaneBounds.x + index * gap;
}
```

- [ ] **Step 4: Verify the derived helper tests are GREEN**

```bash
node --test tests/board-layout.test.ts tests/viewport-layout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Migrate `BoardView` to the new layout fields and remove the vertical utility rail**

Apply these structural changes in `src/game/view/BoardView.ts`:

```ts
import type { ViewportLayout } from './ViewportLayout.ts';

private layout: ViewportLayout;

constructor(
  scene: Phaser.Scene,
  game: SolitaireGame,
  actions: BoardActions,
  layout: ViewportLayout,
) { /* existing constructor body */ }

relayout(layout: ViewportLayout): void {
  this.activeFlights.forEach((flight) => flight.stop());
  this.activeFlights.clear();
  this.dragState = null;
  this.layout = layout;

  this.boardSurface.setDisplaySize(layout.viewportWidth, layout.viewportHeight);
  // keep existing slot/card resize work, but position foundations through layout.foundations
}
```

Delete the `utilityDivider` field, rectangle creation, relayout code, and ownership entry entirely.

Foundation symbol positioning becomes:

```ts
this.foundationSymbols.forEach((symbol, index) => {
  const point = layout.foundations[index];
  symbol
    .setPosition(
      point.x + layout.cardWidth / 2,
      point.y + layout.cardHeight / 2,
    )
    .setFontSize(Math.round(layout.cardWidth * 0.4));
});
```

Foundation frame drawing iterates points:

```ts
layout.foundations.forEach(({ x, y }) => {
  const left = x + inset;
  const top = y + inset;
  const right = x + layout.cardWidth - inset;
  const bottom = y + layout.cardHeight - inset;
  // keep the existing frame/tick drawing commands unchanged
});
```

Foundation drop candidates become:

```ts
...SUITS.map((suit, index) => {
  const point = this.layout.foundations[index];
  return {
    target: { zone: 'foundation', suit } as const,
    bounds: new Phaser.Geom.Rectangle(
      point.x,
      point.y,
      this.layout.cardWidth,
      this.layout.cardHeight,
    ),
    center: {
      x: point.x + this.layout.cardWidth / 2,
      y: point.y + this.layout.cardHeight / 2,
    },
  };
}),
```

Waste/foundation placements become:

```ts
this.game.waste.forEach((card, index) => {
  const isTop = index === this.game.waste.length - 1;
  placements.set(card.id, {
    x: wasteCardX(this.layout, this.game.waste.length, index),
    y: this.layout.wasteLaneBounds.y,
    depth: 500 + index,
    source: isTop ? { zone: 'waste' } : undefined,
  });
});

SUITS.forEach((suit, index) => {
  const point = this.layout.foundations[index];
  this.game.foundations[suit].forEach((card, cardIndex) => {
    placements.set(card.id, {
      x: point.x,
      y: point.y,
      depth: 400 + index * 20 + cardIndex,
    });
  });
});
```

- [ ] **Step 6: Migrate `GameScene` to calculate the new layout**

Change the import and both layout call sites in `src/game/scenes/GameScene.ts`:

```ts
import { calculateViewportLayout } from '../view/ViewportLayout.ts';
```

In `startDeal()`:

```ts
const layout = calculateViewportLayout(this.scale.width, this.scale.height);
this.board = new BoardView(this, gameState, { /* existing actions */ }, layout);
```

In `applyViewportLayout()`:

```ts
private applyViewportLayout(): void {
  const width = this.scale.width;
  const height = this.scale.height;
  const camera = this.cameras.main;
  const layout = calculateViewportLayout(width, height);

  camera
    .setSize(width, height)
    .setZoom(1)
    .setScroll(0, 0)
    .setBackgroundColor('#393937');

  this.board?.relayout(layout);
}
```

- [ ] **Step 7: Migrate source-wiring tests away from the removed vertical rail**

Update `tests/foundation-visibility.test.ts` to require point-based foundation placement:

```ts
assert.match(boardSource, /const point = this\.layout\.foundations\[index\]/);
assert.match(boardSource, /x:\s*point\.x/);
assert.match(boardSource, /y:\s*point\.y/);
assert.doesNotMatch(boardSource, /foundationX|foundationY/);
```

Update `tests/render-config.test.ts`:

```ts
assert.match(boardSource, /private layout: ViewportLayout/);
assert.match(boardSource, /relayout\(layout: ViewportLayout\)/);
assert.doesNotMatch(boardSource, /utilityDivider/);
```

Rewrite `tests/responsive-layout.test.ts` to import `calculateViewportLayout` and retain only runtime wiring assertions not already covered by `tests/viewport-layout.test.ts`:

```ts
test('runtime resize keeps camera identity and relayouts the board from live viewport geometry', () => {
  assert.match(gameSceneSource, /calculateViewportLayout\(width,\s*height/);
  assert.match(gameSceneSource, /setZoom\(1\)/);
  assert.match(gameSceneSource, /setScroll\(0,\s*0\)/);
  assert.match(gameSceneSource, /this\.board\?\.relayout\(layout\)/);
});
```

- [ ] **Step 8: Delete the obsolete layout module after all imports are migrated**

```bash
git rm src/game/view/LayoutMetrics.ts
```

Confirm no runtime/test imports remain:

```bash
git grep -n "LayoutMetrics\|foundationX\|foundationY\|utilityDividerX\|compositionBounds" -- src tests
```

Expected: no matches except historical docs that are intentionally updated in Task 6.

- [ ] **Step 9: Run Task 2 and full verification**

```bash
node --test tests/viewport-layout.test.ts tests/board-layout.test.ts tests/foundation-visibility.test.ts tests/responsive-layout.test.ts tests/render-config.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/game/view/layout.ts src/game/view/BoardView.ts src/game/scenes/GameScene.ts tests/board-layout.test.ts tests/responsive-layout.test.ts tests/foundation-visibility.test.ts tests/render-config.test.ts
git add -u src/game/view/LayoutMetrics.ts
git commit -m "feat: move board to shared responsive geometry"
```

---

### Task 3: Extract an Icon-Only Gameplay HUD from `BoardView`

**Files:**
- Create: `src/game/view/GameControlsView.ts`
- Create: `tests/game-controls-view.test.ts`
- Modify: `src/game/view/BoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Modify: `tests/dom-ui.test.ts`
- Modify: `tests/main-menu-wiring.test.ts`
- Modify: `tests/game-controls.test.ts`
- Modify: `tests/render-config.test.ts`

**Interfaces:**
- Produces:
  - `interface GameControlsActions { mainMenu; newGame; undo; restart }`
  - `class GameControlsView { constructor(scene, actions); show(mode); relayout(layout); hide(); destroy(); }`
- `BoardView` no longer creates/removes DOM elements.
- `GameScene` owns one `GameControlsView`; Undo delegates to existing `undoLastAction()` so BoardView animation/input-lock semantics stay intact.

- [ ] **Step 1: Write failing HUD source/contract tests**

Create `tests/game-controls-view.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

const styles = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('gameplay controls live in a dedicated native DOM HUD with accessible icon buttons', () => {
  assert.match(source, /class GameControlsView/);
  assert.match(source, /game-hud/);
  assert.match(source, /document\.createElement\(['"]button['"]\)/);
  assert.match(source, /aria-label/);
  assert.match(source, /createElementNS\([^]*svg/);
  assert.match(source, /game-control-tooltip/);
  assert.doesNotMatch(source, /textContent\s*=\s*['"]В МЕНЮ|НОВАЯ ИГРА\s+N|ОТМЕНА\s+Z|РЕСТАРТ\s+R/);
});

test('Daily hides New Deal while ordinary modes expose all four actions', () => {
  assert.match(source, /mode === 'daily'/);
  assert.match(source, /newDealButton\.hidden/);
});

test('HUD CSS provides 44px controls and does not restore the old fixed 512px overlay', () => {
  assert.match(styles, /\.game-control-button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  assert.doesNotMatch(styles, /\.game-controls\s*\{[^}]*width:\s*512px/s);
});

test('BoardView no longer owns gameplay DOM buttons', () => {
  assert.doesNotMatch(boardSource, /createGameButtons|game-controls|ownedDomElements/);
});
```

- [ ] **Step 2: Run the HUD tests and verify RED**

```bash
node --test tests/game-controls-view.test.ts
```

Expected: FAIL because `GameControlsView.ts` does not exist.

- [ ] **Step 3: Implement the focused HUD view with four inline SVG specs**

Create `src/game/view/GameControlsView.ts` with this public structure and icon data:

```ts
import type Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';
import type { ViewportLayout } from './ViewportLayout.ts';

export interface GameControlsActions {
  readonly mainMenu: () => void;
  readonly newGame: () => void;
  readonly undo: () => void;
  readonly restart: () => void;
}

interface ControlSpec {
  readonly label: string;
  readonly tooltip: string;
  readonly path: string;
  readonly action: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export class GameControlsView {
  private readonly root: HTMLDivElement;
  private readonly newDealButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: GameControlsActions) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.setAttribute('aria-label', 'Управление игрой');

    const controls = document.createElement('div');
    controls.className = 'game-controls';

    const specs: ControlSpec[] = [
      {
        label: 'Открыть меню',
        tooltip: 'Меню · Esc',
        path: 'M4 7h16M4 12h16M4 17h16',
        action: actions.mainMenu,
      },
      {
        label: 'Новая игра',
        tooltip: 'Новая игра · N',
        path: 'M4 7h3c4 0 4 10 8 10h5M17 14l3 3-3 3M4 17h3c2 0 3-2 4-4M14 7h6M17 4l3 3-3 3',
        action: actions.newGame,
      },
      {
        label: 'Отменить ход',
        tooltip: 'Отмена · Z',
        path: 'M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6',
        action: actions.undo,
      },
      {
        label: 'Перезапустить раздачу',
        tooltip: 'Рестарт · R',
        path: 'M20 11a8 8 0 1 0-2 5M20 5v6h-6',
        action: actions.restart,
      },
    ];

    const buttons = specs.map((spec) => this.createButton(spec));
    this.newDealButton = buttons[1];
    controls.append(...buttons);
    this.root.append(controls);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for gameplay controls.');
    }
    host.append(this.root);
    this.hide();
  }

  show(mode: GameMode): void {
    this.newDealButton.hidden = mode === 'daily';
    this.root.hidden = false;
  }

  relayout(layout: ViewportLayout): void {
    this.root.style.left = `${layout.hudBounds.x}px`;
    this.root.style.top = `${layout.hudBounds.y}px`;
    this.root.style.width = `${layout.hudBounds.width}px`;
    this.root.style.height = `${layout.hudBounds.height}px`;
  }

  hide(): void {
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createButton(spec: ControlSpec): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-control-button';
    button.setAttribute('aria-label', spec.label);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      spec.action();
    });

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('game-control-icon');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', spec.path);
    svg.append(path);

    const tooltip = document.createElement('span');
    tooltip.className = 'game-control-tooltip';
    tooltip.textContent = spec.tooltip;

    button.append(svg, tooltip);
    return button;
  }
}
```

- [ ] **Step 4: Remove DOM ownership from `BoardView`**

Delete from `src/game/view/BoardView.ts`:

```ts
private readonly ownedDomElements: HTMLElement[] = [];
```

Delete the `createGameButtons()` call from the constructor, delete the complete `createGameButtons()` method, and remove DOM-element cleanup from `destroy()`. Remove `restart`, `newGame`, and `mainMenu` from `BoardActions` because `BoardView` no longer invokes those actions. Keep `undo` because `requestUndo()` still owns the animated/locked undo boundary.

Keep `requestUndo()` public; the new HUD must route Undo through `GameScene.undoLastAction()` rather than calling `history.undo()` directly.

- [ ] **Step 5: Make `GameScene` own and relayout `GameControlsView`**

Add:

```ts
import { GameControlsView } from '../view/GameControlsView.ts';

private gameControls!: GameControlsView;
private currentLayout!: ViewportLayout;
```

After the existing DOM view construction in `create()`:

```ts
this.gameControls = new GameControlsView(this, {
  mainMenu: () => this.openMainMenu(),
  newGame: () => this.startNewDeal(),
  undo: () => this.undoLastAction(),
  restart: () => this.restartDeal(),
});
```

In `startDeal()` after creating the board:

```ts
this.gameControls.show(deal.mode);
this.gameControls.relayout(layout);
```

In `applyViewportLayout()`:

```ts
this.currentLayout = calculateViewportLayout(width, height);
this.board?.relayout(this.currentLayout);
this.gameControls?.relayout(this.currentLayout);
```

In `shutdown()`:

```ts
this.gameControls.destroy();
```

- [ ] **Step 6: Replace the fixed text-button CSS with compact icon HUD CSS**

Replace the old `.game-controls` / `.game-control-button` block in `src/styles.css` with:

```css
.game-hud {
  position: absolute;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  pointer-events: none;
  font-family: Georgia, "Times New Roman", serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
}

.game-hud[hidden] {
  display: none;
}

.game-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  pointer-events: auto;
}

.game-control-button {
  position: relative;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--ui-bronze-dark);
  background:
    linear-gradient(rgba(255, 248, 225, 0.16), rgba(83, 55, 28, 0.1)),
    var(--ui-parchment);
  box-shadow:
    inset 0 0 0 1px rgba(239, 220, 172, 0.66),
    0 2px 5px rgba(18, 12, 8, 0.38);
  color: var(--ui-ink);
  cursor: pointer;
  appearance: none;
}

.game-control-icon {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.game-control-tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 7px);
  min-width: max-content;
  padding: 5px 8px;
  border: 1px solid rgba(92, 69, 44, 0.66);
  background: var(--ui-parchment-light);
  color: var(--ui-ink);
  font: 700 12px/1.2 Georgia, "Times New Roman", serif;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 90ms linear, transform 90ms linear;
}

@media (hover: hover) and (pointer: fine) {
  .game-control-button:hover .game-control-tooltip,
  .game-control-button:focus-visible .game-control-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
}

@media (hover: none), (pointer: coarse) {
  .game-control-tooltip {
    display: none;
  }
}
```

Retain the existing parchment hover/active/focus styling, adapted to 44×44 buttons rather than text line-height.

- [ ] **Step 7: Update existing DOM/wiring tests to the new owner**

In `tests/dom-ui.test.ts`, read `GameControlsView.ts` instead of expecting buttons inside `BoardView.ts`:

```ts
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);

assert.match(controlsSource, /game-hud/);
assert.match(controlsSource, /canvas\.parentElement/);
assert.match(controlsSource, /document\.createElement\(['"]button['"]\)/);
assert.doesNotMatch(boardSource, /document\.createElement\(['"]button['"]\)/);
```

In `tests/main-menu-wiring.test.ts`, replace text-label assertions with:

```ts
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);
assert.match(controlsSource, /Открыть меню/);
assert.match(controlsSource, /Новая игра/);
assert.match(controlsSource, /Отменить ход/);
assert.match(controlsSource, /Перезапустить раздачу/);
assert.match(controlsSource, /mode === 'daily'/);
```

Update `tests/game-controls.test.ts` so keyboard behavior still belongs to `GameScene`, while click UI ownership belongs to `GameControlsView`.

- [ ] **Step 8: Run HUD-focused and full verification**

```bash
node --test tests/game-controls-view.test.ts tests/dom-ui.test.ts tests/main-menu-wiring.test.ts tests/game-controls.test.ts tests/render-config.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/game/view/GameControlsView.ts src/game/view/BoardView.ts src/game/scenes/GameScene.ts src/styles.css tests/game-controls-view.test.ts tests/dom-ui.test.ts tests/main-menu-wiring.test.ts tests/game-controls.test.ts tests/render-config.test.ts
git commit -m "feat: add compact icon gameplay hud"
```

---

### Task 4: Wire Compact Landscape and Safe-Area Insets End-to-End

**Files:**
- Create: `src/game/view/SafeArea.ts`
- Create: `tests/safe-area.test.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/view/GameControlsView.ts`
- Modify: `src/styles.css`
- Modify: `index.html`
- Modify: `tests/viewport-layout.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Consumes: `SafeAreaInsets` from `ViewportLayout.ts`.
- Produces:
  - `class SafeAreaReader { constructor(host); read(): SafeAreaInsets; destroy(): void }`
  - `GameScene` passes live numeric safe-area values into every `calculateViewportLayout()` call.
  - `viewport-fit=cover` is present in `index.html`.

- [ ] **Step 1: Write failing safe-area adapter tests**

Create `tests/safe-area.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCssPixels } from '../src/game/view/SafeArea.ts';

test('safe-area CSS pixel parsing normalizes valid and malformed values', () => {
  assert.equal(parseCssPixels('24px'), 24);
  assert.equal(parseCssPixels('0px'), 0);
  assert.equal(parseCssPixels('12.5px'), 12.5);
  assert.equal(parseCssPixels(''), 0);
  assert.equal(parseCssPixels('auto'), 0);
  assert.equal(parseCssPixels('-4px'), 0);
});
```

Add to `tests/dom-ui.test.ts`:

```ts
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('full-viewport mobile rendering opts into safe-area coverage', () => {
  assert.match(indexSource, /viewport-fit=cover/);
  assert.match(stylesSource, /safe-area-inset-top/);
  assert.match(stylesSource, /safe-area-inset-right/);
  assert.match(stylesSource, /safe-area-inset-left/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
node --test tests/safe-area.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because `SafeArea.ts` and `viewport-fit=cover` do not exist yet.

- [ ] **Step 3: Implement the browser safe-area reader**

Create `src/game/view/SafeArea.ts`:

```ts
import type { SafeAreaInsets } from './ViewportLayout.ts';

export function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export class SafeAreaReader {
  private readonly probe: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.probe = document.createElement('div');
    this.probe.className = 'safe-area-probe';
    this.probe.setAttribute('aria-hidden', 'true');
    host.append(this.probe);
  }

  read(): SafeAreaInsets {
    const style = getComputedStyle(this.probe);
    return {
      top: parseCssPixels(style.paddingTop),
      right: parseCssPixels(style.paddingRight),
      bottom: parseCssPixels(style.paddingBottom),
      left: parseCssPixels(style.paddingLeft),
    };
  }

  destroy(): void {
    this.probe.remove();
  }
}
```

- [ ] **Step 4: Add the hidden CSS env probe and safe HUD padding**

Add to `src/styles.css`:

```css
.safe-area-probe {
  position: fixed;
  inset: 0;
  z-index: -1;
  padding:
    env(safe-area-inset-top, 0px)
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
  visibility: hidden;
  pointer-events: none;
}

@media (max-height: 620px) and (orientation: landscape) {
  .game-controls {
    gap: 6px;
  }
}
```

- [ ] **Step 5: Add `viewport-fit=cover` to the existing viewport meta tag**

Change `index.html` to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

- [ ] **Step 6: Wire `SafeAreaReader` into `GameScene` layout calculation and cleanup**

Add imports/field:

```ts
import { SafeAreaReader } from '../view/SafeArea.ts';

private safeAreaReader!: SafeAreaReader;
```

At the beginning of `create()`, before the first viewport calculation:

```ts
const host = this.game.canvas.parentElement;
if (host === null) {
  throw new Error('Game canvas must have a parent element for responsive layout.');
}
this.safeAreaReader = new SafeAreaReader(host);
```

Use the reader in both `startDeal()` and `applyViewportLayout()`:

```ts
const layout = calculateViewportLayout(
  this.scale.width,
  this.scale.height,
  this.safeAreaReader.read(),
);
```

Cleanup in `shutdown()`:

```ts
this.safeAreaReader.destroy();
```

- [ ] **Step 7: Extend the layout matrix with a notch case that checks concrete slot positions**

Append to `tests/viewport-layout.test.ts`:

```ts
test('safe-area layout keeps stock, foundations, waste lane, and tableau inside the inset board', () => {
  const layout = calculateViewportLayout(932, 430, {
    top: 10,
    right: 34,
    bottom: 8,
    left: 26,
  });
  const boardRight = layout.boardBounds.x + layout.boardBounds.width;

  assert.ok(layout.stock.x >= layout.boardBounds.x);
  assert.ok(layout.stock.y >= layout.boardBounds.y);
  assert.ok(layout.foundations.every((point) => point.x >= layout.boardBounds.x));
  assert.ok(layout.foundations.every((point) => point.x + layout.cardWidth <= boardRight + 1e-9));
  assert.ok(layout.tableauX.every((x) => x >= layout.boardBounds.x));
  assert.ok(layout.tableauX.every((x) => x + layout.cardWidth <= boardRight + 1e-9));
});
```

- [ ] **Step 8: Run safe-area/compact and full verification**

```bash
node --test tests/safe-area.test.ts tests/viewport-layout.test.ts tests/dom-ui.test.ts tests/responsive-layout.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 9: Commit Task 4**

```bash
git add src/game/view/SafeArea.ts src/game/scenes/GameScene.ts src/game/view/GameControlsView.ts src/styles.css index.html tests/safe-area.test.ts tests/viewport-layout.test.ts tests/dom-ui.test.ts
git commit -m "feat: support compact landscape safe areas"
```

---

### Task 5A: Redesign the Main Menu for Short Landscape Without Scrolling

**Files:**
- Modify: `src/game/view/MainMenuView.ts`
- Modify: `src/styles.css`
- Modify: `tests/main-menu-wiring.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Main menu data/actions remain unchanged.
- Produces semantic wrappers:
  - `.main-menu-content`
  - `.main-menu-modes`
  - `.main-menu-side`
- Compact landscape CSS turns those wrappers into a two-column composition; standard desktop remains visually vertical/comfortable.

- [ ] **Step 1: Add failing source tests for compact menu structure and no-scroll CSS**

Append to `tests/main-menu-wiring.test.ts`:

```ts
test('main menu exposes semantic groups for two-column compact landscape', () => {
  const menuSource = readFileSync(
    new URL('../src/game/view/MainMenuView.ts', import.meta.url),
    'utf8',
  );
  assert.match(menuSource, /main-menu-content/);
  assert.match(menuSource, /main-menu-modes/);
  assert.match(menuSource, /main-menu-side/);
});
```

Append to `tests/dom-ui.test.ts`:

```ts
test('short-landscape main menu reorganizes rather than scrolling', () => {
  assert.match(stylesSource, /@media\s*\(max-height:\s*620px\)\s*and\s*\(orientation:\s*landscape\)/);
  assert.match(stylesSource, /\.main-menu-content\s*\{[^}]*grid-template-columns/s);
  assert.doesNotMatch(stylesSource, /\.main-menu-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test tests/main-menu-wiring.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because the grouping classes are absent.

- [ ] **Step 3: Group existing menu content without changing behavior**

In `MainMenuView.ts`, after creating mode buttons/meta actions, build:

```ts
const content = document.createElement('div');
content.className = 'main-menu-content';

const modes = document.createElement('div');
modes.className = 'main-menu-modes';
modes.append(winnable, original, daily);

const side = document.createElement('div');
side.className = 'main-menu-side';
side.append(this.weekly, metaActions);

content.append(modes, side);
panel.append(
  title,
  intro,
  divider,
  content,
  this.cancelButton,
);
```

Remove the old direct append of `winnable`, `original`, `daily`, `weekly`, and `metaActions` to the panel.

- [ ] **Step 4: Replace the old `max-height: 520px` squeeze rules with an actual compact-landscape grid**

Add/replace short-landscape rules in `src/styles.css`:

```css
.main-menu-content {
  position: relative;
  z-index: 1;
}

.main-menu-modes,
.main-menu-side {
  min-width: 0;
}

@media (max-height: 620px) and (orientation: landscape) {
  .main-menu-panel {
    width: min(900px, calc(100vw - 28px));
    min-height: 0;
    max-height: calc(100vh - 20px);
    padding: 18px 26px 14px;
  }

  .main-menu-title {
    margin-bottom: 2px;
    font-size: 24px;
  }

  .main-menu-intro {
    font-size: 12px;
  }

  .main-menu-divider {
    height: 10px;
    margin: 2px auto 7px;
  }

  .main-menu-content {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(250px, 0.85fr);
    gap: 12px;
    align-items: start;
  }

  .main-menu-mode {
    min-height: 56px;
    margin-bottom: 6px;
    padding: 6px 24px;
    gap: 2px;
  }

  .main-menu-mode-title {
    font-size: 15px;
  }

  .main-menu-mode-copy {
    font-size: 10px;
    line-height: 1.2;
  }

  .main-menu-weekly {
    margin: 0 0 8px;
    padding: 8px 10px;
  }

  .main-menu-meta-actions {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .main-menu-meta-button,
  .main-menu-cancel {
    min-height: 44px;
  }

  .main-menu-cancel {
    width: min(260px, 48%);
    margin: 8px auto 0;
  }
}
```

Do not add `overflow: auto` or `overflow: scroll`.

- [ ] **Step 5: Run menu-focused and full verification**

```bash
node --test tests/main-menu-wiring.test.ts tests/dom-ui.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 6: Commit Task 5A**

```bash
git add src/game/view/MainMenuView.ts src/styles.css tests/main-menu-wiring.test.ts tests/dom-ui.test.ts
git commit -m "feat: add compact landscape main menu"
```

---

### Task 5B: Fit Statistics and Top-10 Leaderboard Into Short Landscape

**Files:**
- Modify: `src/game/view/StatisticsView.ts`
- Modify: `src/styles.css`
- Modify: `tests/statistics-view.test.ts`
- Modify: `tests/leaderboard-view.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Statistics data/API unchanged; produces `.statistics-modes` wrapper.
- Leaderboard state/API unchanged; existing sequential 1–10 rows are CSS-flowed as ranks `1–5` and `6–10` in compact landscape with no scrolling.

- [ ] **Step 1: Write failing compact meta-view structure tests**

Append to `tests/statistics-view.test.ts`:

```ts
test('statistics modal groups both modes for compact side-by-side layout', () => {
  assert.match(source, /statistics-modes/);
});
```

Append to `tests/leaderboard-view.test.ts`:

```ts
test('leaderboard keeps one ordered top-10 list that compact CSS can flow into two columns', () => {
  assert.match(source, /state\.entries\.slice\(0, 10\)/);
  assert.match(source, /leaderboard-list/);
});
```

Append to `tests/dom-ui.test.ts`:

```ts
test('compact statistics and leaderboard use grid reflow without scrollbars', () => {
  assert.match(stylesSource, /\.statistics-modes/);
  assert.match(stylesSource, /grid-auto-flow:\s*column/);
  assert.match(stylesSource, /grid-template-rows:\s*repeat\(5/);
  assert.doesNotMatch(stylesSource, /\.leaderboard-[^{]+\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
node --test tests/statistics-view.test.ts tests/leaderboard-view.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because `.statistics-modes` and two-column leaderboard CSS do not exist.

- [ ] **Step 3: Add the statistics wrapper without changing statistics logic**

In `StatisticsView.ts`:

```ts
const modes = document.createElement('div');
modes.className = 'statistics-modes';
modes.append(standard, classic);

panel.append(title, modes, close);
```

- [ ] **Step 4: Add compact statistics and leaderboard CSS**

Add to `src/styles.css`:

```css
.statistics-modes {
  display: grid;
  gap: 10px;
}

@media (max-height: 620px) and (orientation: landscape) {
  .meta-modal-panel {
    max-height: calc(100vh - 20px);
    padding: 14px 24px 12px;
    overflow: hidden;
  }

  .statistics-panel {
    width: min(760px, calc(100vw - 28px));
  }

  .statistics-modes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .statistics-mode + .statistics-mode {
    margin-top: 0;
  }

  .leaderboard-panel {
    width: min(840px, calc(100vw - 28px));
  }

  .leaderboard-list {
    min-height: 0;
    display: grid;
    grid-template-rows: repeat(5, minmax(18px, auto));
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    column-gap: 18px;
    row-gap: 2px;
    padding: 4px 0;
  }

  .leaderboard-row {
    min-height: 18px;
    grid-template-columns: 30px minmax(0, 1fr) 64px;
    font-size: 10px;
  }

  .leaderboard-player-result,
  .leaderboard-auth {
    margin-top: 5px;
  }

  .leaderboard-close {
    min-height: 40px;
    margin-top: 6px;
  }
}
```

If measured content at `844×390` still cannot fit after this exact grid, reduce compact typography/padding within the existing minimum-readable values before introducing pagination. Browser scroll remains forbidden.

- [ ] **Step 5: Run meta-view and full verification**

```bash
node --test tests/statistics-view.test.ts tests/leaderboard-view.test.ts tests/dom-ui.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 6: Commit Task 5B**

```bash
git add src/game/view/StatisticsView.ts src/styles.css tests/statistics-view.test.ts tests/leaderboard-view.test.ts tests/dom-ui.test.ts
git commit -m "feat: fit meta views to short landscape"
```

---

### Task 5C: Reflow Daily and Ordinary Completion Overlays for Short Landscape

**Files:**
- Modify: `src/game/view/DailyCompleteView.ts`
- Modify: `src/game/view/GameCompleteView.ts`
- Modify: `src/styles.css`
- Modify: `tests/daily-complete-view.test.ts`
- Modify: `tests/game-complete-view.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Completion state/actions remain unchanged.
- Both views produce `.daily-complete-summary`; compact landscape displays summary values as a grid while actions remain immediately reachable.

- [ ] **Step 1: Add failing structure tests**

Append to both completion view test files:

```ts
test('completion view exposes a compact summary group', () => {
  assert.match(source, /daily-complete-summary/);
});
```

Append to `tests/dom-ui.test.ts`:

```ts
test('short-landscape completion overlays use grid reflow and stay no-scroll', () => {
  assert.match(stylesSource, /\.daily-complete-summary/);
  assert.doesNotMatch(stylesSource, /\.daily-complete-panel\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/s);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test tests/daily-complete-view.test.ts tests/game-complete-view.test.ts tests/dom-ui.test.ts
```

Expected: FAIL because `.daily-complete-summary` is absent.

- [ ] **Step 3: Group Daily completion summary fields**

In `DailyCompleteView.ts`:

```ts
const summary = document.createElement('div');
summary.className = 'daily-complete-summary';
summary.append(this.elapsed, this.best, this.weekly);

panel.append(
  title,
  divider,
  summary,
  buttonRow,
);
```

- [ ] **Step 4: Group ordinary completion summary fields**

In `GameCompleteView.ts`:

```ts
const summary = document.createElement('div');
summary.className = 'daily-complete-summary game-complete-summary';
summary.append(
  this.mode,
  this.elapsed,
  this.best,
  this.record,
  this.stats,
);

panel.append(
  title,
  divider,
  summary,
  buttonRow,
);
```

- [ ] **Step 5: Add compact completion CSS**

Add to `src/styles.css`:

```css
.daily-complete-summary {
  position: relative;
  z-index: 1;
}

@media (max-height: 620px) and (orientation: landscape) {
  .daily-complete-panel {
    width: min(760px, calc(100vw - 28px));
    max-height: calc(100vh - 20px);
    padding: 16px 26px 14px;
    overflow: hidden;
  }

  .daily-complete-title {
    font-size: 21px;
  }

  .daily-complete-divider {
    height: 12px;
    margin: 4px auto 7px;
  }

  .daily-complete-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 12px;
    align-items: center;
  }

  .game-complete-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .daily-complete-stat,
  .daily-complete-weekly {
    margin: 3px 0;
    padding: 0;
    border-top: 0;
    font-size: 13px;
  }

  .daily-complete-actions {
    margin-top: 10px;
  }

  .daily-complete-button {
    min-width: 140px;
    min-height: 44px;
  }
}
```

- [ ] **Step 6: Run completion-focused and full verification**

```bash
node --test tests/daily-complete-view.test.ts tests/game-complete-view.test.ts tests/dom-ui.test.ts
pnpm test
pnpm build
```

Expected: PASS and build exits `0`.

- [ ] **Step 7: Commit Task 5C**

```bash
git add src/game/view/DailyCompleteView.ts src/game/view/GameCompleteView.ts src/styles.css tests/daily-complete-view.test.ts tests/game-complete-view.test.ts tests/dom-ui.test.ts
git commit -m "feat: compact completion overlays for landscape"
```

---

### Task 6: Truth Docs, Orientation Declaration, and Final Responsive/Yandex Acceptance Gate

**Files:**
- Create: `docs/YANDEX_RESPONSIVE_ACCEPTANCE.md`
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Modify: `TREE.txt` via the existing context generator

**Interfaces:**
- No runtime API changes.
- Documentation becomes the final source of truth for supported orientation, shared responsive layout, HUD ownership, safe-area behavior, Task 0 startup rule, and manual Yandex release checks.

- [ ] **Step 1: Write the final acceptance checklist document**

Create `docs/YANDEX_RESPONSIVE_ACCEPTANCE.md` with:

```md
# Yandex Responsive / Reload Acceptance

## Draft configuration

- Mobile support: enabled only if landscape mobile release is intended.
- Orientation: `Landscape`.
- Upload a freshly rebuilt `dist` archive before every acceptance pass.

## Startup / reload

1. Open the Draft with DevTools closed.
2. Press ordinary F5 ten times in succession.
3. Press Ctrl+F5 once.
4. Press ordinary F5 at least five more times.
5. Every launch must render the game/menu.
6. Console must not report `Framebuffer status: Incomplete Attachment`.

## Desktop geometry

Check 1920×1080, 1366×768, 1024×576 and an ultrawide viewport when available.

- HUD never overlaps cards.
- Waste never reaches foundations or HUD.
- All four foundations remain visible.
- All seven tableau columns remain visible.
- Browser page never scrolls.
- 80%, 100% and 125% browser zoom remain usable.

## Mobile/tablet landscape

Check approximately 844×390, 915×412, 932×430 and one tablet landscape viewport.

- All seven tableau columns are immediately visible.
- HUD buttons are comfortably tappable.
- Drag/drop remains reliable.
- No control, card, modal, or critical text is clipped.
- Menu, statistics, leaderboard, Daily result, and ordinary result fit without page scroll.
- Notch/safe-area simulation does not hide critical controls.

## Orientation

Rotate a mobile device/emulator to portrait.

- The platform rotate-device experience appears.
- The game is not accepted as an in-game portrait layout.

## Moderation-style resize

Start from a 16:9 area and shrink both axes by roughly 20%.

- Layout remains valid throughout live resize.
- Camera stays at zoom 1 / scroll 0.
- No waste/HUD/foundation overlap appears during resize.
```

- [ ] **Step 2: Update `PROJECT.md` stable rendering/input contract**

Replace statements about the permanent left foundation utility rail and desktop-only `84..180` sizing with factual final rules:

```md
- Desktop and mobile/tablet landscape use one responsive screen-space layout contract; portrait gameplay is intentionally unsupported.
- Gameplay reserves a native-DOM HUD strip before Phaser board geometry is placed, so cards cannot overlap gameplay controls.
- Standard layouts keep the 84 px desktop card-width floor; compact landscape may reduce card width to 64 px while preserving the 151:108 display aspect ratio and 180 px quality-safe maximum.
- Stock/free-cell, bounded waste lane, four horizontal foundations, and seven tableau columns are all derived from the live viewport and safe-area insets.
- Waste fan-out compresses inside its assigned lane and cannot intrude into foundations or the HUD.
- Primary gameplay controls are icon-only 44×44 native-DOM buttons with accessible labels; desktop pointer/focus exposes tooltips and hotkeys.
```

- [ ] **Step 3: Update `CURRENT_STATE.md` implementation snapshot and next focus**

Document:

```md
- Phaser boot waits for the `#game` host to report a positive rendered width and height before constructing `Phaser.Game`; initial config dimensions come from that measured host.
- Responsive gameplay supports standard desktop and compact landscape profiles through `ViewportLayout`.
- Foundations are horizontal in the top gameplay row; waste uses a bounded lane; tableau uses the remaining board width.
- Gameplay controls live in `GameControlsView` as icon-only 44×44 DOM controls and no longer live in `BoardView`.
- Safe-area insets are read through `SafeAreaReader` and supplied to pure layout math; `viewport-fit=cover` is enabled.
- Main menu, statistics, leaderboard, and completion overlays have no-scroll compact landscape layouts.
```

Set the next focus to advertising at logical pauses through the already implemented shared gameplay lifecycle boundary, unless manual acceptance exposes a concrete responsive defect first.

- [ ] **Step 4: Update `TECH.md` architecture and constraints**

Add/replace architecture entries:

```md
- `src/bootstrap/GameBootstrap.ts` — waits for a positive rendered game-host size before Phaser construction; isolates repeated-reload startup timing from Phaser/WebGL.
- `src/game/view/ViewportLayout.ts` — pure standard/compact-landscape HUD + board geometry including safe-area inputs, horizontal foundations and bounded waste lane.
- `src/game/view/GameControlsView.ts` — native DOM icon HUD; owns gameplay action buttons/tooltips/accessibility and Daily New Deal visibility.
- `src/game/view/SafeArea.ts` — browser-only CSS env inset adapter; pure layout code never reads browser environment values itself.
```

Add constraints:

```md
- Supported touch gameplay orientation is landscape only; do not add an in-game portrait board unless product design explicitly changes.
- HUD and board geometry must remain derived from the same `ViewportLayout`; never reintroduce an independently positioned fixed-width control overlay.
- Do not restore an unbounded waste fan or a permanent vertical foundation rail.
- Main menu/meta/result surfaces remain no-scroll; short landscapes reorganize with grids/columns rather than browser scrolling.
```

- [ ] **Step 5: Run final automated verification and regenerate project context**

```bash
pnpm test
pnpm build
pnpm context
```

Expected: tests PASS, build exits `0`, and `TREE.txt` reflects `GameBootstrap.ts`, `ViewportLayout.ts`, `GameControlsView.ts`, `SafeArea.ts`, their tests, the spec, plan, and acceptance doc.

- [ ] **Step 6: Run the complete manual acceptance matrix before declaring the phase complete**

Use `docs/YANDEX_RESPONSIVE_ACCEPTANCE.md` verbatim. Record any failure as a concrete scenario (`viewport`, `orientation`, `steps`, `visible symptom`, `console error`) and fix it through a new RED test rather than loosening existing invariants.

- [ ] **Step 7: Commit Task 6**

```bash
git add PROJECT.md CURRENT_STATE.md TECH.md TREE.txt docs/YANDEX_RESPONSIVE_ACCEPTANCE.md docs/superpowers/specs/2026-09-05-responsive-board-ui-design.md docs/superpowers/plans/2026-09-05-responsive-board-ui.md
git commit -m "docs: finalize responsive landscape contract"
```

---

## Final Verification Summary

Before calling the entire responsive phase complete, all of these must be true in the same final tree:

```bash
pnpm test
pnpm build
```

And manual Yandex acceptance must confirm:

```text
F5 reload sequence: PASS
1920×1080: PASS
1366×768: PASS
1024×576: PASS
844×390 landscape: PASS
915×412 landscape: PASS
932×430 landscape: PASS
Tablet landscape: PASS
Safe-area/notch simulation: PASS
~20% moderation-style resize: PASS
Portrait rotate-device platform behavior: PASS
No browser scrolling on gameplay/menu/meta/results: PASS
No HUD/waste/foundation/tableau overlap: PASS
```
