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

- Runtime card faces use stable `public/assets/cards/*.png` files; Phaser does not load SVG cards at runtime.
- The current Horizontal2 runtime PNGs are pre-resampled to 216×302. Responsive desktop display width is constrained to 84..180 px, so these textures retain resolution headroom without runtime SVG rasterization.
- Desktop uses `Phaser.Scale.RESIZE`: the real canvas fills the browser viewport 1:1 instead of being CSS-stretched.
- `LayoutMetrics.ts` calculates card size and all board coordinates directly from the live viewport. The main camera stays at `zoom = 1` and `scroll = 0`; `ResponsiveViewport.ts` has been removed.
- Desktop layout is hybrid: the foundation utility rail stays attached to the left edge, cards grow moderately while tableau columns keep a compact gap of about 30% of card width (hard-capped at 40%), and excess widescreen/ultrawide space centers the tableau inside the remaining play region instead of stretching it edge-to-edge.
- Text-heavy HUD controls and the main menu use native DOM/HTML text for browser-native sharpness and are attached directly to the viewport host; only the remaining in-canvas symbols use Phaser Text at 2× internal resolution.
- Foundation rendering keeps the complete collected stack at each suit slot; the previous rank stays visible underneath while the next automatic card flies in.
- Tableau top position is responsive and derived from the current card height plus a constrained top-row gap; long piles compress using the actual available viewport height.
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

Playtest the new true responsive desktop layout at 16:9, resized browser windows, and ultrawide. Confirm cards/columns use the available viewport naturally, camera remains identity, DOM controls/menu stay anchored to the viewport, drag/drop still feels unchanged, resize does not restart the current game, and foundation cards remain visible beneath incoming automatic cards. Mobile layout is intentionally a later separate pass.
