# Cascade Solitaire — Project Contract

## Purpose

Cascade Solitaire is a Phaser/Web solitaire project for Yandex Games. The core
rules intentionally reproduce Sawayama Solitaire / the reverse-engineered Hikone
implementation, while naming, UI, art, presentation, progression and surrounding
product decisions are our own.

## Authority

1. Code and tests are the factual current implementation.
2. `PROJECT.md` is the stable gameplay/product contract.
3. `CURRENT_STATE.md` is the concise implementation snapshot and next focus.
4. `TECH.md` contains architecture and development constraints.
5. `TREE.txt` is generated structure for ChatGPT handoff.
6. `docs/superpowers/**` records approved historical specs/plans, but current code
   wins when an old plan no longer matches implementation.
7. `docs/archive/**`, if added later, is historical only.

## Stable gameplay contract

- Seven tableau piles are dealt 1..7 cards.
- Tableau stacking is descending and alternating colour.
- Ordered descending alternating-colour runs can be moved together.
- Foundations build by suit from Ace to King.
- The stock is drawn in batches of up to three using the original Hikone order rule.
- Empty stock becomes the free cell.
- Safe cards may automatically move to foundations.
- Original mode preserves the reverse-engineered RNG/deal behavior and may produce
  rare unsolvable games, matching the source behavior.
- Winnable mode selects only from the solver-proven seed pool.
- Restart keeps the same seed and mode.

## Game flow contract

- First launch opens the main menu.
- The deal mode is selected in the main menu, not from the New Game action.
- `ИГРАТЬ` applies the pending menu mode and starts a deal.
- `НОВАЯ ИГРА` / `N` immediately starts a fresh seed in the active mode.
- `В МЕНЮ` returns to mode selection while preserving the current board behind it.
- `Esc` closes the menu only when an active board exists.
- `N`, `Z` and `R` do nothing while the menu is open.

## Undo contract

Undo is transactional: one undo returns to the state before the player's successful
action and also reverts the complete automatic foundation chain caused by that action.
Failed moves and empty-stock clicks create no history entry. Undo never starts a new
auto-foundation chain after restore.

## Input feel contract

Drag-and-drop must avoid both extremes:

- merely grazing a target edge must not accidentally commit a move;
- a player must not need to drag the card close to the target center either.
- every manual drag resolves immediately with no settle tween: accepted drags snap to the destination, while rejected/cancelled drags snap back to the original placement.

The current implementation uses overlap-based commitment in `DropGeometry.ts`: roughly
25% of the moving card must overlap the target. This threshold is interaction tuning, not
a sacred game rule, and may be adjusted from playtesting without changing solitaire mechanics.

## Rendering quality contract

- Gameplay coordinates and layout remain resolution-independent logical pixels.
- Normal antialiasing and subpixel motion stay enabled; do not switch the whole game to pixel-art filtering to mask blurry assets.
- Desktop rendering must not upscale the entire logical canvas through CSS when the viewport is already large enough; preserve 1:1 canvas display where possible.
- Phaser Text may use a higher internal texture resolution for clarity without changing logical layout coordinates.
- Card runtime assets should have enough raster resolution for their displayed size. The current Horizontal2 implementation uses 216×302 PNG textures for a logical 108×151 card and does not depend on runtime SVG rasterization.
- Rendering-quality tests protect these technical guarantees, not exact artwork bytes, colours or a permanent card pack.

