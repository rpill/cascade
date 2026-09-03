# Responsive Fullscreen Layout — Design

Date: 2026-09-03

## Goal

Replace the temporary camera-fit desktop solution with a true responsive fullscreen board layout.

The Phaser canvas must always match the browser viewport. Gameplay objects must be laid out directly in viewport coordinates. Responsive behavior must not depend on camera zoom or camera scroll.

The result should feel like a native browser solitaire game on common desktop displays while preserving the current gameplay, drag feel, animation behavior, DOM UI, and card assets.

## User-approved behavior

- Use a hybrid desktop layout.
- Cards grow moderately as the viewport grows, up to a comfortable maximum.
- Extra horizontal space after card growth is used for spacing between gameplay zones and tableau columns.
- On ultrawide displays, cards and gaps stop growing at their maxima and the complete board composition is centered instead of stretching from edge to edge.
- On smaller desktop windows, cards and gaps shrink so the complete board remains visible without page scrolling.
- A separate mobile layout is explicitly out of scope for this pass.
- The browser page itself must never scroll during gameplay.

## Rendering architecture

Keep `Phaser.Scale.RESIZE`.

The rendering contract becomes:

```text
canvas width  = viewport width
canvas height = viewport height
camera zoom   = 1
camera scroll = 0
```

`ResponsiveViewport.ts` and the authored-board camera fitting model are removed.

`1152×768` is no longer a virtual board that gets enlarged by the camera. It may remain only as a historical/reference size for tuning the preferred desktop composition if useful, but gameplay coordinates are generated from the current viewport.

## LayoutMetrics

Introduce one pure responsive-layout module, tentatively `src/game/view/LayoutMetrics.ts`.

It receives the current viewport size and returns all geometry required by the board renderer and interaction system.

Conceptually:

```ts
interface LayoutMetrics {
  viewportWidth: number;
  viewportHeight: number;

  cardWidth: number;
  cardHeight: number;

  foundationX: number;
  foundationY: readonly number[];

  stock: Point;
  waste: Point;

  tableauX: readonly number[];
  tableauY: number;

  tableauGap: number;
  wasteGap: number;

  boardBounds: RectangleLike;
}
```

Exact names may differ during implementation, but there must be one source of truth for responsive board geometry.

No Phaser objects are created by the calculator. It must be pure and unit-testable.

## Desktop sizing model

The layout calculator uses constrained sizing rather than one global proportional scale.

### Card size

Card aspect ratio remains the current runtime ratio:

```text
108 : 151
```

Card width is derived from available viewport dimensions and clamped between desktop minimum, preferred, and maximum values.

The exact tuning constants are implementation details and may be adjusted visually, but they must satisfy these rules:

- 1366×768 remains comfortable and fully visible.
- 1920×1080 uses visibly larger cards than 1366×768.
- 2560×1440 may grow further but must not enlarge the current 216×302 raster cards beyond their native 2× reserve.
- Once the maximum card size is reached, larger viewports increase breathing room rather than card size.

### Horizontal composition

The board is composed of two logical regions:

1. a left utility region containing the four foundations vertically;
2. the main play region containing stock/waste above and seven tableau columns below.

The seven tableau columns distribute through the main play region with a constrained gap.

The gap grows only until a comfortable maximum. The foundation utility region remains attached to the left viewport edge. If the remaining play region is still wider after card and gap maxima are reached, the tableau composition is centered inside that right-side region rather than moving the foundation rail away from the edge.

This prevents ordinary widescreen layouts from creating a dead strip on the left while still keeping ultrawide tableau spacing visually connected.

### Vertical composition

The top gameplay row must always remain fully visible.

The tableau begins below stock/waste with a responsive but constrained vertical gap.

Foundation slots are distributed vertically within the safe gameplay height so all four slots remain visible.

Long tableau piles continue using compressed vertical overlap when required. The available overlap calculation must use the actual viewport height and current card height rather than the old fixed `GAME_HEIGHT`.

## BoardView integration

`BoardView` currently imports global constants such as `CARD_WIDTH`, `STOCK_X`, `TABLEAU_X`, and `FOUNDATION_X`. These usages will be replaced with instance layout metrics.

`BoardView` owns the current `LayoutMetrics` value.

On construction it receives or calculates metrics for the current viewport before creating board objects.

All board geometry must use those metrics:

- board surface;
- slot rectangles;
- foundation suit symbols;
- stock backs;
- card display size;
- initial-deal flight origin;
- waste placement;
- tableau placement;
- foundation placement;
- free-cell placement;
- drag/drop rectangles and target centers.

The model and game rules remain unaware of layout metrics.

## Resize lifecycle

`GameScene` continues listening to `Phaser.Scale.Events.RESIZE`.

On resize:

1. camera remains at zoom 1 and scroll 0;
2. calculate new `LayoutMetrics` from the new viewport;
3. pass the metrics to the existing `BoardView`;
4. reposition and resize existing board objects;
5. do not recreate `SolitaireGame`;
6. do not create an undo/history entry;
7. do not restart the deal or initial-deal animation.

If a resize occurs while a non-drag card flight is active, the board may settle/rebase that visual movement onto the new layout rather than trying to preserve the exact old Bezier path. Correct final state and stable interaction are more important than preserving an in-progress cosmetic trajectory across a browser resize.

Resize during an active manual drag should not commit a move automatically. The safest implementation may cancel the drag and snap cards to their recalculated legal placement.

## Drag/drop behavior

The current overlap-area commitment behavior is preserved.

Drop geometry must use the current responsive card width and height and current responsive target rectangles.

The gameplay rule remains:

- shallow edge/corner grazing is rejected;
- roughly one quarter overlap is accepted;
- accepted manual drags snap immediately to the destination;
- rejected/cancelled manual drags snap immediately back;
- no settle tween is added to manual drag resolution.

Responsive layout tests must not freeze exact cosmetic coordinates.

## Card rendering quality

Runtime card sources remain the stable 216×302 PNG assets.

Cards are displayed at responsive sizes, but the desktop maximum must not exceed 216×302 logical display pixels while those textures are current. This guarantees no raster upscaling beyond native texture resolution.

Normal antialiasing and subpixel movement remain enabled.

Runtime SVG card loading is not reintroduced.

## Foundation rendering and animation

The recently fixed foundation behavior is preserved.

Every collected card in a suit remains placed at the same foundation coordinates with increasing depth. When the next rank flies in, the previous rank remains visible beneath it.

Responsive resize changes the shared foundation coordinates but must not revert to rendering only the top foundation card.

## DOM UI

The native DOM HUD controls and main menu remain screen-space elements attached directly to the game host.

They do not participate in `LayoutMetrics` and do not inherit Phaser camera transforms.

- game controls stay anchored to the top-right viewport edge;
- main menu backdrop fills the viewport;
- main menu panel stays centered;
- resizing the Phaser board must not shift or scale DOM UI.

## Background

The gameplay background/surface must cover the entire Phaser viewport.

There must be no visible outer strip that looks like a separate page background around a smaller authored board.

If the current procedural/static board texture cannot naturally cover arbitrary sizes, the renderer may stretch or tile only the non-semantic background surface. Gameplay card/slot geometry must still come from `LayoutMetrics` and must not be globally stretched.

## Testing strategy

Tests protect behavior and layout invariants rather than exact visual coordinates.

Add pure layout tests for representative viewports such as:

- 1366×768;
- 1920×1080;
- 2560×1440;
- a small desktop window;
- an ultrawide viewport.

Tests should verify properties such as:

- all seven tableau columns fit inside the viewport;
- all four foundation slots fit inside the viewport;
- stock and waste fit inside the viewport;
- card aspect ratio is preserved;
- card size stays within desktop min/max bounds;
- larger ordinary desktop viewports produce cards no smaller than smaller ones;
- ultrawide extra space does not force gaps beyond their maximum;
- long-tableau vertical placement stays within available height as far as the existing compression rule allows;
- camera zoom remains 1 and camera scroll remains 0;
- DOM UI remains screen-space;
- existing drop-threshold and foundation-visibility tests remain valid.

Do not assert exact CSS colors, exact final pixel coordinates for every viewport, or card artwork bytes.

## Migration scope

Expected production changes are focused around:

- `src/game/view/layout.ts` — replace fixed gameplay geometry or reduce it to generic types/constants;
- new pure responsive layout calculator;
- `src/game/view/BoardView.ts` — consume instance metrics and support relayout;
- `src/game/scenes/GameScene.ts` — remove camera-fit behavior and forward resize events;
- board/background texture presentation if needed for viewport coverage;
- responsive-layout tests;
- project context/docs after implementation.

`SolitaireGame`, deal generation, undo model, solver behavior, game-flow behavior, and card asset pipeline are out of scope.

## Acceptance criteria

The refactor is complete when all of the following are true:

1. Browser canvas fills the viewport with no page scrolling.
2. Phaser camera stays at zoom 1 and scroll 0.
3. On 1920×1080 the full top row, foundations, stock/waste, and tableau are visible and comfortably use the screen.
4. Cards are moderately larger than on a 1366×768 viewport, without exceeding native 216×302 texture resolution.
5. On ultrawide displays the board remains a coherent centered composition instead of stretching excessively.
6. Resizing the browser relays out the current game without restarting it or altering model/history state.
7. DOM menu/HUD remain correctly anchored to the viewport.
8. Drag/drop commitment feels unchanged.
9. Manual drag snap behavior remains unchanged.
10. Foundation A→2→3 animation keeps previous ranks visible underneath incoming cards.
11. Existing gameplay tests stay green, and new responsive-layout invariants are covered by tests.
