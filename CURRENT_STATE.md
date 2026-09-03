# Cascade Solitaire — Current State

## Stack

- TypeScript
- Phaser `^3.90.0`
- Vite `^7.1.3`
- pnpm
- Node built-in test runner
- offline C++20 solver for generating/verifying the winnable seed pool

## Implemented gameplay

- Sawayama/Hikone deal and stock behavior.
- Seven tableau piles with descending alternating-colour stacking and run moves.
- Four suit foundations and safe automatic foundation moves.
- Free cell appears when the stock is exhausted.
- Original and solver-proven Winnable deal modes.
- Restart preserves mode and seed.
- Transactional undo (`Z` / `ОТМЕНА`) including subsequent auto-foundation moves.
- Persistent main menu; New Game no longer asks for a deal mode.
- `В МЕНЮ`, `N`, `Z`, `R`, and `Esc` controls are wired.

## Current visual/input state

- Runtime card faces are the `Horizontal2` set in `public/assets/cards`.
- Tableau begins at `TABLEAU_Y = 236` so suits remain easier to read.
- The old empty waste placeholder rectangle is removed.
- Non-drag moves use shallow quadratic Bézier flights.
- Drop commitment uses an **overlap-area threshold**: roughly 25% of the moving card
  must overlap the visible target. Edge grazing and corner touches are rejected, while
  a clearly overlapping card no longer needs to have its center inside the target.
- Manual drag-and-drop has no settle tween in either direction: accepted drags snap directly into the destination, while rejected/cancelled drags snap immediately back to the previous placement.

## ChatGPT handoff workflow

The project now uses the same Git-based handoff pattern as the other active projects.

```bash
pnpm context
pnpm context:last
```

- `pnpm context` describes the current working tree, including uncommitted/untracked
  non-ignored changes.
- `pnpm context:last` describes files changed by the latest commit and is intended
  for a clean checkpoint handoff.
- Both refresh `TREE.txt` first.
- Bundles are written to `_chatgpt_bundle/CHATGPT_CONTEXT.txt` and each generation replaces the previous bundle.
- `PROJECT.md`, `CURRENT_STATE.md`, `TECH.md`, and `TREE.txt` are always embedded.
- Changed text/source files are embedded with full current contents.
- Changed binary assets are listed by path only; their bytes are never embedded.
- `docs/archive/**`, build output, dependencies and generated context bundles are
  excluded from embedded context.

## Normal verification

```bash
pnpm test
pnpm build
```

The solver can be regenerated separately with `pnpm generate:winnable-pool` when the
C++20 toolchain configured in `package.json` is available.

## Current next focus

Playtest the 25% overlap drag/drop threshold. If it still feels too sticky or too
sensitive, tune only the overlap threshold and its geometry tests rather than changing
tableau legality rules.
