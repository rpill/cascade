# Cascade Solitaire — Current State

## Product

- RU title: **Пасьянс Каскад**.
- EN title: **Cascade: Solitaire Puzzle**.
- Core modes: Standard (Easy / Medium / Hard), Daily and the original/classic deal flow.
- Long-term progression is **Mastery**.
- Home secondary destinations: **Daily / Mastery / Leaders**.
- Leaderboards cover Standard best streak, Daily result, Daily streak and Mastery.
- There is no separate statistics destination; records are surfaced contextually.

## Visual system

- Product screens use the shared Phaser UI shell and European botanical presentation.
- Home and the gameplay table intentionally keep their own compositions.
- Gameplay uses one fixed `GameAppearance`.
- Board surface: `public/assets/game/board-surface.webp`.
- Card back: `public/assets/cards/redBack.webp`.
- Product panels use scene-specific artwork crops and muted paper washes for readability.

## Progress / persistence

- Player meta save schema: **v9**.
- Legacy saves normalize into v9 while preserving Standard, Daily, Mastery, records and attempt receipts that are still relevant.
- Active-game persistence remains separate from long-lived player meta.
- Mastery advances from wins/difficulty/Daily requirements and has no separate spendable resource.

## Platform

- Yandex integration keeps player storage, auth, leaderboards, lifecycle/gameplay markup and fullscreen interstitial ads.
- Interstitials are shown only at logical deal transitions.
- Daily uses trusted platform time when available and keeps the 90-day archive behavior.

## Release priorities

1. Finish visual polish across non-gameplay screens and mobile landscape.
2. Validate all leaderboards in a real Yandex draft.
3. Run profile persistence / Daily / Mastery E2E on the platform.
4. Finalize audio, responsive spacing and release packaging.

## Pikabu / platform-independent backend (implementation branch)

- Phase 1 keeps the existing Yandex player-storage and Yandex leaderboard path unchanged.
- Pikabu uses browser-local guest progress; authorized players can merge/sync through the platform-independent Supabase backend.
- Cloud profile sync uses BASE / LOCAL / CLOUD semantic merge, revision CAS, persistent idempotent operations and offline backoff.
- Pikabu backend leaderboards use structured submissions; Daily first official result is protected by backend uniqueness and Daily streak is derived server-side.
- Pikabu client build mode is `pnpm build:pikabu` with public `VITE_PLATFORM_TARGET` / `VITE_BACKEND_URL` values only.
- Backend schema, Edge Function and pgTAP contracts are present in `supabase/`.
- **Verification pending outside this sandbox:** local/remote Supabase pgTAP run, full pnpm build/test, two-browser Pikabu Studio smoke test, and Yandex production smoke test.
- **Release gate still open:** written confirmation that the selected GitVerse Pages Free plan permits hosting the monetized game.
