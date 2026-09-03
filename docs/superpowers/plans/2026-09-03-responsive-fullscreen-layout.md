# Responsive Fullscreen Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the camera-scaled 1152×768 board with a true viewport-sized Phaser canvas whose cards, slots, stock, waste, foundations, and tableau are laid out directly from the current browser width and height.

**Architecture:** Keep `Phaser.Scale.RESIZE`, but force the main camera to `zoom = 1` and `scroll = 0`. Introduce a pure `calculateLayoutMetrics(width, height)` calculator for constrained desktop geometry, keep derived pile-placement helpers pure, and let `BoardView.relayout(metrics)` resize/reposition existing display objects without recreating `SolitaireGame` or history. DOM menu/HUD remain screen-space HTML and are not part of Phaser layout metrics.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 7, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-responsive-fullscreen-layout-design.md`

## Global Constraints

- Canvas width equals browser viewport width and canvas height equals browser viewport height.
- `Phaser.Scale.RESIZE` remains enabled.
- Main camera zoom is always exactly `1`; main camera scroll is always exactly `0, 0`.
- Browser page must never scroll during gameplay.
- Hybrid desktop layout: cards grow moderately, then gaps grow, then the whole composition centers on ultrawide displays.
- Runtime card aspect ratio remains `108:151`.
- Runtime cards remain PNG assets at 216×302; responsive display size must never exceed 216×302.
- No runtime SVG card loading.
- Current drag/drop overlap threshold and instant manual snap behavior are preserved.
- Existing foundation-stack visibility behavior is preserved: all collected ranks remain placed beneath the incoming rank.
- Resize must not recreate `SolitaireGame`, create history, restart the deal, or restart the initial-deal animation.
- Mobile-specific layout is out of scope.

---

## File Structure

- Create `src/game/view/LayoutMetrics.ts`: pure responsive desktop sizing and absolute board positions.
- Modify `src/game/view/layout.ts`: retain generic `Point` / slot types and convert pile-placement helpers to consume `LayoutMetrics` instead of global constants.
- Modify `src/game/view/BoardTexture.ts`: generate only a reusable non-semantic board pattern texture; remove dependency on fixed game width/height.
- Modify `src/game/view/BoardView.ts`: own current metrics, hold references to resizeable board objects, expose `relayout(metrics)`, and replace all fixed gameplay geometry with metrics.
- Modify `src/game/scenes/GameScene.ts`: remove camera fitting, reset camera to identity, calculate metrics from current scale size, and forward resize to `BoardView`.
- Modify `src/main.ts`: remove 1152×768 imports and initialize RESIZE canvas from the actual browser viewport.
- Delete `src/game/view/ResponsiveViewport.ts`: obsolete camera-fit subsystem.
- Replace `tests/responsive-viewport.test.ts` with `tests/responsive-layout.test.ts`: pure geometry invariants and camera-identity wiring.
- Modify `tests/board-layout.test.ts`: test responsive pile helpers rather than exact authored pixels.
- Keep `tests/dom-ui.test.ts`, `tests/drop-geometry.test.ts`, `tests/drag-snap.test.ts`, and `tests/foundation-visibility.test.ts` as regressions.
- Update `README.md`, `PROJECT.md`, `CURRENT_STATE.md`, `TECH.md`, and regenerate `TREE.txt` after implementation.

---

### Task 1: Pure Responsive Layout Metrics

**Files:**
- Create: `src/game/view/LayoutMetrics.ts`
- Modify: `src/game/view/layout.ts`
- Create: `tests/responsive-layout.test.ts`
- Modify: `tests/board-layout.test.ts`

**Interfaces:**
- Produces: `calculateLayoutMetrics(viewportWidth: number, viewportHeight: number): LayoutMetrics`
- Produces: `LayoutMetrics` with `viewportWidth`, `viewportHeight`, `cardWidth`, `cardHeight`, `foundationX`, `foundationY`, `stock`, `waste`, `tableauX`, `tableauY`, `tableauColumnGap`, `tableauCardGap`, `wasteGap`, `utilityDividerX`, `compositionBounds`, `bottomMargin`.
- Produces: `getBoardSlots(metrics: LayoutMetrics): BoardSlot[]`
- Produces: `tableauCardY(metrics: LayoutMetrics, cardCount: number, index: number): number`
- Produces: `wasteCardX(metrics: LayoutMetrics, cardCount: number, index: number): number`

- [ ] **Step 1: Write failing responsive-layout tests**

Create `tests/responsive-layout.test.ts` with representative desktop viewports and invariant assertions:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_ASPECT_RATIO,
  MAX_CARD_WIDTH,
  MAX_TABLEAU_COLUMN_GAP,
  MIN_CARD_WIDTH,
  calculateLayoutMetrics,
} from '../src/game/view/LayoutMetrics.ts';

function rightEdge(x: number, width: number): number {
  return x + width;
}

for (const [width, height] of [
  [960, 640],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [2560, 1080],
] as const) {
  test(`${width}x${height} keeps every primary board zone inside the viewport`, () => {
    const layout = calculateLayoutMetrics(width, height);

    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.ok(layout.cardWidth >= MIN_CARD_WIDTH);
    assert.ok(layout.cardWidth <= MAX_CARD_WIDTH);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - CARD_ASPECT_RATIO) < 1e-9);

    assert.ok(layout.foundationX >= 0);
    assert.ok(layout.foundationY.every((y) => y >= 0 && y + layout.cardHeight <= height));
    assert.ok(layout.stock.x >= 0 && rightEdge(layout.stock.x, layout.cardWidth) <= width);
    assert.ok(layout.stock.y >= 0 && layout.stock.y + layout.cardHeight <= height);
    assert.ok(layout.waste.x >= 0 && rightEdge(layout.waste.x, layout.cardWidth) <= width);
    assert.equal(layout.tableauX.length, 7);
    assert.ok(layout.tableauX.every((x) => x >= 0 && rightEdge(x, layout.cardWidth) <= width));
    assert.ok(layout.tableauY >= 0 && layout.tableauY + layout.cardHeight <= height);
  });
}

test('ordinary larger desktops do not make cards smaller', () => {
  const base = calculateLayoutMetrics(1366, 768);
  const fullHd = calculateLayoutMetrics(1920, 1080);
  const qhd = calculateLayoutMetrics(2560, 1440);

  assert.ok(fullHd.cardWidth > base.cardWidth);
  assert.ok(qhd.cardWidth >= fullHd.cardWidth);
  assert.ok(qhd.cardWidth <= 216);
  assert.ok(qhd.cardHeight <= 302);
});

test('ultrawide space stops stretching tableau gaps after their maximum', () => {
  const ultrawide = calculateLayoutMetrics(2560, 1080);
  const wider = calculateLayoutMetrics(3440, 1440);

  assert.ok(ultrawide.tableauColumnGap <= MAX_TABLEAU_COLUMN_GAP);
  assert.ok(wider.tableauColumnGap <= MAX_TABLEAU_COLUMN_GAP);
  assert.ok(wider.compositionBounds.x > 0);
  assert.ok(wider.compositionBounds.x + wider.compositionBounds.width < wider.viewportWidth);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --test tests/responsive-layout.test.ts
```

