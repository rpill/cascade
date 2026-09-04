# Cascade Solitaire — Current State

## Stack

- TypeScript
- Phaser `^3.90.0`
- Vite `^7.1.3`
- pnpm
- Node built-in test runner
- Yandex Games SDK adapter + official `@yandex-games/sdk-dev-proxy` development path
- offline C++20 solver for generating/verifying the winnable seed pool

## Implemented gameplay

- Sawayama/Hikone deal and stock behavior.
- Seven tableau piles with descending alternating-colour stacking and run moves.
- Four suit foundations and safe automatic foundation moves.
- Free cell appears when the stock is exhausted.
- Original and solver-proven Winnable deal modes.
- Restart preserves mode and seed.
- Transactional undo (`Z` / `ОТМЕНА`) including subsequent auto-foundation moves.
- Undo correctly restores the visible stock after undoing from a fully exhausted stock.
- Persistent main menu. Clicking `СТАНДАРТ`, `КЛАССИКА`, or an available `ИСПЫТАНИЕ ДНЯ` starts that mode immediately; there is no separate Play button.
- `ЗАКРЫТЬ` appears only when the menu overlays an existing board; `Esc` remains the keyboard close action.
- Standard/Classic keep `НОВАЯ ИГРА` / `N`; Daily intentionally has no New Game action because its fixed daily seed would make it duplicate Restart.
- `В МЕНЮ`, `N`, `Z`, `R`, and `Esc` controls are wired with the mode restrictions above.

## Session persistence and ordinary statistics

- Unfinished Standard and Classic games resume after a page refresh from a browser-local active-game checkpoint.
- The active checkpoint key is `cascadeActiveGame`. It stores mode/seed, all mutable board zones, `attemptStarted`, accumulated elapsed time, Daily identity when applicable, and `playing` / `menu-paused` UI state.
- Restored boards render directly from the saved snapshot instead of replaying the opening deal animation.
- The pre-refresh undo stack is intentionally not persisted; after reload the restored board is correct, but undo history starts empty.
- Active-game checkpoints are browser-local and frequent. They are updated at settled gameplay boundaries plus menu/visibility/pagehide boundaries; the board snapshot is not uploaded to Yandex after every move.
- The ordinary attempt timer starts when the opening/automatic chain has settled and input becomes available. Menu time, hidden-tab time, and time while the page is closed are excluded.
- Reloading a started Standard/Classic attempt does not increment `played` again. Restart creates a new attempt and increments `played` after the new board reaches the playable boundary; New Game does the same with a fresh seed.
- `MetaSave` is version 2. Standard (`winnable`) and Classic (`original`) persist separate `played`, `wins`, and `bestTimeMs` values; win rate is derived from wins/played rather than stored.
- V1 player saves migrate to V2 without losing collection/equipped/achievements, Daily records, weekly progress, or claimed milestones.
- Meta mutations made before Yandex Player data finishes loading are replayed over the loaded cloud state so a fast local start/win cannot be overwritten by stale remote statistics.
- Ordinary wins finalize statistics exactly once, flush the newest meta state, clear the unfinished active checkpoint, and show a native DOM result overlay.
- The ordinary result overlay shows mode, elapsed time, best time, new-record state, wins/played, derived win rate, `ЕЩЁ ПАРТИЯ`, and `В МЕНЮ`.

## Daily / weekly retention foundation

- Daily is a technical third deal mode backed by a deterministic seed from the frozen solver-proven pool. The UTC Daily ID and `dailyAlgorithmVersion` choose the same deal for every attempt that day.
- Yandex Player structured data and Yandex server time are isolated behind platform-neutral persistence/time interfaces; Standard and Classic remain playable while platform initialization is unavailable or still loading.
- Daily attempts are unlimited. Restart replays the same Daily seed and starts another attempt after the board becomes playable. `НОВАЯ ИГРА` / `N` are intentionally unavailable in Daily.
- A completed Daily stores a personal best completion time; slower replays keep the previous best and faster replays replace it.
- The current UTC ISO week is shown in the main menu with completed Daily dates and 3/5/7 completion checkpoints. Missing a day does not erase other completions in the week.
- Daily uses the same generic attempt timer: it starts only after the opening/automatic chain has settled, pauses while the main menu is open or the browser tab is hidden, and stops on win.
- A Daily checkpoint discovered on reload is deferred until trusted platform time is available. Resume requires matching `dailyId`, algorithm version, and deterministic seed; stale/mismatched saves are discarded.
- Daily is disabled when trusted server time is unavailable; the game never validates or mints a production Daily from the local device clock.
- Daily completion uses a separate native DOM result overlay with elapsed time, personal best, weekly progress, retry, and menu actions.

## Platform persistence / Yandex integration

- `cascadeMeta` is the long-lived structured player save managed by `MetaRepository`; `cascadeActiveGame` is a separate browser-local current-session checkpoint.
- When the Yandex platform is unavailable, PlayerStorage falls back to `localStorage` under `cascadePlayerData`; memory is only the last resort when browser storage itself is unavailable or throws.
- The Yandex adapter dynamically loads `/sdk.js` before `YaGames.init()` in the HTTPS Yandex/proxy environment. Plain local HTTP development intentionally falls back to the unavailable-platform adapter.
- `pnpm yandex:dev` builds `dist` and launches the official Yandex SDK development proxy for local SDK smoke-testing.
- `LoadingAPI.ready()` is exposed through the platform boundary and called after platform/meta initialization reaches the current ready boundary.

