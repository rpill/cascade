# Cascade Solitaire — Responsive Board, Mobile Landscape & HUD Design

**Date:** 2026-09-05  
**Status:** Approved design  
**Scope:** Desktop + tablet/mobile landscape responsive gameplay/UI redesign, with an isolated startup/F5 stability prerequisite  
**Out of scope:** Portrait gameplay, new art pack, monetization, gameplay-rule changes, solver changes, new meta systems

## 1. Purpose

Cascade Solitaire currently has a responsive Phaser board, but the screen is still architected around a desktop-first layout:

- the four foundations occupy a vertical utility rail on the left;
- the stock/waste top row and the native DOM gameplay controls independently consume the same horizontal space;
- `.game-controls` is a fixed-width DOM overlay that the board geometry does not reserve space for;
- the card width floor is tuned for desktop and does not fit low-height landscape phones well;
- compact modal/menu CSS only compresses the existing vertical layout rather than redesigning it for short landscape viewports;
- existing responsive tests start at `960×640`, so realistic landscape-phone viewports are not protected.

The redesign must make desktop and landscape touch devices first-class supported layouts while preserving the current solitaire mechanics, persistence rules, rendering quality, lifecycle integration and native-DOM UI approach.

The central rule is: **UI and board geometry must share one layout contract so important elements can never overlap by accident.**

## 2. Product constraints

### 2.1 Supported orientations

- Desktop remains supported.
- Mobile/tablet gameplay is supported in **landscape only**.
- Portrait gameplay is intentionally unsupported.
- The Yandex Games draft must declare `Landscape` orientation for mobile so the platform can show its rotate-device placeholder in portrait.

### 2.2 No gameplay-rule changes

This phase must not change:

- deal generation;
- stock/draw-three behavior;
- free-cell behavior;
- tableau legality;
- foundation legality;
- auto-foundation safety;
- undo semantics;
- attempt timing semantics;
- Daily identity/progress;
- persistence formats;
- leaderboard rules;
- Yandex lifecycle policy.

### 2.3 No browser scrolling

The main game screen, main menu, statistics, leaderboard and completion overlays must fit their supported viewport without browser-page scrolling.

When content cannot fit vertically, the layout must reorganize or paginate instead of enabling page scroll.

## 3. External acceptance requirements

The design follows these current platform/browser constraints:

- Yandex Games requires interactive elements to adapt to screen size, important elements not to be cut off, texts/buttons/significant game elements not to overlap, and the main game screen not to require scrolling/swiping.
- Yandex moderation explicitly tests resizing and may shrink a nominal 16:9 game area by roughly 20% along each axis.
- Yandex allows a game to declare a single supported orientation and shows a rotate-device placeholder in the unsupported orientation.
- WCAG 2.2 requires pointer targets to be at least 24×24 CSS px or satisfy spacing exceptions; Cascade adopts a stronger internal target of **44×44 CSS px** for primary gameplay controls.
- CSS `env(safe-area-inset-*)` is widely supported and should be used to keep DOM controls away from display cutouts/rounded corners when relevant.

References:

- https://yandex.com/dev/games/doc/en/concepts/requirements
- https://yandex.com/dev/games/doc/en/requirements/1/10
- https://yandex.com/dev/games/doc/en/console/add-new-game/draft
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env

## 4. Phase ordering

Responsive work must not hide the already observed Yandex reload/WebGL failure.

The implementation therefore begins with a separate **Task 0 — startup/F5 stability** before any board/UI redesign.

After Task 0 passes its Yandex Draft reload check, responsive work proceeds in isolated tasks.

## 5. Task 0 design — startup/F5 stability

### 5.1 Observed failure

In the Yandex Draft, repeated ordinary F5 reloads can sometimes fail with Phaser 3.90.0/WebGL reporting:

`Framebuffer status: Incomplete Attachment`

The failure is timing-sensitive:

- one reload may work;
- another immediate reload may fail;
- DevTools can change the behavior;
- Ctrl+F5 can make the next launch succeed.

