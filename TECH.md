# Cascade Solitaire — Technical Notes

## Architecture

- `src/game/model/SolitaireGame.ts` — mutable solitaire state and legality rules.
- `src/game/model/GameHistory.ts` — deep pre-action snapshots and LIFO undo.
- `src/game/model/GameFlow.ts` — pure main-menu / active-game flow transitions, including resume of a saved deal.
- `src/game/model/GameSession.ts` — seed/mode lifecycle, explicit verified Standard/Daily starts, and pure saved-deal resume boundary.
- `src/game/model/DealProof.ts` — exact solver-proof replay through production `SolitaireGame` rules.
- `src/game/model/VerifiedDealCatalog.ts` — typed read-only decoder/membership API for the generated uint32 binary catalog.
- `src/game/model/StandardDifficultyDirector.ts` / `StandardAttemptPolicy.ts` — pure hidden Standard tier/seed selection and deliberate-abandonment semantics.
- `src/game/view/BoardView.ts` — Phaser board input, card sync, target selection, motion, direct restored-state render, and persistence-neutral settled callback.
- `src/game/view/DropGeometry.ts` — renderer-independent drop commitment geometry.
- `src/game/view/CardFlight.ts` — quadratic flight path math.
- `src/game/view/AppShellView.ts` / `PlayPageView.ts` — native DOM navigation, wallet, mode cards, Daily weekly indicators and player-level footer.
- `src/game/view/ThemeCatalogView.ts` — passive DOM collection/shop, filters, bounded cards, internal scrolling and buy/apply/retry callbacks; no economy mutation in views.
- `src/game/view/MenuResponsive.css` — shell gutters, portrait/landscape menus, level reward and narrow statistics layout, independent of canvas board geometry.
- `src/game/view/SettingsView.ts` — native modal dialog preserving underlying menu destination, focus and board state.
- `src/settings/Preferences.ts` / `AudioController.ts` — device-local manual language/sound preferences and the combined audio mute policy.
- `src/localization/Localization.ts` / `English.ts` — explicit RU/EN translations and view-owned bindings; replaced DOM rows are released after rendering. No DOM text observer or page reload is used.
- `src/game/view/RewardSummaryView.ts` — shared XP/coin breakdown and pending reward state for result overlays.
- `src/game/view/DailyCompleteView.ts` — native DOM Daily result overlay with retry/menu actions.
- `src/game/view/GameCompleteView.ts` — native DOM Standard/Classic result overlay with elapsed/best/stats/win-rate and new-game/menu actions.
- `src/game/view/StatisticsView.ts` — passive no-scroll native DOM statistics modal for Standard/Classic played/wins/win-rate/best time.
- `src/game/view/LeaderboardView.ts` — passive no-scroll native DOM leaderboard modal with mode tabs, top-10, personal row, auth state, and loading/empty/error/unavailable states.
- `src/game/view/RenderQuality.ts` — high-resolution Phaser Text settings.
- `src/game/view/LayoutMetrics.ts` — pure responsive desktop card sizing and board coordinates.
- `src/game/view/layout.ts` — pure derived slot/tableau/waste placement helpers that consume `LayoutMetrics`.
- `src/game/scenes/GameScene.ts` — coordinator for flow, history, model, local active-session checkpoints, unified attempt lifecycle, Daily/meta state, pre-load meta mutation replay, platform initialization, statistics/leaderboard/auth lifecycle, and DOM views.
- `src/persistence/ActiveGameSave.ts` — versioned browser-local active-game checkpoint schema, strict normalization, canonical card reconstruction, and checkpoint-to-Deal conversion.
- `src/persistence/ActiveGameRepository.ts` — safe `cascadeActiveGame` localStorage load/save/clear boundary; corrupt/invalid data is discarded best-effort.
- `src/meta/MetaSave.ts` — V4 player save, V1/V2/V3→V4 migration, ownership/progression/receipt normalization, and persisted hidden Standard difficulty state.
- `src/meta/MetaSession.ts` — runtime profile load/replay/dispatch and serialized acknowledged writes under `cascadeMeta`; exposes readiness, save errors and result rewards.
- `src/meta/MetaJournal.ts` — durable per-profile operation journal with stable stream/sequence IDs; acknowledged operations are compacted only after successful writes.
- `src/meta/MetaOperations.ts` / `Economy.ts` / `Progression.ts` — pure attempt, reward, purchase, equip and level rules. Completion high-water marks outlive the bounded recent-attempt cache.
- `src/theme/ThemeCatalog.ts` — published products and lightweight previews, separate from the full renderer registry.
- `src/meta/MetaRepository.ts` — retained legacy snapshot persistence helper; runtime economy uses `MetaSession`.
- `src/meta/DailyCalendar.ts` — trusted-UTC Daily IDs, ISO week IDs/dates, and date-offset lookup into the generated verified Daily schedule.
- `src/meta/DailyProgress.ts` — pure Daily attempt, completion, personal-best, and weekly progress rules.
- `src/meta/AttemptTimer.ts` — generic pause-aware attempt timer with restored elapsed-duration support.
- `src/meta/GameStats.ts` — pure Standard/Classic `played` / `wins` / `bestTimeMs` mutations; Daily is intentionally excluded.
- `src/meta/MetaMutationQueue.ts` — retained legacy pre-load helper; runtime typed operations use `MetaJournal` and `MetaSession`.
- `src/leaderboards/LeaderboardConfig.ts` — competitive-mode policy plus fixed Yandex names (`standardwinstreak`, `dailyfastest`) and reversible Daily date/time score encoding.
- `src/leaderboards/LeaderboardSubmissionQueue.ts` — global serialized leaderboard write queue; coalesces pending descending scores to the maximum and enforces a 1100 ms submission interval.
- `src/leaderboards/LeaderboardService.ts` — gameplay-safe Standard streak / current-Daily loading, authorization delegation, score decoding/filtering, and best-result synchronization.
- `src/platform/services.ts` — platform-neutral PlayerStorage/trusted-clock/auth/leaderboard interfaces plus persistent browser fallback (`cascadePlayerData`) and memory last resort.
- `src/platform/yandex.ts` — cached Yandex adapter: loads `/sdk.js` in the HTTPS Yandex/proxy environment, initializes/reacquires Player data/server time, exposes explicit auth + direct `ysdk.leaderboards` APIs, account-selection events, and LoadingAPI readiness.
- `scripts/chatgpt-context-lib.mjs` — testable tree/Git/context-bundle core.
- `scripts/chatgpt-context.mjs` — CLI used by `pnpm context*`.
- `tools/deals/generate.mjs` — resumable parallel candidate scan, proof verification, difficulty scoring/partitioning, Daily schedule assignment, and atomic final catalog/proof-sample emission.
- `tools/deals/verify-all.mjs` — long release gate that freshly solves every production seed at the slow ceiling and replays every proof through current TypeScript rules.
- `tools/deals/report.mjs` — catalog/scan/difficulty/overlap/Daily-band report.

