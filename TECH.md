# Cascade Solitaire — Technical Notes

## Runtime architecture

- `src/game/model/` — solitaire rules, deal generation, history and verified-deal logic.
- `src/game/scenes/BootScene.ts` — preloads the fixed game appearance, card faces and UI assets.
- `src/game/scenes/GameScene.ts` — gameplay coordinator, persistence checkpoints, lifecycle and result synchronization.
- `src/game/appearance/GameAppearance.ts` — the single fixed table/card-back/control palette contract.
- `src/game/appearance/GameAppearanceAssets.ts` — assets required by that fixed appearance.
- `src/game/view/` — board rendering, cards, motion, geometry and gameplay-only views.
- `src/ui/` — Phaser product screens and reusable shell/components.
- `src/meta/` — v9 player state, Daily, Mastery, statistics, operation journal/session and merge logic.
- `src/leaderboards/` — score encoding, load/sync policy and fixtures.
- `src/platform/` — Yandex/browser adapters for player storage, auth, leaderboards, lifecycle and fullscreen ads.
- `src/settings/` — local language/audio preferences.
- `src/localization/` — RU/EN copy.

## Product UI

- `HomeScene` exposes Standard controls plus Daily, Mastery and Leaders.
- `DailyScene`, `MasteryScene`, `LeaderboardsScene`, `SettingsScene` and `HowToPlayScene` share `SceneShell`.
- Home and the gameplay table intentionally do not use `SceneShell`.
- Non-gameplay actions use the shared rounded button surfaces; gameplay HUD keeps its table-specific controls.
- Panel artwork is presentation-only and is muted by `PaperPanel` / `UiSurface` washes.

## Persistence

- `MetaSave` v9 contains gameplay/meta progress only.
- `MetaSession` serializes acknowledged operations through platform PlayerStorage.
- `MetaJournal` keeps operations durable until the corresponding profile write succeeds.
- Active deal state is stored separately by `ActiveGameRepository`.
- Legacy profile fields no longer used by the product are ignored during normalization.

## Rendering constraints

- Phaser 4 runs with antialiasing and `pixelArt: false`.
- Do not add `GameConfig.resolution`; HiDPI backing-store handling is explicit.
- Keep gameplay rules out of renderer objects where practical.
- Undo remains transactional: one undo restores the full player action plus its automatic-foundation chain.
- Manual drag success/failure snaps immediately; motion tweens are for deal/automatic motion only.

## Platform constraints

- Browser fallback must keep ordinary local play functional when Yandex APIs are absent.
- Leaderboard/auth failures are non-fatal to gameplay.
- Fullscreen ads are optional and shown only at logical pauses/transitions.

## Platform-independent backend / Pikabu

- `src/backend/` — target-neutral HTTP client, profile API wrapper, backend leaderboard adapter and public backend URL config.
- `src/cloud/` — cloud snapshot, semantic merge, per-identity durable sync state and local-first coordinator.
- `src/platform/pikabu.ts` — Pikabu SDK loader/auth/identity adapter; guest player data remains in browser storage.
- `supabase/migrations/` — Postgres schema/RPCs for identities, revisioned cloud profiles, Daily results, leaderboard rows and idempotency.
- `supabase/functions/cascade-api/` — Pikabu signed-data verification and the profile/leaderboard HTTP API.
- `supabase/tests/` — pgTAP database contract.

The browser never receives `PIKABU_GAME_SECRET` or a Supabase service-role credential. `VITE_BACKEND_URL` is public by design. Backend failure must not prevent game startup or local persistence; sync/leaderboard mutations remain pending and retry later.

`pnpm build` remains the normal/default build. `pnpm build:pikabu` selects Vite mode `pikabu`; `.env.pikabu.local` is intentionally untracked.

Backend deployment uses Supabase Edge Functions. `--use-api` is required by the documented deploy path because the function reuses pure TypeScript modules outside `supabase/functions/`.
