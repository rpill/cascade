# Desktop header balance hotfix

- Desktop `.app-shell-topbar` grid changes from `1fr auto 1fr` to `auto 1fr auto`.
- The title remains in grid column 2 and is centered in the free space between the Back-to-game control and the utilities/wallet block.
- Title size and vertical offset are unchanged.
- Compact/mobile rules are unchanged.
- Coin/profile logic is unchanged.

Verification:
- RED confirmed against the old desktop grid.
- Targeted header/branding tests: 18/18 PASS.
- Full suite excluding `localization.test.ts`: 679 PASS / 0 FAIL / 2 SKIP.