Expected: FAIL because `src/game/view/LayoutMetrics.ts` does not exist.

- [ ] **Step 3: Implement the pure calculator**

Create `src/game/view/LayoutMetrics.ts` using constrained dimensions, not a camera/global scale:

```ts
export const CARD_ASPECT_RATIO = 151 / 108;
export const MIN_CARD_WIDTH = 84;
export const BASE_CARD_WIDTH = 108;
export const MAX_CARD_WIDTH = 180;
export const MIN_TABLEAU_COLUMN_GAP = 18;
export const MAX_TABLEAU_COLUMN_GAP = 44;

const REFERENCE_HEIGHT = 768;
const MIN_EDGE_MARGIN = 14;
const MAX_EDGE_MARGIN = 32;
const MIN_ZONE_GAP = 28;
const MAX_ZONE_GAP = 56;
const MIN_FOUNDATION_GAP = 12;
const MAX_FOUNDATION_GAP = 42;
const MIN_TABLEAU_ROW_GAP = 28;
const MAX_TABLEAU_ROW_GAP = 64;
const MIN_TABLEAU_CARD_GAP = 24;
const MAX_TABLEAU_CARD_GAP = 52;
const MIN_WASTE_GAP = 18;
const MAX_WASTE_GAP = 40;

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

export interface LayoutMetrics {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly foundationX: number;
  readonly foundationY: readonly number[];
  readonly stock: LayoutPoint;
  readonly waste: LayoutPoint;
  readonly tableauX: readonly number[];
  readonly tableauY: number;
  readonly tableauColumnGap: number;
  readonly tableauCardGap: number;
  readonly wasteGap: number;
  readonly utilityDividerX: number;
  readonly compositionBounds: LayoutBounds;
  readonly bottomMargin: number;
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function calculateLayoutMetrics(
  viewportWidth: number,
  viewportHeight: number,
): LayoutMetrics {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1;
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1;
  const edgeMargin = clamp(MIN_EDGE_MARGIN, width * 0.018, MAX_EDGE_MARGIN);
  const preferredCardWidth = clamp(
    MIN_CARD_WIDTH,
    BASE_CARD_WIDTH * (height / REFERENCE_HEIGHT),
    MAX_CARD_WIDTH,
  );
  const widthFitCardWidth = (
    width
    - edgeMargin * 2
    - MIN_ZONE_GAP
    - MIN_TABLEAU_COLUMN_GAP * 6
  ) / 8;
  const cardWidth = clamp(
    MIN_CARD_WIDTH,
    Math.min(preferredCardWidth, widthFitCardWidth),
    MAX_CARD_WIDTH,
  );
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;
  const zoneGap = clamp(MIN_ZONE_GAP, cardWidth * 0.35, MAX_ZONE_GAP);
  const maximumGapFromWidth = (
    width - edgeMargin * 2 - cardWidth * 8 - zoneGap
  ) / 6;
  const tableauColumnGap = clamp(
    MIN_TABLEAU_COLUMN_GAP,
    Math.min(cardWidth * 0.28, maximumGapFromWidth),
    MAX_TABLEAU_COLUMN_GAP,
  );
  const compositionWidth = cardWidth * 8 + zoneGap + tableauColumnGap * 6;
  const compositionX = Math.max(edgeMargin, (width - compositionWidth) / 2);
  const foundationX = compositionX;
  const firstTableauX = foundationX + cardWidth + zoneGap;
  const tableauX = Array.from(
    { length: 7 },
    (_, index) => firstTableauX + index * (cardWidth + tableauColumnGap),
  );

  const topMargin = clamp(18, height * 0.03, 32);
  const bottomMargin = topMargin;
  const tableauRowGap = clamp(MIN_TABLEAU_ROW_GAP, height * 0.07, MAX_TABLEAU_ROW_GAP);
  const tableauY = topMargin + cardHeight + tableauRowGap;
  const tableauCardGap = clamp(
    MIN_TABLEAU_CARD_GAP,
    cardHeight * (36 / 151),
    MAX_TABLEAU_CARD_GAP,
  );
  const wasteGap = clamp(MIN_WASTE_GAP, cardWidth * (26 / 108), MAX_WASTE_GAP);

  const rawFoundationGap = (
    height - topMargin * 2 - cardHeight * 4
  ) / 3;
  const foundationGap = clamp(MIN_FOUNDATION_GAP, rawFoundationGap, MAX_FOUNDATION_GAP);
  const foundationStackHeight = cardHeight * 4 + foundationGap * 3;
  const foundationStartY = Math.max(topMargin, (height - foundationStackHeight) / 2);
  const foundationY = Array.from(
    { length: 4 },
    (_, index) => foundationStartY + index * (cardHeight + foundationGap),
  );

  return {
    viewportWidth: width,
    viewportHeight: height,
    cardWidth,
    cardHeight,
    foundationX,
    foundationY,
    stock: { x: tableauX[0], y: topMargin },
    waste: { x: tableauX[1], y: topMargin },
    tableauX,
    tableauY,
    tableauColumnGap,
    tableauCardGap,
    wasteGap,
    utilityDividerX: foundationX + cardWidth + zoneGap / 2,
    compositionBounds: {
      x: compositionX,
      y: 0,
      width: compositionWidth,
      height,
    },
    bottomMargin,
  };
}
```