Phaser has a documented 3.90.0 issue with `WebGL + Phaser.Scale.RESIZE` when the parent is hidden/temporarily unusable:

- https://github.com/phaserjs/phaser/issues/7221

This design treats a transient unusable host size as the first hypothesis to isolate, not as a proven permanent root cause.

### 5.2 Bootstrap contract

`Phaser.Game` must not be constructed until the `#game` host has a usable positive rendered size.

Bootstrap should:

1. resolve the actual `#game` element;
2. observe/measure its rendered bounds;
3. wait until width and height are both positive;
4. create `Phaser.Game` exactly once;
5. seed the Phaser config with the measured host dimensions rather than blindly using `window.innerWidth/innerHeight`.

The helper must be unit-testable without Phaser.

No renderer switch is part of the first fix.

### 5.3 Task 0 acceptance

Automated:

- a zero-sized host does not create the game;
- the first positive host size creates the game exactly once;
- the measured size is forwarded to the game config/bootstrap boundary;
- existing `Phaser.Scale.RESIZE`, antialiasing and non-pixel-art rendering guarantees remain intact.

Manual Yandex Draft:

- DevTools closed;
- at least 10 ordinary F5 reloads in succession;
- then Ctrl+F5;
- then several more ordinary F5 reloads;
- no blank board and no framebuffer crash.

If the exact framebuffer failure remains after this isolated change, stop and investigate the WebGL/Scale.RESIZE boundary separately. A Canvas renderer fallback may then be tested as a second hypothesis, but must not be silently bundled into responsive work.

## 6. One responsive layout contract

The current `LayoutMetrics` should evolve into a complete viewport contract rather than describing only card coordinates.

The implementation may keep the existing filename or introduce `ViewportLayout.ts`, but there must be one pure calculation boundary that owns all screen-space geometry relevant to gameplay.

Conceptually:

```ts
type LayoutProfile = 'standard' | 'compact-landscape';

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ViewportLayout {
  viewportWidth: number;
  viewportHeight: number;
  profile: LayoutProfile;
  safeArea: SafeAreaInsets;
  hudBounds: LayoutBounds;
  boardBounds: LayoutBounds;
  cardWidth: number;
  cardHeight: number;
  stock: LayoutPoint;
  wasteLaneBounds: LayoutBounds;
  foundations: readonly LayoutPoint[];
  tableauX: readonly number[];
  tableauY: number;
  tableauColumnGap: number;
  tableauCardGap: number;
  bottomMargin: number;
}
```

Exact property names may vary during implementation, but the invariants are fixed:

- HUD geometry is explicit;
- board geometry excludes HUD space;
- safe-area insets are explicit;
- waste has a bounded lane rather than unbounded horizontal fan-out;
- foundations are four explicit horizontal positions;
- tableau consumes only board space;
- all coordinates are calculated from the live viewport, not authored screen constants.

## 7. Layout profiles

### 7.1 Standard profile

Used for ordinary desktop/laptop-sized viewports with enough usable height.

Properties:

- card sizing remains moderate and bounded;
- cards never raster-upscale beyond the quality limit already protected by the project;
- tableau columns remain a compact centered group instead of stretching edge-to-edge on ultrawide screens;
- spacing can be more generous than compact mode;
- the board still reserves the HUD strip before placing any cards.

### 7.2 Compact-landscape profile

Used for short landscape viewports such as phones, small tablets, reduced desktop windows and Yandex moderation shrink tests.

Profile selection is based on usable geometry, not user-agent strings.

Compact mode may:

- reduce card width below the old desktop `84 px` floor;
- target roughly the mid-60s CSS px for phone-scale cards when required by height/width constraints;
- reduce inter-zone gaps;
- reduce tableau column gaps;
- compress long tableau vertical exposure more aggressively;
- retain the same logical arrangement as standard mode.

The exact transition threshold should be tested around low-height viewports rather than treated as a cosmetic CSS breakpoint.

## 8. Gameplay screen structure