## Persistence boundaries

There are four separate persistence concerns:

1. **Active game checkpoint (`cascadeActiveGame`)** — browser-local, frequent, current unfinished board only. Contains mode/seed, full mutable board zones, `attemptStarted`, accumulated elapsed time, optional Daily identity, and `playing` / `menu-paused` state. It is written at settled gameplay boundaries and lifecycle boundaries such as menu/visibility/pagehide.
2. **Long-lived meta save (`cascadeMeta`)** — collection/equipped/achievements, XP, coins, receipts, ordinary statistics, Daily records and weekly progress. This goes through `MetaSession` / platform PlayerStorage and is not written once per card move.
3. **Unavailable-platform PlayerStorage fallback (`cascadePlayerData`)** — localStorage mirror used when Yandex PlayerStorage is not available; memory is only the final page-lifetime fallback.
4. **Operation journal (`cascadeMetaJournal:<encoded scope>`)** — typed begin/complete/purchase/equip operations persisted before application. Cloud receipts prevent duplicate replay; confirmed saves permit local compaction. Scope follows player identity and never transfers an old account's operations to a new account.

The economy calls optional `PlayerStorage.loadStrict` / `saveStrict` methods to surface local storage errors and uses acknowledged `flush: true` writes. A failed read is not an empty profile. A failed write retains pending operations. Attempt IDs are stored with the active checkpoint; structured stream/sequence completion receipts prevent duplicate rewards even after the recent-attempt cache is pruned. These guarantees cover ordered attempts in one active session; cross-device concurrent merging requires a separate design.

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
- Meta changes before remote load must go through `MetaSession.dispatch` and its durable journal; never assign loaded state over pending operations. Purchases remain unavailable until loading succeeds.

## Platform gameplay lifecycle

- `PlatformServices.platformPause` exposes cached external pause state plus one platform-neutral subscription API.
- `PlatformServices.gameplay` wraps optional Yandex `GameplayAPI.start()` / `stop()` and is inert outside Yandex.
- `src/platform/GameplayActivity.ts` is the pure blocker policy for attempt timer, external scene pause, and local gameplay-markup decisions.
- `GameScene.reconcileGameplayActivity()` is the single coordinator for menu, visibility, result, attempt, and external platform pause state.
- Yandex event callbacks are registered/unregistered with matching `ysdk.on()` / `ysdk.off()` callback references.
- External platform pause state is runtime-only and is not persisted in `cascadeActiveGame` or `cascadeMeta`.

