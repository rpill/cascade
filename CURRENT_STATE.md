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

- The existing Yandex player-storage, auth, ads and Yandex leaderboard path is unchanged.
- Pikabu is the only user-facing identity/platform SDK for the Pikabu build.
- Guests remain fully local-first. Authorized players obtain a short-lived bridge session only after the Worker verifies Pikabu `getSignedData()`.
- Pikabu runtime is `Pikabu SDK -> Cloudflare Worker -> D1`; D1 database `cascade-db` stores the cloud profile and four Pikabu leaderboard datasets.
- The browser has no third-party provisioning/login SDK path.
- Daily first-result semantics are enforced by the D1 key `(pikabu_id, daily_id)`; exact retries are idempotent and changed replays cannot replace the accepted row.
- Browser bundles receive only public `VITE_BACKEND_URL`; `PIKABU_GAME_SECRET` and `BRIDGE_SESSION_SECRET` remain Worker-only.
- D1 setup is `pnpm backend:setup:d1`; it creates/reuses the database, binds `DB`, and applies migrations without manual UUID editing.
- **Release gates still required locally:** `pnpm test`, `pnpm build`, `pnpm build:pikabu`, `pnpm backend:test`, Worker smoke, two-browser Pikabu acceptance, four leaderboard checks, Daily replay immutability, and the Cloudflare `1102` CPU gate.
- **Hosting gate still open:** written confirmation that the selected hosting plan permits the monetized game.