## Statistics / Yandex leaderboards

- Standard and Classic statistics are available from a dedicated native DOM `СТАТИСТИКА` modal; they are no longer expanded inline inside the main menu.
- Main-menu information/modals follow a strict no-scroll rule. Statistics, leaderboards, and future shop screens must fit the viewport; use compact responsive layout, tabs, or pagination instead of scrollbars.
- The main menu exposes a dedicated `ТАБЛИЦА ЛИДЕРОВ` action. The leaderboard modal has Standard/Classic tabs, top-10, loading/empty/error/unavailable states, an optional personal row, explicit sign-in, and close/Esc behavior.
- Built-in Yandex leaderboards use the fixed technical names `standard_best_time` (`winnable`) and `classic_best_time` (`original`). Daily intentionally has no built-in global leaderboard.
- Public top-10 browsing does not require authorization. Personal rank and score submission require Yandex authorization; the game never opens the auth dialog automatically.
- Authorization is disabled while an unfinished active game exists, avoiding guest-board/account-meta mixing during Yandex account/progress selection. If `ACCOUNT_SELECTION_DIALOG_CLOSED` fires, the page reloads so the selected Yandex progress is reacquired cleanly.
- Best-time writes are serialized with a 1100 ms interval and same-board pending writes coalesce to the lowest time. A slower local result never overwrites a faster server result.
- Completing an ordinary game with a newly improved personal best triggers a fire-and-forget leaderboard sync only after local meta finalization/checkpoint cleanup. Leaderboard failures never block local victory or statistics.
- Existing local best times are synchronized after successful authorization/platform bootstrap.
- Final Yandex Console setup requires two `time` leaderboards sorted ascending. Exact settings and E2E checks are documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`.

## Current visual/input state

- Runtime card faces use stable `public/assets/cards/*.png` files; Phaser does not load SVG cards at runtime.
- The runtime deck is the unmodified Vintage set (360×480 PNGs). Card geometry and responsive sizing are unchanged.
- The board surface uses the supplied Fine Grained Wood color texture as a fullscreen tiled surface; gameplay layout and camera behavior are unchanged.
- Desktop uses `Phaser.Scale.RESIZE`: the real canvas fills the browser viewport 1:1 instead of being CSS-stretched.
- `LayoutMetrics.ts` calculates card size and all board coordinates directly from the live viewport. The main camera stays at `zoom = 1` and `scroll = 0`; `ResponsiveViewport.ts` has been removed.
- Desktop layout is hybrid: the foundation utility rail stays attached to the left edge, cards grow moderately while tableau columns keep a compact gap of about 30% of card width (hard-capped at 40%), and excess widescreen/ultrawide space centers the tableau inside the remaining play region instead of stretching it edge-to-edge.
- Text-heavy HUD controls, main menu, Daily result, and ordinary result use native DOM/HTML attached directly to the viewport host; only the remaining in-canvas symbols use Phaser Text at 2× internal resolution.
- Foundation rendering keeps the complete collected stack at each suit slot; the previous rank stays visible underneath while the next automatic card flies in.
- Tableau top position is responsive and derived from the current card height plus a constrained top-row gap; long piles compress using the actual available viewport height.
- The old empty waste placeholder rectangle is removed.
- Non-drag moves use shallow quadratic Bézier flights.
- Drop commitment uses an **overlap-area threshold**: roughly 25% of the moving card must overlap the visible target. Edge grazing and corner touches are rejected, while a clearly overlapping card no longer needs to have its center inside the target.
- Manual drag-and-drop has no settle tween in either direction: accepted drags snap directly into the destination, while rejected/cancelled drags snap immediately back to the previous placement.

## ChatGPT handoff workflow

The project uses a Git-based handoff pattern.

```bash
pnpm context
pnpm context:last
```

- `pnpm context` describes the current working tree, including uncommitted/untracked non-ignored changes.
- `pnpm context:last` describes files changed by the latest commit and is intended for a clean checkpoint handoff.
- Both refresh `TREE.txt` first.
- Bundles are written to `_chatgpt_bundle/CHATGPT_CONTEXT.txt` and each generation replaces the previous bundle.
- `PROJECT.md`, `CURRENT_STATE.md`, `TECH.md`, and `TREE.txt` are always embedded.
- Changed text/source files are embedded with full current contents.
- Changed binary assets are listed by path only; their bytes are never embedded.
- `docs/archive/**`, build output, dependencies and generated context bundles are excluded from embedded context.

## Normal verification

```bash
pnpm test
pnpm build
```

Yandex SDK smoke test:

```bash
pnpm yandex:dev
```

The solver can be regenerated separately with `pnpm generate:winnable-pool` when the C++20 toolchain configured in `package.json` is available.

## Current next focus

The local Phase C statistics/leaderboard implementation is complete. The remaining leaderboard release gate is external: create `standard_best_time` and `classic_best_time` in the Yandex Games Console exactly as documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`, then run the real draft E2E checklist. After that, platform-hardening should cover language auto-detection/localization, a unified `game_api_pause` / `game_api_resume` boundary, advertising at logical pauses, final platform declarations/mobile verification if mobile is enabled, and a release checklist that re-tests F5/session persistence in the actual Yandex environment. Economy systems (XP, coins, shop), achievements, and purchases remain intentionally outside the completed phase.
