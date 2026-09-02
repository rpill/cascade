# Sawayama game modes and faithful dealing

## Goal

Make ordinary games follow the reverse-engineered Zachtronics Sawayama logic,
and add a second mode that only serves deals proven winnable. The player chooses
the mode from a menu. Restart must always reproduce the current opening exactly;
New Game must return to the mode menu and create a different deal after a mode is
selected.

## Reverse-engineered source of truth

The authoritative reference is the local decompilation in:

- `D:/Games/The Zachtronics Solitaire Collection Sources/Hikone/GameScreen.cs`
- `D:/Games/The Zachtronics Solitaire Collection Sources/Utility.cs`
- `D:/Games/The Zachtronics Solitaire Collection Sources/--q4VhbmfrkBEsMDuTzInE1Yg--.cs`

The relevant behavior is:

1. Build the deck in suit order `clubs, diamonds, hearts, spades`, ranks Ace
   through King.
2. Shuffle in place using Fisher-Yates and the game's 64-bit `xorshift128+`
   generator. The generator seeds both state words with the game's 64-bit mixing
   function. Integer selection uses modulo, matching the original implementation.
3. Deal from the end of the shuffled list, row by row from left to right, producing
   columns of one through seven cards.
4. Reject and reshuffle while any exposed tableau card is an Ace, or while any two
   exposed cards are adjacent ranks of opposite colours. Rejected attempts keep
   the same evolving RNG and reshuffle the already shuffled list, as in the source.
5. When drawing three cards, the third card would normally become the accessible
   waste card. Test only that card. If it cannot immediately move onto a non-empty
   tableau column or a foundation, swap the first and third cards before placing
   the batch on the waste. Empty tableau columns are deliberately not part of this
   test. This is a forced rule, not a player choice.

The current implementation matches the opening predicate but differs in two
important ways: it uses Mulberry32, and its draw-three adjustment examines all
three cards rather than only the card that would be exposed. The latter can bury
the playable first card and explains premature dead ends.

## Domain model

Introduce `GameMode = 'original' | 'winnable'` and retain a canonical 64-bit deal
seed as a `bigint`. A deal contains both its seed and mode. The current game
session owns these values so a restart can reconstruct the same opening without
asking the generator for new entropy.

The deal module will expose:

- the exact 64-bit RNG implementation;
- faithful original deal creation from a seed;
- random seed creation using browser cryptographic entropy, with a time/random
  fallback;
- selection of a proven seed for winnable mode;
- one entry point that creates a deal for a requested mode.

`SolitaireGame.draw()` will implement the reverse-engineered draw-three ordering.
The placement check used by this rule will be separate from general move checking
because the original intentionally ignores empty tableau columns here.

## Guaranteed-winnable pool

Do not run an exhaustive solver in the browser. Add an offline native C++ tool,
adapted to this project's exact rules, and ship only its generated compact seed
pool.

The solver must model:

- the exact original deal RNG, in-place retries, opening filter, and deal order;
- legal tableau runs, any-card empty-column moves, foundations, the single-pass
  stock, and the late free cell;
- the forced original draw-three swap;
- automatic safe foundation moves as a completeness-preserving reduction, while
  keeping unsafe manual foundation moves as optional branches;
- canonicalized tableau columns and a transposition table.

Only seeds for which the solver finds a complete path to all four Kings may enter
the pool. `UNDETERMINED` seeds that hit a search budget are excluded along with
proven losses. The generated TypeScript file records the scan range, node budget,
and number of accepted seeds so the artifact is auditable and reproducible.

The application randomly chooses among these proven seeds in `winnable` mode.
It never silently falls back to an unverified random deal. An empty or malformed
pool is treated as a development error.

## Menu and controls

On first launch, show a modal menu over the board background with two choices:

- `ОРИГИНАЛЬНЫЙ` — exact Zachtronics dealing behavior; rare unwinnable games are
  possible.
- `ГАРАНТИРОВАННО РЕШАЕМЫЙ` — only solver-proven deals.

After selection, deal and animate the cards normally. The board has two separate
buttons in the upper-right area:

- `НОВАЯ ИГРА  N` opens the mode menu without immediately discarding the visible
  game. Selecting a mode then destroys the old board and starts a new deal.
- `РЕСТАРТ  R` immediately reconstructs the current seed and mode.

If a game is already active, Escape closes the mode menu and returns to it. On
initial launch there is no game to return to, so the player must choose a mode.
The modal blocks card input and board controls beneath it.

## State transitions

1. Launch -> mode menu -> select mode -> new seed -> deal.
2. Restart/button `R` -> keep mode and seed -> rebuild identical deal.
3. New Game/button `N` -> mode menu -> select mode -> new seed distinct from the
   current seed -> deal.
4. Selecting winnable mode -> pick a different seed from the proven pool when the
   pool has more than one entry.

No progress persistence or saved-game migration is included in this change.

## Testing

Use TDD for each behavior:

1. Fixed RNG vectors and a fixed-seed deal fixture catch changes to the original
   PRNG, shuffle direction, deal direction, retry behavior, or suit order.
2. Opening-filter tests cover exposed Aces, compatible opposite-colour pairs, and
   an accepted opening.
3. A draw-three regression fixture has a playable first card and an unplayable
   third card; it must expose the first card after the original swap. Additional
   fixtures cover a playable third card and confirm empty columns do not suppress
   the swap.
4. Mode-selection tests verify original mode uses arbitrary fresh seeds, winnable
   mode selects only pool members, New Game changes the seed, and Restart preserves
   both seed and opening.
5. Run the offline solver to generate and validate the shipped pool, then run the
   complete TypeScript tests and production build.
6. In a browser, verify initial menu input blocking, both mode choices, both
   buttons, `N`, `R`, Escape, and responsive placement at the supported canvas
   size.

## Non-goals

- Guaranteeing that a human will find the solver's winning line.
- Showing hints or the solution path.
- Changing tableau, foundation, free-cell, or auto-mover rules beyond correcting
  proven differences from the reverse-engineered original.
- Reproducing an original Zachtronics deal by wall-clock time alone; exact
  reproduction is defined by the stored 64-bit seed.
