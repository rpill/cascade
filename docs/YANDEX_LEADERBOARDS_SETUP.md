# Yandex Games leaderboard setup — Cascade Solitaire

Cascade uses four Yandex Games leaderboards.

| Technical name | RU display name | EN display name | Main | Type | Sort | Decimals |
| --- | --- | --- | --- | --- | --- | --- |
| `standardwinstreak` | Обычная — серия побед | Standard — Win Streak | Yes | numeric | descending | 0 |
| `dailyfastest` | Daily — сегодня | Daily — Today | No | numeric | descending | 0 |
| `dailystreak` | Ежедневная серия | Daily Streak | No | numeric | descending | 0 |
| `cascademastery` | Мастерство | Mastery | No | numeric | descending | 0 |

Technical names must match `src/leaderboards/LeaderboardConfig.ts` exactly.

## Product meaning

- **Standard / Обычная**: best consecutive Standard win streak.
- **Daily**: only the current trusted Daily deal. The encoded numeric score sorts by current date first, then fewer moves, then faster time. The game renders the decoded columns `Moves / Time`.
- **Daily Streak / Ежедневная серия**: current on-time Daily streak first, best historical streak second.
- **Mastery / Мастерство**: Mastery rank first, lifetime Mastery points second.

All four boards use numeric descending scores. Do not configure `dailyfastest` as a time board: its raw value is an internal encoded integer.

## Local development fixtures

On localhost the leaderboard screen can use deterministic fixture rows so layout, top-3, scrolling and the pinned player row can be tested without real players.

- `?leaderboardFixtures=1` forces fixtures on.
- `?leaderboardFixtures=0` forces fixtures off.

Production domains do not enable fixtures automatically.
