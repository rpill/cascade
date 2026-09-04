# Cascade Solitaire — Technical Notes

## Architecture

- `src/game/model/SolitaireGame.ts` — mutable solitaire state and legality rules.
- `src/game/model/GameHistory.ts` — deep pre-action snapshots and LIFO undo.
- `src/game/model/GameFlow.ts` — pure main-menu / active-game flow transitions, including resume of a saved deal.
- `src/game/model/GameSession.ts` — seed/mode lifecycle and pure saved-deal resume boundary.
- `src/game/view/BoardView.ts` — Phaser board input, card sync, target selection, motion, direct restored-state render, and persistence-neutral settled callback.
- `src/game/view/DropGeometry.ts` — renderer-independent drop commitment geometry.
- `src/game/view/CardFlight.ts` — quadratic flight path math.
- `src/game/view/MainMenuView.ts` — native DOM main menu. Mode buttons start games directly; Daily status/current-week 3/5/7 progress and conditional `ЗАКРЫТЬ` are screen-space DOM.
- `src/game/view/DailyCompleteView.ts` — native DOM Daily result overlay with retry/menu actions.
- `src/game/view/GameCompleteView.ts` — native DOM Standard/Classic result overlay with elapsed/best/stats/win-rate and new-game/menu actions.
- `src/game/view/RenderQuality.ts` — high-resolution Phaser Text settings.
- `src/game/view/LayoutMetrics.ts` — pure responsive desktop card sizing and board coordinates.
- `src/game/view/layout.ts` — pure derived slot/tableau/waste placement helpers that consume `LayoutMetrics`.
- `src/game/scenes/GameScene.ts` — coordinator for flow, history, model, local active-session checkpoints, unified attempt lifecycle, Daily/meta state, pre-load meta mutation replay, platform initialization, and DOM views.
- `src/persistence/ActiveGameSave.ts` — versioned browser-local active-game checkpoint schema, strict normalization, canonical card reconstruction, and checkpoint-to-Deal conversion.
- `src/persistence/ActiveGameRepository.ts` — safe `cascadeActiveGame` localStorage load/save/clear boundary; corrupt/invalid data is discarded best-effort.
- `src/meta/MetaSave.ts` — `MetaSave` V2 structured player save, V1→V2 migration, and runtime normalization.
- `src/meta/MetaRepository.ts` — queued long-lived player persistence under `cascadeMeta`; keeps the newest unsaved snapshot for retry after write failure.
- `src/meta/DailyCalendar.ts` — trusted-UTC Daily IDs, ISO week IDs/dates, and deterministic Daily seed mapping.
- `src/meta/DailyProgress.ts` — pure Daily attempt, completion, personal-best, and weekly progress rules.
- `src/meta/AttemptTimer.ts` — generic pause-aware attempt timer with restored elapsed-duration support.
- `src/meta/GameStats.ts` — pure Standard/Classic `played` / `wins` / `bestTimeMs` mutations; Daily is intentionally excluded.
- `src/meta/MetaMutationQueue.ts` — pure pre-load mutation queue that replays local meta events once over the asynchronously loaded player save.
- `src/platform/services.ts` — platform-neutral PlayerStorage/trusted-clock interfaces plus persistent browser fallback (`cascadePlayerData`) and memory last resort.
- `src/platform/yandex.ts` — cached Yandex adapter: loads `/sdk.js` in the HTTPS Yandex/proxy environment, initializes Player data/server time, and exposes LoadingAPI readiness.
- `scripts/chatgpt-context-lib.mjs` — testable tree/Git/context-bundle core.
- `scripts/chatgpt-context.mjs` — CLI used by `pnpm context*`.

## Persistence boundaries

There are three intentionally separate persistence concerns:

1. **Active game checkpoint (`cascadeActiveGame`)** — browser-local, frequent, current unfinished board only. Contains mode/seed, full mutable board zones, `attemptStarted`, accumulated elapsed time, optional Daily identity, and `playing` / `menu-paused` state. It is written at settled gameplay boundaries and lifecycle boundaries such as menu/visibility/pagehide.
2. **Long-lived meta save (`cascadeMeta`)** — collection/equipped/achievements, Standard/Classic statistics, Daily records, and weekly progress. This goes through `MetaRepository` / platform PlayerStorage and is not written once per card move.
3. **Unavailable-platform PlayerStorage fallback (`cascadePlayerData`)** — localStorage mirror used when Yandex PlayerStorage is not available; memory is only the final page-lifetime fallback.

Do not merge the active board checkpoint into `cascadeMeta` or upload a full board through Yandex Player `setData()` after every move. The active checkpoint is deliberately local and frequent; meta/cloud writes are coalesced and reserved for long-lived player state.

## Session / attempt lifecycle constraints

