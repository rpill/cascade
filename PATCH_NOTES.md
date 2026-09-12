# Cascade release UI fixes

Base: `cascade(20260912-202103).zip`

Changes:
- Statistics summary restored to four equal full-width vertical rows.
- Visible leaderboard rows are numbered contiguously (1, 2, 3...) even if the platform omits hidden entries; the signed-in player's displayed rank follows the visible top when their row is present. Applies to Game and Daily.
- Sign-in block reserves a safe area from the decorative bottom corners.
- Purchase dialog active buttons use pointer cursors; disabled buttons use the default cursor.
- Purchase close control keeps the same visible circle but has a larger 52x52 clickable target (46x46 in short landscape).

Verification:
- New regression tests: 5/5 PASS.
- Related Statistics/Leaderboard/Purchase/Platform tests: 45/45 PASS.
- Full suite excluding `tests/localization.test.ts`: 684 PASS / 0 FAIL / 2 SKIP.
- `tests/localization.test.ts` cannot run in this container because the uploaded archive does not include the `typescript` package and `pnpm` is unavailable here.
