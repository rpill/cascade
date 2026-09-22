Cascade victory screen rework — 2026-09-16

Based on user archive: cascade(20260916-131921).zip

Changes:
- Shared landscape victory layout for desktop and mobile landscape.
- Two clear sections: Rewards and Mastery.
- Standard rewards are split into base win reward, rank reward, and total.
- Rewarded x2 clearly doubles only the base win reward.
- Before ad: e.g. +5 win +100 rank = 105 total.
- After ad: +10 win +100 rank = 110 total.
- Reward button now says e.g. DOUBLE +5 / УДВОИТЬ +5.
- Standard victory result now displays moves alongside time.
- Mastery promotion text is shown inside the Mastery panel.
- Daily completion uses the same landscape two-column presentation when Mastery changes.
- Added RU/EN localization strings for the new presentation.

Verification in container:
- 33/33 related tests passed.
- TypeScript transpile/syntax checks passed for all 7 changed production files.
- English localization duplicate-key check: 0 duplicates.
- Full pnpm build was not run because the container does not have the project node_modules installed.

---

Pikabu Cloudflare D1 backend migration — 2026-09-22

Based on user archive: cascade(20260921-224946).zip

Changes:
- Replaced Pikabu cloud persistence/leaderboards with Cloudflare Worker + D1.
- Added `CascadeStore` and a D1 adapter plus migrations for players, profiles and all four leaderboard datasets.
- Simplified `/v1/session` to verified Pikabu `signedData` -> bridge JWT with no browser provisioning step.
- Removed the legacy third-party browser SDK/login path and related runtime/tooling.
- Preserved local-first BASE / LOCAL / CLOUD merge behavior and the existing frontend HTTP contract.
- Enforced first-result-only Daily persistence through primary key `(pikabu_id, daily_id)`; exact retries remain idempotent.
- Added idempotent `pnpm backend:setup:d1` to create/reuse `cascade-db`, write the `DB` binding and apply migrations.
- Worker secrets are now only `PIKABU_GAME_SECRET` and `BRIDGE_SESSION_SECRET`.
- Yandex platform behavior remains intentionally unchanged.

Verification in this sandbox:
- Focused D1/store/session/Worker/config tests are run with Node 22 type stripping.
- Full `pnpm test`, `pnpm build`, `pnpm build:pikabu`, Worker dry build and live D1/deploy remain operator gates because this sandbox cannot install project dependencies from npm.
- Real Pikabu two-browser profile sync, four leaderboards, Daily replay immutability and Worker `1102` observability remain live release gates.
