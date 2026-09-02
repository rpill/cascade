# Curved motion, safer drops, undo, and main menu

## Goal

Improve card readability and movement, prevent accidental edge drops, add
single-action undo, and move deal-mode selection out of the New Game flow into
a proper main menu.

## Scope and source assets

Use the 52 face-card PNGs from `Decks/Horizontal2/pngs` as the in-game deck.
Copy them into `public/assets/cards` under their existing filenames so the
current texture keys remain stable. `redBack.png` is already byte-identical
between the two folders and may remain unchanged.

The source images are 75×113. Keep the current rendered card size for this
change; switching the artwork must not alter hit targets or column spacing.
Raise the tableau start by 24 pixels, from `TABLEAU_Y = 260` to
`TABLEAU_Y = 236`. Verify at the supported 1152×768 canvas size that the bottom
of long columns remains visible. Keep the stock at its current raised position.

Remove the empty waste-slot rectangle immediately to the right of the stock.
The waste cards themselves still appear there after drawing.

## Curved card motion

Centralize non-drag card positioning in a small animation helper. The helper
interpolates from start to target along a quadratic Bézier curve. Its control
point is the segment midpoint offset along a consistently upward-facing
perpendicular so the midpoint sits 18 pixels away from the straight path. This
also gives vertical foundation flights visible horizontal curvature. The arc
must communicate a physical card flight without causing large detours or cards
leaving the board.

Use the helper for:

- the initial deal from the stock;
- three-card draws from stock to waste;
- player moves and rejected-drag returns;
- manual and automatic moves to foundations;
- undo settling.

The helper must preserve the existing duration categories and depth rules. A
card remains above resting cards for the complete flight and receives its final
resting depth only after the arc finishes. Delays for the three-card fan remain
staggered.

Expose the curve calculation as a pure function so tests can assert endpoints,
midpoint curvature, and finite coordinates independently of Phaser.

## Committed drop zone

Replace the current large intersection-based tableau target with a committed
card drop test.

For a non-empty tableau column, use the visible top card as the target rectangle.
For an empty tableau column, use the empty tableau slot. A drop is accepted only
when the center of the dragged root card lies within an inset inner region of
that target. The inner region is inset by 18 pixels on every side. The inset
rejects edge-only overlaps while keeping deliberate
centered drops comfortable.

Foundation and free-cell drops use the same committed-center rule against their
slots. Legal card rules are still checked by `SolitaireGame.canMove`; geometry
cannot make an illegal move valid.

Keep the geometry predicate pure and test:

- a centered card is accepted;
- a card touching only the left, right, top, or bottom edge is rejected;
- an otherwise committed drop still requires a legal game move;
- candidates continue to resolve by nearest target when more than one is valid.

## Undo transaction model

Add model-level snapshots containing every mutable gameplay field:

- tableau columns and card order;
- stock and waste order;
- all four foundations;
- free-cell contents.

Seed and mode do not change during undo. The current `SolitaireGame` instance
can restore a snapshot so `BoardView` can reuse the existing image objects.

Add a focused history controller. Before a player action, capture a snapshot.
Commit it only if the action changes game state. Automatic foundation moves
caused by that action remain in the same transaction, because the stored state
predates the player action and the complete automatic chain. One undo therefore
reverses:

- one successful drag move plus its automatic chain;
- one double-click foundation move plus its automatic chain;
- one stock click, the full drawn batch, and its automatic chain.

Rejected drops and empty-stock clicks create no history entry. Undo is disabled
while card animation or an automatic chain is active. After restoring a
snapshot, cards settle along the same shallow arc and no new automatic chain is
started. Restart and committing a new deal through either New Game or the main
menu clear the history. Merely opening and cancelling the main menu does not.

Provide `ОТМЕНА  Z` on the board and keyboard shortcut `Z`. The action is a
no-op when history is empty.

## Main menu and game flow

Replace the current mode prompt semantics with an explicit main menu state.

The main menu contains:

- the two existing mode descriptions;
- a persistent mode selection;
- an `ИГРАТЬ` button.

On first launch no game exists and the player must select a mode before playing.
Once selected, remember that mode for the session. When the menu is opened from
an active game, preselect the current mode and keep the existing board intact
behind the modal until `ИГРАТЬ` is pressed.

Board controls become:

- `В МЕНЮ` — open the main menu;
- `НОВАЯ ИГРА  N` — immediately start a different seed in the current mode;
- `ОТМЕНА  Z` — undo the last complete player action;
- `РЕСТАРТ  R` — restart the current seed and mode.

Escape closes the main menu only when there is an active game to return to. A
mode change has no effect until `ИГРАТЬ` is pressed. Starting through `ИГРАТЬ`
or `НОВАЯ ИГРА` destroys the previous board, starts the normal deal animation,
and clears undo history.

The main-menu overlay blocks pointer and gameplay keyboard input beneath it.
`N`, `Z`, and `R` do nothing while the menu is visible.

## State transitions

1. Launch → main menu without selection → select mode → `ИГРАТЬ` → new deal.
2. Playing → `НОВАЯ ИГРА`/`N` → new seed in current mode → deal.
3. Playing → `В МЕНЮ` → menu with current mode selected.
4. Menu with active game → Escape → unchanged active game.
5. Menu with active game → choose mode → `ИГРАТЬ` → new deal in chosen mode.
6. Playing → `РЕСТАРТ`/`R` → same seed and mode, empty undo history.
7. Playing → player action plus automatic chain → `ОТМЕНА`/`Z` → state before
   that complete action.

## Testing and verification

Use TDD for each behavior:

1. Pure arc tests verify exact start/end points and a non-linear midpoint.
2. Asset tests verify all 52 Horizontal2 face files are present under the
   runtime path and representative files match their sources.
3. Layout tests verify the raised tableau remains on-screen at maximum pile
   height and no waste placeholder is created.
4. Pure drop-geometry tests cover centered and edge-only placements.
5. Snapshot/history tests cover draw, drag, double-click, automatic chains,
   failed actions, repeated undo, and history clearing.
6. Flow tests cover remembered mode, direct New Game, menu return/cancel, mode
   change only on Play, and disabled gameplay shortcuts in the menu.
7. Run all Node tests and the production build.
8. In a browser, verify both card artwork and suit readability, the raised
   tableau, absent waste rectangle, shallow arcs, rejected edge drops, all four
   controls, undo of an action with automatic moves, and the full menu flow.

## Non-goals

- Redo or multi-branch history.
- Saving undo history across reloads.
- Changing legal solitaire moves, deal generation, solver behavior, or the
  solver-proven seed pool.
- Changing the card back or card dimensions.
- Adding settings persistence beyond the current browser session.