- [ ] **Step 4: Convert derived layout helpers to consume metrics**

Modify `src/game/view/layout.ts` so it has no fixed game/card coordinates:

```ts
import type { LayoutMetrics } from './LayoutMetrics.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type BoardSlotKind = 'foundation' | 'stock' | 'tableau';

export interface BoardSlot extends Point {
  readonly kind: BoardSlotKind;
  readonly alpha: number;
}

export function getBoardSlots(metrics: LayoutMetrics): BoardSlot[] {
  return [
    ...metrics.foundationY.map((y) => ({
      kind: 'foundation' as const,
      x: metrics.foundationX,
      y,
      alpha: 0.32,
    })),
    {
      kind: 'stock' as const,
      x: metrics.stock.x,
      y: metrics.stock.y,
      alpha: 0.32,
    },
    ...metrics.tableauX.map((x) => ({
      kind: 'tableau' as const,
      x,
      y: metrics.tableauY,
      alpha: 0.16,
    })),
  ];
}

export function tableauCardY(
  metrics: LayoutMetrics,
  cardCount: number,
  index: number,
): number {
  const available = metrics.viewportHeight
    - metrics.tableauY
    - metrics.cardHeight
    - metrics.bottomMargin;
  const gap = cardCount <= 1
    ? metrics.tableauCardGap
    : Math.min(metrics.tableauCardGap, Math.max(0, available / (cardCount - 1)));

  return metrics.tableauY + index * gap;
}

export function wasteCardX(
  metrics: LayoutMetrics,
  cardCount: number,
  index: number,
): number {
  const compositionRight = metrics.compositionBounds.x + metrics.compositionBounds.width;
  const available = compositionRight - metrics.waste.x - metrics.cardWidth;
  const gap = cardCount <= 1
    ? metrics.wasteGap
    : Math.min(metrics.wasteGap, Math.max(0, available / (cardCount - 1)));

  return metrics.waste.x + index * gap;
}
```

