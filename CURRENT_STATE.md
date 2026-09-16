# Cascade Solitaire — Current State

## Stack

- TypeScript
- Phaser `^4.2.1`
- Vite `^7.1.3`
- pnpm
- Node built-in test runner
- Yandex Games SDK adapter + official `@yandex-games/sdk-dev-proxy` development path
- offline C++20 proof-producing solver plus TypeScript proof replay for generating a verified deal catalog

## Implemented gameplay

- Sawayama/Hikone deal and stock behavior.
- Seven tableau piles with descending alternating-colour stacking and run moves.
- Four suit foundations and safe automatic foundation moves.
- Free cell appears when the stock is exhausted.
- Classic remains random; Standard and Daily start only from the loaded verified deal catalog. Standard selection is hidden/adaptive, while Daily uses the generated date schedule.
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
- `MetaSave` is version 4. Standard (`winnable`) and Classic (`original`) persist separate `played`, `wins`, and `bestTimeMs` values; V4 also persists the hidden Standard difficulty state (`failureStreak`, `lastServedTier`, recent 256 served seeds).
- V1/V2/V3 saves migrate to V4 without losing existing progress. Existing Standard wins immediately feed the hidden difficulty curve; migrated difficulty state starts neutral. A valid previously equipped theme is retained and granted; old wins do not mint retroactive XP or coins.
- Meta mutations made before Yandex Player data finishes loading are replayed over the loaded cloud state so a fast local start/win cannot be overwritten by stale remote statistics.
- Ordinary wins finalize statistics exactly once, flush the newest meta state, clear the unfinished active checkpoint, and show a native DOM result overlay.
- The ordinary result overlay shows mode, elapsed time, best time, new-record state, wins/played, derived win rate, `ЕЩЁ ПАРТИЯ`, and `В МЕНЮ`.

## Collections, shop and progression

- The free starting theme is `walnut_study`. The published catalog sells `navy_study` and `burgundy_club` for 300 coins each; purchase unlocks the whole theme, and applying it is a separate action.
- Collection supports All/Mine filters, ownership and equipped states. Shop and collection use lightweight previews in a bounded card grid with internal vertical scrolling. Compact landscape uses horizontal cards; a single owned item never stretches across a desktop panel. New products are catalog data, independent of experimental registered themes.
- The former weekly footer on the Play page now shows player level and XP progress. Weekly indicators remain inside the Daily card; the shell wallet shows the current coin balance.
- The XP strip also shows the next-level reward (+50 coins). Daily retains seven neutral indicators when trusted time is unavailable, without inventing dates or awarding progress.
- Phone menus have wider side gutters, card/button insets and a vertical mode layout in portrait. Statistics stacks vertically and scrolls inside the panel on narrow phones.
- The settings gear opens a modal with persistent sound and Russian/English controls. SDK language initializes on first launch; manual selection wins on later launches. Language changes refresh all text without reloading the game or resetting Undo.
- `cascadePreferences` stores device settings. The Phaser audio manager respects user mute, window focus, visibility and platform pause. There are currently no music/effect assets; the controller already governs future Phaser sounds.
- Standard wins give 100 XP/25 coins; Classic gives 120/30; the first completion of each Daily gives 150/75. Repeated Daily completion can improve a record but gives no further rewards.
- The first win on a trusted UTC day gives another 50 XP/30 coins. Each level gives 50 coins; the XP needed for the next level is `100 + 50 * (level - 1)`. Weekly 3/5/7 Daily milestones award 75/150/250 coins once each.
- Result overlays show reward breakdowns and pending rewards. Stable attempt IDs survive F5; journal and completion receipts prevent replayed operations from paying twice.
- Purchases require a loaded profile. Failed reads, writes, or theme downloads have explicit retry states; failed theme loading preserves the current appearance. Applying a theme preserves the board, Undo history and timer.

## Daily / weekly retention foundation

- Daily is a technical third deal mode backed by the generated verified date schedule. The UTC Daily ID maps to one unique catalog seed for the current `dailyAlgorithmVersion`; there is no runtime hash/fallback into the Standard pool.
- Yandex Player structured data and Yandex server time are isolated behind platform-neutral persistence/time interfaces; Standard and Classic remain playable while platform initialization is unavailable or still loading.
- Daily attempts are unlimited. Restart replays the same Daily seed and starts another attempt after the board becomes playable. `НОВАЯ ИГРА` / `N` are intentionally unavailable in Daily.
- A completed Daily stores a personal best completion time; slower replays keep the previous best and faster replays replace it.
- The current UTC ISO week is shown in the main menu with completed Daily dates and 3/5/7 completion checkpoints. Missing a day does not erase other completions in the week.
- Daily uses the same generic attempt timer: it starts only after the opening/automatic chain has settled, pauses while the main menu is open or the browser tab is hidden, and stops on win.
- A Daily checkpoint discovered on reload is deferred until trusted platform time is available. Resume requires matching `dailyId`, algorithm version, and deterministic seed; stale/mismatched saves are discarded.
- Daily is disabled when trusted server time is unavailable; the game never validates or mints a production Daily from the local device clock.
- Daily completion uses a separate native DOM result overlay with elapsed time, personal best, weekly progress, retry, and menu actions.