### 8.1 HUD zone

A permanent native-DOM HUD strip is reserved at the top of the game viewport.

It must:

- live outside Phaser camera transforms;
- respect safe-area top/left/right insets;
- have a fixed/controlled responsive height;
- never overlap cards;
- never be overlapped by cards;
- remain usable on both mouse and touch.

The board begins below `hudBounds`.

### 8.2 Icon-only controls

The current four long text buttons are replaced on both desktop and mobile by icon-first controls:

- Menu;
- New Deal;
- Undo;
- Restart.

Daily continues to omit New Deal.

Each control uses a project-owned inline SVG icon, not emoji/Unicode glyphs, so appearance is stable across Windows/iOS/Android.

Recommended semantic icons:

- Menu: three horizontal lines;
- New Deal: shuffle/crossing-arrows symbol;
- Undo: curved back arrow;
- Restart: circular replay arrow.

Each button must have:

- minimum 44×44 CSS px interactive area;
- `aria-label` with the Russian action name;
- keyboard focus styling;
- mouse/focus tooltip on non-coarse pointers;
- hotkey shown in the tooltip where relevant (`N`, `Z`, `R`, `Esc`/menu behavior as appropriate);
- no dependency on visible text for recognition.

Tooltips must not be required to use the controls on touch devices.

### 8.3 HUD placement

The control group is right-aligned within the safe HUD area on ordinary layouts.

The HUD itself owns its space; it is never layered on top of the top card row.

## 9. Board topology

The current vertical foundation utility rail is removed.

Both standard and compact profiles use the same topology:

```text
HUD
─────────────────────────────────────────────
stock/free-cell | waste lane | ♣ ♦ ♥ ♠ foundations
─────────────────────────────────────────────
          seven tableau columns
```

### 9.1 Stock/free cell

The stock remains one slot in the top gameplay row.

When exhausted, the same logical stock position continues to act as the free-cell location, preserving the current game model behavior.

### 9.2 Foundations

The four foundations become a horizontal group at the right side of the top gameplay row.

Foundation suit identity remains visually clear and all four slots remain fully inside `boardBounds`.

### 9.3 Waste lane

Waste receives an explicit horizontal rectangle between the stock region and foundation group.

`wasteCardX()` must calculate fan spacing from `wasteLaneBounds` only.

Therefore:

- one waste card appears at the lane origin;
- additional visible waste cards fan across the lane when space exists;
- fan spacing compresses as the count grows;
- the final waste card never crosses into the foundation region;
- waste never crosses into HUD space.

This solves the existing Full HD defect where a large waste fan reaches the text-button overlay.

### 9.4 Tableau

The seven tableau columns sit below the complete top gameplay row.

The tableau uses the full board width available after safe-area margins rather than losing a permanent left foundation rail.

On wide screens:

- tableau remains compact and centered;
- extra width increases outer whitespace rather than unlimited column gaps.

On compact landscape:

- card width and column gap shrink to fit all seven columns;
- long piles compress vertically according to actual remaining board height;
- the final card in each column remains inside the board bottom bound.

## 10. Safe-area handling

`index.html` should allow full-viewport safe-area behavior with `viewport-fit=cover` when implementation confirms compatibility with the Yandex container.

DOM UI uses CSS environment insets with zero fallbacks, for example conceptually:

```css
padding-top: max(base-padding, env(safe-area-inset-top, 0px));
padding-right: max(base-padding, env(safe-area-inset-right, 0px));
```

Phaser board geometry receives corresponding numeric insets through a small browser adapter rather than reading CSS environment variables inside pure layout math.

Pure layout tests pass explicit synthetic inset values.

## 11. DOM view responsibility

### 11.1 Extract gameplay controls from `BoardView`

`BoardView` currently creates native DOM buttons itself. Responsive redesign should separate this responsibility into a focused gameplay-controls view (working name `GameControlsView`).

`BoardView` should remain responsible for:

- board surface;
- slots;
- card sprites;
- drag/drop;
- card motion;
- board relayout.