- [ ] **Step 5: Rewrite board-layout tests as responsive invariants**

Replace exact `236` / `768` assertions in `tests/board-layout.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateLayoutMetrics } from '../src/game/view/LayoutMetrics.ts';
import { getBoardSlots, tableauCardY } from '../src/game/view/layout.ts';

test('long tableau columns compress to remain inside the current viewport', () => {
  const layout = calculateLayoutMetrics(1366, 768);

  assert.ok(
    tableauCardY(layout, 20, 19) + layout.cardHeight
      <= layout.viewportHeight - layout.bottomMargin + 1e-9,
  );
});

test('board slots still omit a waste placeholder for every viewport', () => {
  const slots = getBoardSlots(calculateLayoutMetrics(1920, 1080));

  assert.equal(slots.filter((slot) => slot.kind === 'foundation').length, 4);
  assert.equal(slots.filter((slot) => slot.kind === 'stock').length, 1);
  assert.equal(slots.filter((slot) => slot.kind === 'tableau').length, 7);
  assert.equal(slots.some((slot) => String(slot.kind) === 'waste'), false);
});
```

- [ ] **Step 6: Run Task 1 tests and verify GREEN**

Run:

```powershell
node --test tests/responsive-layout.test.ts tests/board-layout.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add src/game/view/LayoutMetrics.ts src/game/view/layout.ts tests/responsive-layout.test.ts tests/board-layout.test.ts
git commit -m "feat: add responsive board layout metrics"
```

---

### Task 2: Relayout Existing Board Objects Without Camera Scaling

**Files:**
- Modify: `src/game/view/BoardTexture.ts`
- Modify: `src/game/view/BoardView.ts`
- Modify: `tests/render-config.test.ts`
- Modify: `tests/foundation-visibility.test.ts`

**Interfaces:**
- Consumes: `LayoutMetrics`, `getBoardSlots(metrics)`, `tableauCardY(metrics, ...)`, `wasteCardX(metrics, ...)` from Task 1.
- Produces: `BoardView.relayout(metrics: LayoutMetrics): void`.
- Preserves: `BoardView.requestUndo()`, current drag/drop target logic, foundation stack placement, DOM control API.

