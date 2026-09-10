# Yandex Games leaderboard setup — Cascade Solitaire

Cascade uses two built-in Yandex Games leaderboards:

- Standard ranks the player's **best consecutive win streak**.
- Daily ranks the **fastest completion of the current Daily deal**.
- Classic has no global leaderboard; it keeps personal statistics only.

## Required Console configuration

Open Yandex Games Developer Console -> select Cascade Solitaire -> Leaderboards.
Create both entries exactly as below.

### 1. Standard win streak

- Technical name: `standardwinstreak`
- Russian display name: `Стандарт — лучшая серия`
- English display name: `Standard — Best Streak`
- Main leaderboard: **Yes**
- Type: `numeric`
- Sort direction: **descending**
- Decimal part size: `0`

### 2. Daily fastest today

- Technical name: `dailyfastest`
- Russian display name: `Дейли — быстрее всех`
- English display name: `Daily — Fastest`
- Main leaderboard: **No**
- Type: `numeric` (**not `time`**)
- Sort direction: **descending**
- Decimal part size: `0`

The technical names must match `src/leaderboards/LeaderboardConfig.ts` exactly.
The game does not use `standardbesttime` or `classicbesttime` anymore.

## Why Daily is numeric instead of time

Yandex leaderboards are persistent; one board cannot automatically reset itself every UTC day. Cascade therefore uses one `dailyfastest` board and encodes both the UTC Daily date and inverse completion time into one safe integer score.

The encoded score has these ordering guarantees:

1. any score from a newer Daily date ranks above every score from an older Daily date;
2. within the same Daily date, a faster completion ranks above a slower completion;
3. the game decodes the numeric score back to normal `m:ss` before rendering it and filters the visible top rows to the current trusted Daily date.

Do not configure `dailyfastest` as a Yandex `time` leaderboard and do not make it the main leaderboard: its raw Console score is an internal encoded integer, not a human-readable duration.

## Standard streak semantics

A completed Standard win increments the current streak and updates the saved best streak. A deliberate replacement of an unfinished Standard deal resets the current streak. Restarting/restoring the same deal, opening menus, refreshing/restoring a checkpoint, and playing Classic or Daily do not manufacture a failure. Only the saved **best** streak is submitted globally.

Existing pre-v5 saves migrate with `current=0` and `best=0` because a historical consecutive streak cannot be reconstructed reliably from aggregate win/loss statistics.

## End-to-end acceptance in Yandex environment

1. Open Statistics as a guest and verify Standard and Daily public top results can load without automatic authorization.
2. Verify Classic says that it has no global leaderboard and does not call a Yandex leaderboard.
3. Sign in explicitly with Yandex ID only when no unfinished game blocks authorization.
4. Win Standard once; verify `standardwinstreak` receives `1`. Continue winning Standard and verify only a new larger best streak is submitted.
5. Deliberately replace an unfinished Standard deal; verify the current streak resets while the saved best remains.
6. Complete today's Daily; verify `dailyfastest` receives an encoded positive numeric score and the in-game table renders the result as normal elapsed time.
7. Complete the same Daily faster; verify the server score improves. A slower retry must not replace the faster same-day result.
8. On the next UTC Daily date, complete Daily and verify the newer-day encoded score outranks old-day entries; the in-game table must show only the current date's rows.
9. Confirm Classic completion never writes to either leaderboard.
10. Confirm leaderboard/network/auth failures never block local victory, rewards, statistics, restart, or menu navigation.
11. Switch Statistics tabs rapidly while loading and verify stale async responses never replace the currently selected tab.

## Expected SDK behavior / limits used by the implementation

- Public `getEntries()` is used for guest-visible top results.
- `getPlayerEntry()` and `setScore()` are used only for an authorized player.
- Protected methods remain behind the platform adapter and availability checks.
- `setScore()` writes are serialized with at least 1100 ms between actual submissions.
- Pending writes to the same active board coalesce to the largest score because both production leaderboards sort descending.
- Missing/misnamed Console configuration may surface as an unavailable/404 state until the exact technical names exist.

## Local development

Plain `pnpm dev` intentionally uses the unavailable-platform fallback, so remote leaderboard data may be unavailable.

Use:

```bash
pnpm yandex:dev
```

for SDK smoke tests. Final leaderboard acceptance must still be done against a Yandex draft/app where `standardwinstreak` and `dailyfastest` exist.