- `src/game/model/**` must stay persistence/platform-neutral. Model/session/flow may accept restored data but must never import Yandex, browser storage, `src/platform/**`, or `src/persistence/**`.
- A new board is checkpointed once with `attemptStarted: false` before its opening animation. The attempt starts only at the first fully settled/playable boundary.
- Restored Standard/Classic boards render directly from the checkpoint with `BoardView.showRestoredState()`; do not replay the initial deal animation.
- If a restored checkpoint already has `attemptStarted: true`, continue from its saved `elapsedMs` and do not call the ordinary/Daily begin mutation again.
- Undo history is runtime-only. After F5, restore the board exactly but begin with an empty `GameHistory` stack.
- Standard/Classic reload does not increment `played`; Restart and New Game each create a new attempt when their new board reaches the playable boundary.
- Ordinary completion must update stats exactly once and only then clear `cascadeActiveGame`. The completion board remains visible underneath the result/menu until another deal starts.
- The generic attempt timer excludes main-menu time, hidden-tab time, and closed-page time. Resume only when `attemptStarted && !attemptFinalized && flow.state === 'playing' && document.visibilityState === 'visible'`.
- Meta changes that happen before the remote save finishes loading must go through `MetaMutationQueue`; never assign the loaded save directly over runtime state before replay.

## Daily constraints

- Daily identity must come from trusted Yandex server time and UTC calendar boundaries; when trusted time is unavailable, disable Daily instead of falling back to the device clock.
- Daily seed selection is deterministic from Daily ID + algorithm version into the frozen solver-proven pool.
- A reloaded Daily checkpoint is only resumed after trusted context exists and `dailyId`, algorithm version, and deterministic seed all match. Stale/mismatched Daily checkpoints are discarded.
- Daily Restart replays the fixed Daily seed. `НОВАЯ ИГРА` / `N` are intentionally unavailable in Daily because they would duplicate Restart.
- Daily remains on `DailyProgress`; never write Daily attempts/wins into `GameStats`.

## Gameplay / rendering constraints

- Keep gameplay rules in model code rather than Phaser objects where practical.
- Keep undo transactional; auto-foundation steps are part of the triggering player action.
- Do not run auto-foundation again immediately after undo restore.
- Interaction geometry uses overlap area and may be tuned independently of legal-move rules.
- Manual drag resolution is always an immediate snap, both for accepted placement and rejected/cancelled return; reserve motion tweens for non-drag/automatic movement.
- Keep normal antialiasing and subpixel motion; do not use `pixelArt`/nearest-neighbour filtering merely to hide low-resolution source assets.
- Do not use the unsupported Phaser 3 `GameConfig.resolution` field. Desktop uses `Phaser.Scale.RESIZE` so the canvas itself matches the parent viewport instead of being CSS-upscaled.
- Keep the main camera at zoom 1 / scroll 0. Do not reintroduce authored-board camera fitting; calculate board geometry directly from `LayoutMetrics(this.scale.width, this.scale.height)`.
- Desktop responsive cards are constrained to 84..180 px wide with the existing 108:151 aspect ratio. The foundation utility rail is anchored to the left viewport edge; tableau columns use a compact proportional gap (target ~30% of card width, cap 40%) instead of consuming all spare width; excess widescreen/ultrawide space centers the tableau inside that region.
- Load runtime card faces from `public/assets/cards/*.png`; do not use Phaser SVG loading for cards. The current Vintage PNGs are 360×480 and are displayed responsively up to 180×252.
- `Decks/` is source-art/reference material only; `dev` and `build` must not require asset synchronization or conversion.
- Use native DOM for text-heavy HUD/menu/result UI; append it directly to the game host as screen-space UI, never as Phaser DOM game objects. Keep gameplay cards and board rendering in Phaser.
- Foundation placement must include every collected card at its suit coordinates with increasing depth; never hide the previous foundation rank merely because a newer rank entered model state.
- Avoid tests that freeze cosmetic styling, exact colours, mutable UI coordinates or exact image bytes unless a temporary migration explicitly needs them.
- Asset tests must not hash-lock artwork or prevent a later reskin; rendering tests should protect resolution/clarity behavior rather than specific visual bytes.

## Yandex integration constraints

- Plain `pnpm dev` runs over HTTP and intentionally allows the platform adapter to fall back. In the HTTPS Yandex/proxy environment, load `/sdk.js` before `YaGames.init()`.
- `pnpm yandex:dev` performs the normal build and launches `@yandex-games/sdk-dev-proxy -p dist --dev-mode=true` for local SDK smoke tests.
- Standard/Classic must remain playable even if SDK initialization/player-data load/trusted time fails.
- Daily must remain unavailable without trusted server time.
- Future ad/platform lifecycle work should route through one shared pause/resume boundary instead of adding another independent timer policy.

## Context workflow constraints

- Requires a real Git working tree when running `pnpm context` or `pnpm context:last`.
- Uses Node built-ins plus the Git executable; no extra runtime dependency.
- `pnpm context` reads `git status --porcelain` to include tracked changes and untracked non-ignored files.
- `pnpm context:last` uses the latest commit's changed-file list.
- Mandatory truth docs are always current working-copy contents.
- Binary/media bytes are not embedded.
- `_chatgpt_bundle/` must stay ignored by Git.

## Build and verification

```bash
pnpm test
pnpm build
```

Yandex SDK smoke test:

```bash
pnpm yandex:dev
```

The Vite chunk-size warning is informational unless loading/performance measurements show an actual problem; do not restructure the application solely to silence it.