- [ ] **Step 1: Add failing source-level regression tests for responsive BoardView**

Extend `tests/render-config.test.ts` with:

```ts
test('board geometry comes from instance layout metrics instead of authored constants', () => {
  assert.match(boardSource, /private layout: LayoutMetrics/);
  assert.match(boardSource, /relayout\(metrics: LayoutMetrics\)/);
  assert.match(boardSource, /this\.layout\.cardWidth/);
  assert.doesNotMatch(
    boardSource,
    /\bCARD_WIDTH\b|\bCARD_HEIGHT\b|\bFOUNDATION_X\b|\bFOUNDATION_Y\b|\bSTOCK_X\b|\bSTOCK_Y\b|\bTABLEAU_X\b|\bTABLEAU_Y\b/,
  );
});
```

Keep the existing foundation regression and add a relayout-specific protection to `tests/foundation-visibility.test.ts`:

```ts
assert.match(boardSource, /this\.game\.foundations\[suit\]\.forEach\(\(card,\s*cardIndex\)/);
assert.match(boardSource, /x:\s*this\.layout\.foundationX/);
assert.match(boardSource, /y:\s*this\.layout\.foundationY\[index\]/);
```

- [ ] **Step 2: Run the targeted tests and verify RED**

Run:

```powershell
node --test tests/render-config.test.ts tests/foundation-visibility.test.ts
```

Expected: FAIL because `BoardView` still imports fixed constants and has no `relayout` method.

- [ ] **Step 3: Make the background texture independent of viewport dimensions**

Modify `src/game/view/BoardTexture.ts` to generate a small reusable pattern tile only:

```ts
import Phaser from 'phaser';

const BOARD_TEXTURE_KEY = 'cascade-board-pattern';
const TILE_SIZE = 48;

export function getBoardTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(BOARD_TEXTURE_KEY)) {
    return BOARD_TEXTURE_KEY;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0x393937, 1);
  graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  graphics.fillStyle(0xffffff, 0.025);

  for (let y = 6; y < TILE_SIZE; y += 12) {
    for (let x = 6 + ((y / 12) % 2) * 6; x < TILE_SIZE; x += 12) {
      graphics.fillCircle(x, y, 1);
    }
  }

  graphics.generateTexture(BOARD_TEXTURE_KEY, TILE_SIZE, TILE_SIZE);
  graphics.destroy();
  return BOARD_TEXTURE_KEY;
}
```

- [ ] **Step 4: Give BoardView mutable layout state and resizeable object references**

Change the constructor signature to:

```ts
constructor(
  scene: Phaser.Scene,
  game: SolitaireGame,
  actions: BoardActions,
  metrics: LayoutMetrics,
)
```

Add fields:

```ts
private layout: LayoutMetrics;
private boardSurface!: Phaser.GameObjects.TileSprite;
private utilityPanel!: Phaser.GameObjects.Rectangle;
private utilityDivider!: Phaser.GameObjects.Rectangle;
private readonly slotRects: Phaser.GameObjects.Rectangle[] = [];
private readonly foundationSymbols: Phaser.GameObjects.Text[] = [];
private freeArrow!: Phaser.GameObjects.Text;
```

Set `this.layout = metrics` before creating visual objects.

- [ ] **Step 5: Create background and slots from current metrics**

`createBoardSurface()` must create a tile sprite that is later resized, plus a bounded utility rail rather than a fixed 1152×768 image:

```ts
this.boardSurface = this.scene.add.tileSprite(
  0,
  0,
  this.layout.viewportWidth,
  this.layout.viewportHeight,
  getBoardTexture(this.scene),
).setOrigin(0).setDepth(0);

this.utilityPanel = this.scene.add.rectangle(0, 0, 1, 1, 0x242b2a, 1)
  .setOrigin(0)
  .setDepth(1);
this.utilityDivider = this.scene.add.rectangle(0, 0, 2, 1, 0x738280, 0.8)
  .setOrigin(0.5, 0)
  .setDepth(2);
```

Use a local foundation rail whose width follows the card instead of darkening the entire ultrawide margin:

```ts
const railPadding = Math.max(14, this.layout.cardWidth * 0.16);
const railX = Math.max(0, this.layout.foundationX - railPadding);
const railRight = Math.min(
  this.layout.viewportWidth,
  this.layout.foundationX + this.layout.cardWidth + railPadding,
);

this.utilityPanel
  .setPosition(railX, 0)
  .setSize(railRight - railX, this.layout.viewportHeight)
  .setDisplaySize(railRight - railX, this.layout.viewportHeight);
this.utilityDivider
  .setPosition(railRight, 0)
  .setSize(2, this.layout.viewportHeight)
  .setDisplaySize(2, this.layout.viewportHeight);
```

Create slot rectangles once and store them in `slotRects`; position/size them from `getBoardSlots(this.layout)`.

- [ ] **Step 6: Replace every fixed card/stock/foundation/tableau geometry use**

In all BoardView methods, use these exact substitutions:

```ts
CARD_WIDTH                  -> this.layout.cardWidth
CARD_HEIGHT                 -> this.layout.cardHeight
STOCK_X                     -> this.layout.stock.x
STOCK_Y                     -> this.layout.stock.y
FOUNDATION_X                -> this.layout.foundationX
FOUNDATION_Y[index]         -> this.layout.foundationY[index]
TABLEAU_X[pile]             -> this.layout.tableauX[pile]
TABLEAU_Y                   -> this.layout.tableauY
tableauCardY(count, index)  -> tableauCardY(this.layout, count, index)
wasteCardX(count, index)    -> wasteCardX(this.layout, count, index)
getBoardSlots()             -> getBoardSlots(this.layout)
```

`createCardImages()` and stock backs must call `.setDisplaySize(this.layout.cardWidth, this.layout.cardHeight)`.

`findDropTarget()` must construct moving/candidate rectangles using the current `this.layout.cardWidth` and `this.layout.cardHeight`, so the 25% overlap policy remains scale-independent.

`calculatePlacements()` must keep every foundation rank:

```ts
SUITS.forEach((suit, index) => {
  this.game.foundations[suit].forEach((card, cardIndex) => {
    placements.set(card.id, {
      x: this.layout.foundationX,
      y: this.layout.foundationY[index],
      depth: 400 + index * 20 + cardIndex,
    });
  });
});
```

- [ ] **Step 7: Implement `BoardView.relayout(metrics)`**

Add this public method:

```ts
relayout(metrics: LayoutMetrics): void {
  this.activeFlights.forEach((flight) => flight.stop());
  this.activeFlights.clear();
  this.dragState = null;
  this.layout = metrics;

  this.boardSurface.setSize(metrics.viewportWidth, metrics.viewportHeight);
  this.boardSurface.setDisplaySize(metrics.viewportWidth, metrics.viewportHeight);

  const railPadding = Math.max(14, metrics.cardWidth * 0.16);
  const railX = Math.max(0, metrics.foundationX - railPadding);
  const railRight = Math.min(
    metrics.viewportWidth,
    metrics.foundationX + metrics.cardWidth + railPadding,
  );
  this.utilityPanel
    .setPosition(railX, 0)
    .setSize(railRight - railX, metrics.viewportHeight)
    .setDisplaySize(railRight - railX, metrics.viewportHeight);
  this.utilityDivider
    .setPosition(railRight, 0)
    .setSize(2, metrics.viewportHeight)
    .setDisplaySize(2, metrics.viewportHeight);

  const slots = getBoardSlots(metrics);
  this.slotRects.forEach((slot, index) => {
    const target = slots[index];
    slot
      .setPosition(
        target.x + metrics.cardWidth / 2,
        target.y + metrics.cardHeight / 2,
      )
      .setSize(metrics.cardWidth, metrics.cardHeight)
      .setDisplaySize(metrics.cardWidth, metrics.cardHeight);
  });

  this.foundationSymbols.forEach((symbol, index) => {
    symbol
      .setPosition(
        metrics.foundationX + metrics.cardWidth / 2,
        metrics.foundationY[index] + metrics.cardHeight / 2,
      )
      .setFontSize(Math.round(metrics.cardWidth * 0.4));
  });
  this.freeArrow
    .setPosition(
      metrics.stock.x + metrics.cardWidth / 2,
      metrics.stock.y + metrics.cardHeight / 2,
    )
    .setFontSize(Math.round(metrics.cardWidth * 0.39));

  this.cardImages.forEach((image) => {
    image.setDisplaySize(metrics.cardWidth, metrics.cardHeight);
  });
  this.stockBacks.forEach((back) => {
    back.setDisplaySize(metrics.cardWidth, metrics.cardHeight);
  });

  this.sync(null);
}
```

