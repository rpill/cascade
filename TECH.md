# Cascade Solitaire — Technical Notes

## Architecture

- `src/game/model/SolitaireGame.ts` — mutable solitaire state and legality rules.
- `src/game/model/GameHistory.ts` — deep pre-action snapshots and LIFO undo.
- `src/game/model/GameFlow.ts` — pure main-menu / active-game flow transitions.
- `src/game/model/GameSession.ts` — seed and mode lifecycle.
- `src/game/view/BoardView.ts` — Phaser board input, card sync, target selection and motion.
- `src/game/view/DropGeometry.ts` — renderer-independent drop commitment geometry.
- `src/game/view/CardFlight.ts` — quadratic flight path math.
- `src/game/view/MainMenuView.ts` — main menu and pending mode selection.
- `src/game/scenes/GameScene.ts` — wiring between flow, history, model and views.
- `scripts/chatgpt-context-lib.mjs` — testable tree/Git/context-bundle core.
- `scripts/chatgpt-context.mjs` — CLI used by `pnpm context*`.

## Development constraints

- Keep gameplay rules in model code rather than Phaser objects where practical.
- Keep undo transactional; auto-foundation steps are part of the triggering player action.
- Do not run auto-foundation again immediately after undo restore.
- Keep deal-mode selection in the main menu; New Game keeps the active mode.
- Interaction geometry may be tuned independently of legal-move rules.
- Manual drag resolution is always an immediate snap, both for accepted placement and rejected/cancelled return; reserve motion tweens for non-drag/automatic movement.
- Prefer tests for rules, state transitions, geometry and animation math.
- Avoid tests that freeze cosmetic styling, exact colours, mutable UI coordinates or
  exact image bytes unless a temporary migration explicitly needs them.
- `tests/card-assets.test.ts` checks presence/PNG validity of all 52 runtime faces but
  intentionally does not hash-lock the current art.

## Context workflow constraints

- Requires a real Git working tree when running `pnpm context` or `pnpm context:last`.
- Uses Node built-ins plus the Git executable; no extra runtime dependency.
- `pnpm context` reads `git status --porcelain` to include tracked changes and untracked
  non-ignored files.
- `pnpm context:last` uses the latest commit's changed-file list.
- Mandatory truth docs are always current working-copy contents.
- Binary/media bytes are not embedded.
- `_chatgpt_bundle/` must stay ignored by Git.

## Build and verification

```bash
pnpm test
pnpm build
```

The Vite chunk-size warning is informational unless loading/performance measurements
show an actual problem; do not restructure the application solely to silence it.