## Daily constraints

- Daily identity must come from trusted Yandex server time and UTC calendar boundaries; when trusted time is unavailable, disable Daily instead of falling back to the device clock.
- Daily seed selection is a deterministic UTC date-offset lookup in `VerifiedDealCatalog`; dates outside the committed schedule fail instead of hashing/falling back to another pool.
- A reloaded Daily checkpoint is only resumed after trusted context exists and `dailyId`, algorithm version, and deterministic seed all match. Stale/mismatched Daily checkpoints are discarded.
- Daily Restart replays the fixed Daily seed. `НОВАЯ ИГРА` / `N` are intentionally unavailable in Daily because they would duplicate Restart.
- Daily remains on `DailyProgress`; never write Daily attempts/wins into `GameStats`.

## Statistics / leaderboard constraints

- Player-facing mode UI exposes only Game (`winnable`) and Daily. Classic/original is retained only as internal legacy compatibility and must not be exposed from Home or Statistics. Statistics live in the shell page with Game / Daily tabs.
- There is no separate Shop shell destination. Collection is the sole cosmetic catalog and must keep both `Все` and `Мои` filters while allowing earned-coin purchase/equip actions in place. Real-money purchases are entered from the `+` button beside the coin balance and live in a modal purchase surface; until Yandex Payments is integrated, those checkout buttons remain disabled rather than simulating purchases.
- Standard global ranking is `standardwinstreak`: Yandex `numeric`, descending, integer best consecutive-win streak.
- Daily global ranking is `dailyfastest`: Yandex `numeric`, descending. Runtime encodes trusted UTC Daily day + inverse elapsed milliseconds so one persistent board behaves like a per-day fastest-time board. The UI must decode and filter entries to the current Daily ID before display.
- Classic has no global leaderboard and must never call `getEntries`, `getPlayerEntry`, or `setScore` for a Classic score.
- Public top-10 (`getEntries`) may load without authorization. Personal rank and `setScore` require authorization. Never trigger `openAuthDialog()` automatically.
- Authorization remains unavailable while an unfinished board, profile load, save error or pending journal exists.
- On `ACCOUNT_SELECTION_DIALOG_CLOSED`, invalidate current leaderboard requests and reload the page so Yandex Player/meta is reacquired from the selected progress.
- Leaderboard view loads are request-token guarded; an older async response must not replace a newer tab selection or a closed view.
- Score writes go only through `LeaderboardSubmissionQueue`. Keep at least 1100 ms between actual `setScore` calls and coalesce multiple pending values for one board to the largest descending score.
- Before Standard submission, preserve an equal/larger server streak. Before Daily submission, preserve a faster same-day server result and never overwrite a future-day entry with an older date.
- Completion leaderboard sync is fire-and-forget after local meta finalization. Read/write/auth failures must never block or roll back local gameplay progress.
- Console setup and real-draft acceptance are documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`.

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
- Use direct `ysdk.leaderboards` APIs; deprecated `ysdk.getLeaderboards()` must not be reintroduced.
- Protected leaderboard calls use `ysdk.isAvailableMethod()` before `getPlayerEntry` / `setScore`; public `getEntries` remains guest-readable.
- Yandex auth is explicit user action only. After a successful auth dialog, reacquire `Player`; account-selection-close reload semantics are described above.
- Standard/Classic must remain playable even if SDK initialization/player-data/leaderboard/trusted-time access fails.
- Daily must remain unavailable without trusted server time.
- Final Console configuration and real-draft acceptance are external release gates documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`.
- Advertising and other future platform interruptions must reuse the shared gameplay lifecycle boundary instead of adding an independent timer/pause policy.

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
pnpm deals:verify-sample
```

Verified-deal release/regeneration gates:

```bash
pnpm deals:build-solver
pnpm deals:generate -- --standard-total 50000 --daily-days 36525 --jobs 4
pnpm deals:report
pnpm deals:verify-all
```

`artifacts/deals/` is resumable development output and must remain ignored. Production ships only `public/assets/deals/verified-deals.bin`, its manifest, and the small committed proof sample.

Yandex SDK smoke test:

```bash
pnpm yandex:dev
```

The Vite chunk-size warning is informational unless loading/performance measurements show an actual problem; do not restructure the application solely to silence it.