During resize, stopping flights and calling `sync(null)` is the accepted cosmetic rebase policy from the spec. A manual drag is cancelled and snapped to the recalculated legal placement; no move is committed.

- [ ] **Step 8: Run BoardView regression tests and verify GREEN**

Run:

```powershell
node --test tests/render-config.test.ts tests/foundation-visibility.test.ts tests/drop-geometry.test.ts tests/drag-snap.test.ts tests/card-motion.test.ts
```

Expected: all tests PASS.

- [ ] **Step 9: Commit Task 2**

```powershell
git add src/game/view/BoardTexture.ts src/game/view/BoardView.ts tests/render-config.test.ts tests/foundation-visibility.test.ts
git commit -m "refactor: make board view consume responsive metrics"
```

---

### Task 3: Replace Camera Fitting With Viewport Resize Lifecycle

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/main.ts`
- Delete: `src/game/view/ResponsiveViewport.ts`
- Delete: `tests/responsive-viewport.test.ts`
- Modify: `tests/responsive-layout.test.ts`
- Modify: `tests/render-config.test.ts`

**Interfaces:**
- Consumes: `calculateLayoutMetrics(width, height)` from Task 1.
- Consumes: `BoardView.relayout(metrics)` from Task 2.
- Produces: GameScene resize lifecycle with identity camera and no authored-board camera fitting.

- [ ] **Step 1: Add failing camera-identity and resize-wiring tests**

Append source checks to `tests/responsive-layout.test.ts`:

```ts
import { readFileSync } from 'node:fs';

const gameSceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

