# Yandex Games leaderboard setup — Cascade Solitaire

This project uses two built-in Yandex Games leaderboards for ordinary modes only.
Daily intentionally has no built-in global leaderboard.

## Required Console configuration

Open Yandex Games Developer Console -> select Cascade Solitaire -> Leaderboards.
Create both entries exactly as below.

### 1. Standard best time

- Technical name: `standard_best_time`
- Russian display name: `Стандарт — лучшее время`
- English display name: `Standard — Best Time`
- Main leaderboard: **Yes**
- Type: `time`
- Sort direction: **ascending**
- Decimal part size: `0`

### 2. Classic best time

- Technical name: `classic_best_time`
- Russian display name: `Классика — лучшее время`
- English display name: `Classic — Best Time`
- Main leaderboard: **No**
- Type: `time`
- Sort direction: **ascending**
- Decimal part size: `0`

The technical names must match `src/leaderboards/LeaderboardConfig.ts` exactly.
Scores are sent in milliseconds.

## Why these settings

- `time` matches the value sent by the game (`bestTimeMs`).
- `ascending` puts the fastest completion first.
- Only one leaderboard can be main; Standard is the product default.
- Daily is excluded because a persistent built-in leaderboard would compare different daily seeds across dates.

## End-to-end acceptance in Yandex environment

Run a real draft / production-like Yandex environment after the two leaderboards exist.

1. Open the main menu and verify `ТАБЛИЦА ЛИДЕРОВ` is enabled.
2. Open it as a guest. Top-10 must be readable without signing in.
3. With no unfinished game, press `ВОЙТИ`. Authorization must appear only after this explicit button press.
4. Complete account/progress selection if Yandex shows it. The game is allowed to reload after `ACCOUNT_SELECTION_DIALOG_CLOSED`.
5. Reopen the leaderboard. The authorized player row (`Ваш результат`) should appear when the account has a score.
6. Win Standard with a new personal best. Verify `standard_best_time` receives the time in milliseconds and the in-game row formats it as time.
7. Win Standard more slowly. Verify the faster server score is preserved.
8. Improve Standard again. Verify the server score updates to the faster value.
9. Repeat the same checks for Classic and `classic_best_time`.
10. Switch Standard/Classic rapidly while loading. Stale responses must not overwrite the selected tab.
11. Start an unfinished ordinary game, open the menu and leaderboard. Top-10 remains readable, but `ВОЙТИ` is disabled until the unfinished game is no longer active.
12. Confirm Daily never writes to either ordinary leaderboard.
13. Confirm a leaderboard/network error does not block local victory, statistics, restart, or menu navigation.

## Expected SDK behavior / limits used by the implementation

- Public `getEntries()` is allowed without authorization.
- `getPlayerEntry()` and `setScore()` require authorization.
- The game calls `isAvailableMethod()` before protected leaderboard methods.
- `setScore()` writes are serialized with at least 1100 ms between actual submissions.
- Multiple pending scores for one leaderboard coalesce to the best (lowest) time.
- Missing leaderboard configuration may surface as a 404/unavailable state until the Console entry is created.

## Local development

Plain `pnpm dev` intentionally uses the unavailable-platform fallback, so the leaderboard button may remain disabled.

Use:

```bash
pnpm yandex:dev
```

for SDK smoke tests. Final leaderboard acceptance must still be done against a Yandex draft/app where the two Console leaderboards actually exist.