`GameControlsView` should own:

- HUD DOM root;
- buttons/icons;
- tooltips;
- visibility of New Deal for Daily;
- DOM cleanup.

The scene coordinates the actions.

This prevents card-rendering code from accumulating responsive DOM concerns.

### 11.2 Existing modal views remain native DOM

`MainMenuView`, `StatisticsView`, `LeaderboardView`, `DailyCompleteView` and `GameCompleteView` remain native DOM/screen-space UI.

They receive responsive CSS/layout updates rather than being moved into Phaser.

## 12. Compact main menu

The current vertical main-menu stack is not the final short-landscape design.

For compact landscape, the menu becomes a wide two-column composition.

Conceptually:

```text
┌──────────────────────┬──────────────────────┐
│ game modes           │ Daily / weekly       │
│ Standard             │ progress             │
│ Classic              │                      │
│ Daily                │ Statistics           │
│                      │ Leaderboard          │
└──────────────────────┴──────────────────────┘
             Close (when allowed)
```

Requirements:

- no browser scrolling;
- all primary mode actions immediately visible;
- Daily/weekly information remains readable;
- `ЗАКРЫТЬ` remains conditional exactly as today;
- desktop may keep the current more vertical presentation if it fits comfortably;
- compact layout is triggered by usable geometry, not device detection.

## 13. Statistics, leaderboard and completion overlays

### 13.1 Statistics

Compact landscape places Standard and Classic summaries side-by-side where practical rather than stacking them vertically.

### 13.2 Leaderboard

The product contract remains top-10 plus optional personal row.

Compact landscape should preserve top-10 without scrolling by using a two-column ranking presentation when necessary:

- ranks 1–5 in the first column;
- ranks 6–10 in the second column;
- personal row/auth state remains clearly separated.

If implementation measurements show this still cannot fit a supported minimum viewport, pagination is acceptable; browser scrolling is not.

### 13.3 Completion overlays

Daily and ordinary completion overlays switch to compact horizontal grouping for summary/actions on short landscape viewports.

All action buttons remain immediately reachable.

## 14. Touch behavior

Existing drag-and-drop mechanics remain unchanged semantically.

Responsive/touch work must preserve:

- `touch-action: none` for gameplay;
- no long-press browser selection/context menu;
- pointer drag threshold behavior;
- overlap-area drop commitment;
- immediate snap on accepted/rejected manual drags.

Touch hit areas for HUD controls must be at least 44×44 CSS px.

Card hit areas remain the displayed card bounds; no invisible enlarged hitbox may create ambiguous overlapping card targets.

## 15. Rendering quality

The redesign must preserve the current rendering-quality contract:

- real `Phaser.Scale.RESIZE` viewport-sized canvas unless Task 0 proves a renderer/scale workaround is required;
- camera zoom 1 and scroll 0;
- normal antialiasing;
- no global nearest-neighbor/pixel-art filtering;
- current raster card textures must not be displayed above their quality-safe size;
- DOM text remains screen-space browser-rendered text.

Responsive tests must protect geometry/clarity behavior, not exact artwork, colors or image bytes.

## 16. Responsive test matrix

Pure layout tests must include at least the following representative viewports:

### Compact phone / mobile landscape

- `844×390`
- `915×412`
- `932×430`

### Reduced desktop / moderation-style

- `1024×576`
- `960×540`
- `960×640`

### Ordinary desktop

- `1366×768`
- `1920×1080`
- `2560×1440`

### Wide desktop

- `2560×1080`
- `3440×1440`

Tests should also include at least one synthetic safe-area inset case.

## 17. Layout invariants to test

Tests should assert behavior, not permanent pixel coordinates.

For every supported landscape viewport:

1. `hudBounds` is fully inside the viewport safe region.
2. `boardBounds` is fully inside the viewport and begins at or below HUD bottom.
3. No board slot intersects HUD bounds.
4. All four foundation cards fit inside board bounds.
5. Stock/free-cell fits inside board bounds.
6. Waste lane ends before foundation group begins.
7. Every possible waste-card x-position remains inside waste lane.
8. All seven tableau columns fit horizontally.
9. Tableau starts below the top gameplay row.
10. A long representative tableau pile keeps its last card inside the board bottom bound.
11. Card aspect ratio is unchanged.
12. Standard/wide screens keep tableau gaps bounded instead of stretching across the viewport.
13. Compact profile allows cards below the old 84 px desktop floor when necessary.
14. Quality-safe maximum card width is still respected.
15. Safe-area insets shift DOM/board usable geometry rather than clipping it.

DOM/wiring tests should assert:

- gameplay controls are icon-only;
- every button has an accessible label;
- Daily omits New Deal;
- controls no longer have fixed per-action widths;
- gameplay controls live in their own HUD root/view;
- compact CSS has no browser-scroll fallback;
- menu/meta views expose compact layout classes/structure needed by the CSS.

## 18. Manual acceptance matrix

Before declaring the phase complete, verify in a real browser and Yandex Draft:

### Desktop

- 1920×1080 normal browser;
- 1366×768;
- reduced window around 1024×576;
- ultrawide if available;
- browser zoom 80%, 100%, 125% where Yandex requirements call for it.

### Mobile/tablet landscape

Use physical devices when available and DevTools emulation otherwise:

- approximately 844×390;
- approximately 915×412;
- at least one tablet landscape size;
- one notched/safe-area simulation if tooling permits.

Verify:

- no controls/cards/text are cut off;
- no waste/foundation/HUD overlap;
- all seven columns are immediately accessible;
- no browser page scroll/swipe-to-refresh;
- HUD buttons are comfortably tappable;
- drag/drop remains reliable;
- main menu and all modal/result views fit without browser scrolling;
- rotating to portrait yields the platform rotate-device experience rather than a broken in-game portrait layout.

### Yandex moderation-style resize

Start from a 16:9 desktop area and reduce both axes by about 20%; layout must remain valid throughout the resize.

## 19. Implementation sequencing

The implementation is intentionally split so regressions are attributable:

1. **Task 0 — Yandex F5/startup stability**
2. **Task 1 — pure viewport layout contract + expanded responsive test matrix**
3. **Task 2 — board topology migration: horizontal foundations, bounded waste lane, full-width tableau**
4. **Task 3 — extracted icon-only gameplay HUD, tooltips, accessibility and touch targets**
5. **Task 4 — compact landscape + safe-area integration**
6. **Task 5 — compact main menu/statistics/leaderboard/completion overlays**
7. **Task 6 — truth docs + final responsive/Yandex acceptance checklist**

Each implementation task should be independently testable and committed before proceeding to the next one.

## 20. Success criteria

The phase is successful when all of the following are true:

1. Repeated Yandex Draft reloads no longer reproduce the known blank framebuffer startup failure, or the isolated Task 0 investigation has identified and implemented a separately verified renderer/scale workaround.
2. Desktop gameplay has no overlap between waste/cards and gameplay controls.
3. Landscape phone/tablet gameplay is fully usable with all seven tableau columns visible immediately.
4. Portrait is intentionally unsupported and delegated to the platform rotation prompt.
5. Cards, HUD, foundations, waste and tableau derive from one responsive geometry contract.
6. The gameplay HUD is compact, icon-only, accessible and touch-friendly on both desktop and mobile.
7. Waste fan-out is bounded and cannot intrude into foundations/HUD.
8. Main menu, statistics, leaderboard and result overlays fit supported short landscape viewports without browser scrolling.
9. Safe-area insets cannot hide critical DOM controls.
10. Existing solitaire rules, persistence, statistics, Daily, leaderboards and Yandex gameplay lifecycle behavior remain unchanged.
11. Automated tests cover realistic mobile landscape sizes, reduced desktop sizes and wide desktop sizes without freezing cosmetic pixel positions.
12. Real Yandex Draft verification passes repeated reload, resize and landscape mobile acceptance checks.
