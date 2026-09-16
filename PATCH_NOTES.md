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