## Platform persistence / Yandex integration

- `cascadeMeta` is the long-lived structured player save managed at runtime by `MetaSession`; `cascadeActiveGame` is a separate browser-local current-session checkpoint and includes the stable attempt ID.
- `MetaJournal` persists typed operations under `cascadeMetaJournal:<profile scope>` before applying them, replays them over loaded state, and removes them only after an acknowledged save. Writes are serialized and flushed; failed operations remain available for retry.
- When Yandex is unavailable, PlayerStorage uses `cascadePlayerData`. The economy uses strict reads/writes: storage failures cannot masquerade as a new profile or an acknowledged save. A memory-only environment is indicated in the UI.
- Journals are scoped by platform player identity. Switching accounts leaves the old journal intact and clears the old active board; authorization is unavailable while gameplay or unsaved meta operations are pending.
- The Yandex adapter dynamically loads `/sdk.js` before `YaGames.init()` in the HTTPS Yandex/proxy environment. Plain local HTTP development intentionally falls back to the unavailable-platform adapter.
- `pnpm yandex:dev` builds `dist` and launches the official Yandex SDK development proxy for local SDK smoke-testing.
- `LoadingAPI.ready()` is exposed through the platform boundary and called after platform/meta initialization reaches the current ready boundary.
- Yandex `game_api_pause` / `game_api_resume` are isolated behind the platform boundary and pause/resume the active gameplay lifecycle without creating a second timer policy.
- Startup pause state is captured before slow Player/meta loading, so restored or quickly-started boards do not run behind the startup ad.
- `GameplayAPI.start()` / `stop()` mark playable gameplay, menu transitions, visibility transitions, and completion while preserving Yandex's external pause/resume semantics.
- External platform pause freezes Phaser gameplay and checkpoints the active board; resume only restores the timer/input when menu, result, visibility, and attempt state also permit it.

## Statistics / Yandex leaderboards

- Player-facing mode language is simplified to two choices: `ИГРА` (the internal `winnable`/Standard mode) and `ДЕЙЛИ`. Classic/original remains internal legacy code but has no Home card, Statistics tab, gameplay label, or ordinary victory label. The Statistics page has only Game and Daily tabs; Game shows aggregate personal stats plus best win streak, Daily shows today's attempts/status/best time.
- Standard global competition uses `standardwinstreak`: numeric, descending, best consecutive Standard win streak. A completed Standard win increments the streak; a deliberate replacement of an unfinished Standard deal resets the current streak. Pre-v5 saves start streak tracking at zero because old aggregate stats cannot reconstruct history.
- Daily global competition uses one persistent `dailyfastest` numeric/descending board. The game encodes UTC Daily date + inverse elapsed time into one safe integer so newer dates outrank older dates and faster runs win within the same date; the UI decodes values back to normal time and filters rows to today's trusted Daily ID.
- Classic intentionally has no global leaderboard and never submits a score.
- Public top-10 browsing does not require authorization. Personal rank and score submission require Yandex authorization; the game never opens the auth dialog automatically.
- Authorization is disabled while an unfinished active game exists. If `ACCOUNT_SELECTION_DIALOG_CLOSED` fires, the page reloads so the selected Yandex progress is reacquired cleanly.
- Leaderboard writes are serialized with a 1100 ms interval and pending same-board writes coalesce to the largest score because both active boards rank descending. Server comparisons prevent overwriting a better Standard streak or a faster same-day Daily result.
- Standard best streak and today's Daily best are synchronized after successful authorized bootstrap; completion synchronization is fire-and-forget after local meta finalization and never blocks gameplay.
- Final Console setup requires `standardwinstreak` and `dailyfastest`, both numeric/descending. Exact settings and E2E checks are documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`.

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

Verified-deal factory/release commands:

```bash
pnpm deals:build-solver
pnpm deals:generate -- --standard-total 50000 --daily-days 36525 --jobs 4
pnpm deals:verify-sample
pnpm deals:report
pnpm deals:verify-all
```

`deals:generate` is resumable through ignored `artifacts/deals/` checkpoints. It publishes the binary catalog, manifest, and committed proof sample only after quotas, uniqueness, cross-pool separation, hashes, and Daily weekday bands validate. `deals:verify-all` freshly solves and TypeScript-replays every production seed; it is a long release gate, not part of the normal edit/test loop.

## Current next focus

Local collections, theme purchases with earned coins, XP/levels, RU/EN settings, statistics/leaderboards, the unified gameplay lifecycle, and the verified-deal runtime/tooling are implemented. The currently committed catalog is still the small development smoke catalog; release-size generation/verification remains the next data-production gate. The remaining leaderboard release gate is external: create `standardwinstreak` and `dailyfastest` in the Yandex Games Console as documented in `docs/YANDEX_LEADERBOARDS_SETUP.md`, then run the real draft E2E checklist, including profile persistence and economy recovery. `docs/YANDEX_UI_ACCEPTANCE.md` records the language, audio and mobile checks still needed on the actual platform. Future work includes advertising at logical pauses, audio content, achievements and release verification. Real-money purchases and multi-device conflict merging are outside this implementation.