const mainSource = readFileSync(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

test('runtime resize keeps the camera at identity and relayouts the existing board', () => {
  assert.doesNotMatch(gameSceneSource, /ResponsiveViewport|calculateDesktopViewport/);
  assert.match(gameSceneSource, /setZoom\(1\)/);
  assert.match(gameSceneSource, /setScroll\(0,\s*0\)/);
  assert.match(gameSceneSource, /calculateLayoutMetrics\(width,\s*height\)/);
  assert.match(gameSceneSource, /this\.board\?\.relayout\(metrics\)/);
});

test('initial Phaser canvas dimensions come from the real viewport', () => {
  assert.match(mainSource, /width:\s*window\.innerWidth/);
  assert.match(mainSource, /height:\s*window\.innerHeight/);
  assert.doesNotMatch(mainSource, /GAME_WIDTH|GAME_HEIGHT/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
});
```

- [ ] **Step 2: Run the targeted tests and verify RED**

Run:

```powershell
node --test tests/responsive-layout.test.ts tests/render-config.test.ts
```

Expected: FAIL because `GameScene` still imports `ResponsiveViewport` and `main.ts` still initializes from fixed dimensions.

- [ ] **Step 3: Replace GameScene camera fitting with identity-camera layout forwarding**

In `GameScene.ts`, import:

```ts
import { calculateLayoutMetrics } from '../view/LayoutMetrics.ts';
```

Remove the `ResponsiveViewport.ts` import and replace `applyResponsiveViewport()` with:

```ts
private applyViewportLayout(): void {
  const width = this.scale.width;
  const height = this.scale.height;
  const camera = this.cameras.main;
  const metrics = calculateLayoutMetrics(width, height);

  camera
    .setSize(width, height)
    .setZoom(1)
    .setScroll(0, 0)
    .setBackgroundColor('#393937');

  this.board?.relayout(metrics);
}
```

Call `this.applyViewportLayout()` from `create()` before menu creation and from `handleResize()`.

When creating a board in `startDeal`, calculate once from the current scale size and pass it into the constructor:

```ts
const metrics = calculateLayoutMetrics(this.scale.width, this.scale.height);
this.board = new BoardView(this, gameState, actions, metrics);
```

This preserves the existing `SolitaireGame` instance on resize because only `board.relayout(metrics)` runs.

- [ ] **Step 4: Make initial GameConfig size match the browser**

Change `src/main.ts` to:

```ts
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#393937',
  disableContextMenu: true,
  scene: [BootScene, GameScene],
  input: {
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoRound: true,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
});
```

Do not add root `resolution`; Phaser 3.90 typings reject it in this project.

- [ ] **Step 5: Remove obsolete camera-fit subsystem**

Delete:

```text
src/game/view/ResponsiveViewport.ts
tests/responsive-viewport.test.ts
```

- [ ] **Step 6: Run responsive/runtime regression tests and verify GREEN**

Run:

```powershell
node --test tests/responsive-layout.test.ts tests/render-config.test.ts tests/dom-ui.test.ts tests/drag-snap.test.ts tests/drop-geometry.test.ts tests/foundation-visibility.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add src/main.ts src/game/scenes/GameScene.ts src/game/view/ResponsiveViewport.ts tests/responsive-viewport.test.ts tests/responsive-layout.test.ts tests/render-config.test.ts
git commit -m "refactor: drive board layout from viewport size"
```

---

### Task 4: Project Context, Full Regression, and Build Verification

**Files:**
- Modify: `README.md`
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Regenerate: `TREE.txt`
- Include: `docs/superpowers/specs/2026-09-03-responsive-fullscreen-layout-design.md`
- Include: `docs/superpowers/plans/2026-09-03-responsive-fullscreen-layout.md`

**Interfaces:**
- Consumes: completed responsive implementation from Tasks 1–3.
- Produces: accurate project handoff/context and verified patch.

- [ ] **Step 1: Update project docs with the final responsive contract**

Each project document must state the same architecture:

```text
Phaser canvas uses Scale.RESIZE and fills the browser viewport.
The main camera stays at zoom 1 / scroll 0.
LayoutMetrics calculates cards, foundations, stock, waste, and tableau directly from the current viewport.
Desktop cards grow within constrained min/max sizes; gaps then grow within maxima; ultrawide excess space centers the composition.
DOM HUD/menu remain screen-space HTML.
Resize relayouts existing BoardView objects without recreating the game model/history.
```

Remove stale statements describing 1152×768 as a runtime authored board fitted by camera zoom.

- [ ] **Step 2: Regenerate context tree**

Run:

```powershell
pnpm context
```

Expected: `_chatgpt_bundle/CHATGPT_CONTEXT.txt` and `TREE.txt` reflect `LayoutMetrics.ts`, the new responsive test, and removal of `ResponsiveViewport.ts`.

- [ ] **Step 3: Run the complete test suite**

Run:

```powershell
pnpm test
```

Expected: 0 failures.

- [ ] **Step 4: Run the production build**

Run:

```powershell
pnpm build
```

Expected: TypeScript and Vite exit with code 0. The existing Vite large-chunk warning is acceptable if it remains warning-only.

- [ ] **Step 5: Manual viewport acceptance check**

Run:

```powershell
pnpm dev
```

Verify in the browser:

```text
1366×768: all four foundations, stock, waste, and seven tableau columns fully visible.
1920×1080: cards visibly larger than at 1366×768; board uses the viewport without cropping the top row.
2560×1440: cards remain at or below 180×251.67 logical pixels; no raster upscale beyond 216×302.
Ultrawide: tableau gaps stop growing; composition remains coherent and centered.
Resize during a deal: current party/seed/history do not reset.
Resize during drag: drag cancels and cards snap to legal recalculated placement without committing a move.
Auto-foundation A→2→3: lower ranks remain visible beneath the incoming card.
DOM menu: backdrop fills viewport and panel remains centered.
Top HUD buttons: remain pinned to viewport top-right.
Browser page: no horizontal or vertical scrollbar.
```

- [ ] **Step 6: Commit docs and final verification checkpoint**

```powershell
git add README.md PROJECT.md CURRENT_STATE.md TECH.md TREE.txt docs/superpowers/specs/2026-09-03-responsive-fullscreen-layout-design.md docs/superpowers/plans/2026-09-03-responsive-fullscreen-layout.md
git commit -m "docs: describe responsive fullscreen layout"
```

