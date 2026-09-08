# Cascade Solitaire — Walnut Table Polish Design

**Date:** 2026-09-07  
**Status:** Approved working design  
**Scope:** Polish the current/default `walnut_study` gameplay table without changing gameplay geometry, card faces, rules, input, or responsive layout.

## 1. Purpose

The current gameplay screen is structurally correct, but the Walnut Study visual presentation still feels unfinished.

This phase does **not** redesign the board. It polishes the **existing real gameplay screen** in-place.

The canonical reference is the current runtime layout/screenshot supplied by the user. Card sizes, positions, tableau spacing, foundation positions, stock/waste positions, HUD position and responsive behavior are structurally locked.

Generated full-screen mockups are not implementation references if they alter geometry. Visual decisions must be validated in the real runtime.

## 2. Exact visual task

Only these four areas are in scope:

1. **Wooden board/background**
2. **Gameplay placeholders / frames / slot icons**
3. **Top-right gameplay buttons**
4. **Visible current-mode label: Standard / Classic / Daily**

Everything else stays as it is unless the user explicitly opens a new design task.

## 3. Hard geometry lock

This phase must not change:

- card width or height;
- card aspect ratio;
- tableau column x/y positions;
- tableau fan spacing;
- foundation coordinates;
- stock/waste/free-cell coordinates;
- HUD control location;
- control hit-area size;
- control order;
- board margins;
- responsive `ViewportLayout`;
- camera/zoom;
- move hit testing;
- drag/drop thresholds;
- gameplay rules;
- face-card art;
- card-face texture keys.

A visual polish must never be achieved by moving, scaling, or reflowing gameplay.

## 4. Board surface

The table remains **dark natural wood**.

Desired direction:

- richer, more premium walnut/mahogany feel;
- visible natural grain and depth;
- restrained contrast so cards remain dominant;
- no green felt;
- no casino-felt replacement;
- no heavy vignette;
- no artificial outer decorative frame;
- no random suit ornaments;
- no medallions, flourishes, corner crests, or decorative dividers;
- no long decorative line above the tableau unless a later runtime review explicitly proves it useful.

The board must feel like a real wooden playing table, not a flat background image and not a decorated poster.

## 5. Placeholder system

All empty gameplay locations must use **one coherent frame language**.

### 5.1 Shared frame

The frame is a single reusable runtime visual treatment, not a separate independently designed bitmap for every suit.

Direction:

- thin muted brass / warm bronze;
- low contrast;
- continuous frame;
- clean corners;
- no short protruding sticks;
- no broken T-shaped corner marks;
- no unrelated ornamental flourishes;
- frame recedes behind cards.

### 5.2 Foundation slots

Foundation slots use the shared frame plus the relevant centered suit symbol:

- Clubs
- Diamonds
- Hearts
- Spades

Black suits use muted warm brass/ivory.
Red suits may use restrained muted red for semantic recognition.

### 5.3 Empty tableau slot

When a tableau column becomes empty, the player must still see a clear card-sized destination.

It uses the shared frame **without an icon**.

It must be visually obvious that a card can be placed there, but quieter than an actual card.

### 5.4 Stock / free-cell placeholder

The stock/free-cell location needs a clearer affordance than the current single downward arrow.

The current arrow is rejected as too ambiguous.

Use the shared frame plus a simple, immediately readable **card-placement glyph** inspired by the original reference:

- a small card rectangle;
- a downward placement arrow beneath/into it;
- strong silhouette at gameplay size;
- no extra ornament;
- no text.

When the location is an ordinary empty card slot state that does not need this affordance, show the shared frame without the placement glyph.

## 6. Gameplay controls

Keep exactly the current top-right position, order, size/hit areas and actions.

Only the visual skin and the unreadable New Game glyph are changed.

Direction:

- coherent with dark wood;
- dark wood / warm ivory / muted brass;
- restrained shadow;
- readable at small size;
- no glossy mobile-app look;
- no excessive bevel;
- no large decorative frame.

### New Game icon

The current New Game icon is rejected as visually noisy/unreadable.

Replace it with a simple unambiguous symbol, preferably:

- one card outline + small plus sign,

or another equally simple card/new-deal glyph.

Undo, Restart and Home may keep their current semantic shapes if they remain readable after visual restyling.

## 7. Current-mode label

Gameplay must visibly state the active mode:

- `STANDARD`
- `CLASSIC`
- `DAILY`

Requirements:

- always visible while the gameplay HUD is visible;
- compact;
- visually part of the same Walnut UI language;
- does not move cards or reserve new board geometry;
- does not overlap controls or cards at supported viewport sizes;
- not a large banner;
- no extra explanatory text.

The existing `GameMode` value is the source of truth.

## 8. Theme-system boundary

`walnut_study` remains the default/fallback theme.

Do not scatter `if (theme === 'walnut_study')` branches through gameplay code.

Use the existing theme/runtime and shared UI token boundaries where possible.

This phase may extend cosmetic theme tokens if required, but must not make layout theme-specific.

## 9. Implementation rule

Do **not** generate another full gameplay screenshot and use it as an asset.

Work in the real project:

- replace/refine the actual wood asset;
- tune runtime placeholder drawing;
- refine the actual DOM gameplay controls;
- add the real mode label;
- run the game;
- compare screenshots from the real runtime.

Full-screen image generation may be used only as loose visual exploration, never as a geometry source.

## 10. Acceptance criteria

The phase is accepted when:

1. The same deal before/after has identical card scale and coordinates.
2. The dark wooden table is visibly more polished without becoming distracting.
3. There is no decorative outer frame.
4. There is no unnecessary long decorative line above the tableau.
5. Foundation slots share one clean frame treatment and retain readable suit identity.
6. Empty tableau columns visibly expose a card-sized drop location with no center icon.
7. The stock/free-cell placement state has an immediately understandable card-placement glyph rather than a lone ambiguous arrow.
8. Top-right controls remain in the exact current location/order/hit geometry.
9. New Game has a simple readable icon.
10. `STANDARD`, `CLASSIC`, or `DAILY` is visible during gameplay.
11. No face cards, mechanics, input, layout, responsive geometry or card sizing change.
12. Desktop and compact landscape remain valid.
13. Automated tests and build pass.
14. Final visual review is performed from a **real runtime screenshot**, not a generated mockup.
