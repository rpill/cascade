# Cascade Solitaire — Technical Notes

## Architecture

- `src/game/model/SolitaireGame.ts` — mutable solitaire state and legality rules.
- `src/game/model/GameHistory.ts` — deep pre-action snapshots and LIFO undo.
- `src/game/model/GameFlow.ts` — pure main-menu / active-game flow transitions.
- `src/game/model/GameSession.ts` — seed and mode lifecycle.
- `src/game/view/BoardView.ts` — Phaser board input, card sync, target selection and motion.
- `src/game/view/DropGeometry.ts` — renderer-independent drop commitment geometry.
- `src/game/view/CardFlight.ts` — quadratic flight path math.
- `src/game/view/MainMenuView.ts` — native DOM main menu, pending mode selection, Daily status, and current-week 3/5/7 progress.
- `src/game/view/DailyCompleteView.ts` — native DOM Daily result overlay with retry/menu actions.
- `src/game/view/RenderQuality.ts` — high-resolution Phaser Text settings.
- `src/game/view/LayoutMetrics.ts` — pure responsive desktop card sizing and board coordinates.
- `src/game/view/layout.ts` — pure derived slot/tableau/waste placement helpers that consume `LayoutMetrics`.
- `src/game/scenes/GameScene.ts` — coordinator for flow, history, model, Daily/meta state, platform initialization, timers, and views.
- `src/meta/MetaSave.ts` — versioned structured player save plus runtime normalization/migration.
- `src/meta/MetaRepository.ts` — queued platform persistence that keeps the newest unsaved snapshot for retry after write failure.
- `src/meta/DailyCalendar.ts` — trusted-UTC Daily IDs, ISO week IDs/dates, and deterministic Daily seed mapping.
- `src/meta/DailyProgress.ts` — pure attempt, completion, personal-best, and weekly progress rules.
- `src/meta/DailyAttemptTimer.ts` — pause-aware per-attempt elapsed timer.
- `src/platform/services.ts` — platform-neutral player storage and trusted-clock interfaces plus unavailable fallbacks.
- `src/platform/yandex.ts` — cached Yandex SDK adapter for Player data, server time, and LoadingAPI readiness.
- `scripts/chatgpt-context-lib.mjs` — testable tree/Git/context-bundle core.
- `scripts/chatgpt-context.mjs` — CLI used by `pnpm context*`.

## Development constraints

- Keep gameplay rules in model code rather than Phaser objects where practical.
- `src/game/model/**` must stay platform-neutral: never import Yandex SDK or `src/platform/**` there. `GameScene` is the coordinator between solitaire flow and meta/platform services.
- Daily identity must come from trusted Yandex server time and UTC calendar boundaries; when trusted time is unavailable, disable Daily instead of falling back to the device clock.
- Daily seed selection is deterministic from Daily ID + algorithm version into the frozen solver-proven pool; Daily restart/New Game must replay that fixed seed.
- Daily elapsed time excludes main-menu and hidden-tab time.
- Keep undo transactional; auto-foundation steps are part of the triggering player action.
- Do not run auto-foundation again immediately after undo restore.
- Keep deal-mode selection in the main menu; New Game keeps the active mode.
- Interaction geometry uses overlap area and may be tuned independently of legal-move rules.
- Manual drag resolution is always an immediate snap, both for accepted placement and rejected/cancelled return; reserve motion tweens for non-drag/automatic movement.
- Keep normal antialiasing and subpixel motion; do not use `pixelArt`/nearest-neighbour filtering merely to hide low-resolution source assets.
- Do not use the unsupported Phaser 3 `GameConfig.resolution` field. Desktop uses `Phaser.Scale.RESIZE` so the canvas itself matches the parent viewport instead of being CSS-upscaled.
- Keep the main camera at zoom 1 / scroll 0. Do not reintroduce authored-board camera fitting; calculate board geometry directly from `LayoutMetrics(this.scale.width, this.scale.height)`.
- Desktop responsive cards are constrained to 84..180 px wide with the existing 108:151 aspect ratio. The foundation utility rail is anchored to the left viewport edge; tableau columns use a compact proportional gap (target ~30% of card width, cap 40%) instead of consuming all spare width; excess widescreen/ultrawide space centers the tableau inside that region.
- Load runtime card faces from `public/assets/cards/*.png`; do not use Phaser SVG loading for cards. The current PNGs are 216×302 and are displayed responsively up to 180×252. Native DOM handles text-heavy HUD/menu UI; Phaser Text resolution 2× remains only for in-canvas symbols.
- `Decks/` is source-art/reference material only; `dev` and `build` must not require asset synchronization or conversion.
- Prefer tests for rules, state transitions, geometry and animation math.
- Use native DOM for text-heavy HUD/menu UI; append it directly to the game host as screen-space UI, never as Phaser DOM game objects. Keep gameplay cards and board rendering in Phaser.
- Foundation placement must include every collected card at its suit coordinates with increasing depth; never hide the previous foundation rank merely because a newer rank entered model state.
- Avoid tests that freeze cosmetic styling, exact colours, mutable UI coordinates or
  exact image bytes unless a temporary migration explicitly needs them.
- Asset tests must not hash-lock artwork or prevent a later reskin; rendering tests should protect
  resolution/clarity behavior rather than specific visual bytes.

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
