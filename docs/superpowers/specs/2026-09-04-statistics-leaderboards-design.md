# Cascade Solitaire — Statistics & Yandex Leaderboards Design

Date: 2026-09-04  
Status: approved product direction; implementation plan follows after spec review.

## 1. Goal

Expose the ordinary-mode statistics already persisted in `MetaSave V2` and add competitive Yandex Games leaderboards without making authorization mandatory for playing the game.

Phase C in this spec covers:

- persistent Standard/Classic statistics available from a dedicated no-scroll statistics modal opened from the main menu;
- two Yandex Games best-time leaderboards;
- a native DOM leaderboard overlay;
- explicit opt-in Yandex ID authorization from that overlay;
- safe synchronization of local/cloud best times to Yandex leaderboards;
- graceful behavior when Yandex SDK, authorization, or leaderboard configuration is unavailable.

This phase does **not** change solitaire rules, Daily seed generation, Daily/Weekly progress, ordinary statistics semantics, card visuals, or active-game persistence.

## 2. Product decisions

### 2.1 No-scroll menu and modal navigation

The game UI must never rely on vertical or horizontal scrolling. The main menu must fit entirely inside the current viewport, and modal overlays must also fit without scrollbars. On shorter viewports, reduce spacing, padding, and typography with responsive CSS rather than introducing `overflow:auto` or `overflow:scroll`.

The main menu remains focused on primary navigation:

```text
ГЛАВНОЕ МЕНЮ

СТАНДАРТ
КЛАССИКА
ИСПЫТАНИЕ ДНЯ

НЕДЕЛЯ 36 · 0/7

[ СТАТИСТИКА ] [ ТАБЛИЦА ЛИДЕРОВ ]

[ ЗАКРЫТЬ ]  // only when a board can be resumed
```

Future secondary systems such as `МАГАЗИН` follow the same pattern: a compact main-menu action opens a dedicated fixed modal. Do not append large secondary sections to the main menu.

### 2.2 Statistics modal

`СТАТИСТИКА` opens a separate native DOM modal in the same parchment/bronze visual language as the existing menu/completion UI. It displays the ordinary statistics already stored in `MetaSave V2`:

```text
СТАТИСТИКА

СТАНДАРТ
Партий: 12
Побед: 7
Процент побед: 58%
Лучшее время: 03:58

КЛАССИКА
Партий: 5
Побед: 2
Процент побед: 40%
Лучшее время: 07:21

[ ЗАКРЫТЬ ]
```

Rules:

- Standard maps to `winnable`.
- Classic maps to `original`.
- win rate is derived as `Math.round(wins / played * 100)`; it is not persisted separately.
- when `played === 0`, display `0%`.
- when there is no successful completion, display `Лучшее время: —`.
- local statistics remain available even if Yandex services are unavailable.
- opening/closing the modal does not alter the active deal or flow state.
- `Esc` closes the statistics modal before it closes/cancels the underlying main menu.
- the modal itself must never scroll.

### 2.3 Two ordinary leaderboards only

Create exactly two Yandex Games leaderboards:

| Game mode | Technical name | Console type | Sort | Main |
| --- | --- | --- | --- | --- |
| Standard (`winnable`) | `standardbesttime` | `time` | ascending (`ASC`) | yes |
| Classic (`original`) | `classicbesttime` | `time` | ascending (`ASC`) | no |

Scores are elapsed milliseconds. Technical leaderboard names must satisfy the Yandex Console restriction `^[a-zA-Z0-9]+$`; do not use underscores, hyphens, or spaces.

`standardbesttime` is the primary leaderboard shown on the game card because Standard is the default/recommended ordinary mode.

No Daily leaderboard is added in this phase. A permanent Yandex leaderboard would mix different Daily seeds/dates and produce a misleading comparison. Daily competition remains a future custom-backend feature if needed.

### 2.4 Leaderboard overlay

`ТАБЛИЦА ЛИДЕРОВ` opens a separate native DOM overlay in the same parchment/bronze visual language as `MainMenuView`, `DailyCompleteView`, and `GameCompleteView`.

The overlay contains:

```text
ТАБЛИЦА ЛИДЕРОВ

[ СТАНДАРТ ] [ КЛАССИКА ]

1. Player A      02:41
2. Player B      02:58
...
10. Player J     04:03

Ваш результат
42. Вы           05:17

[ ЗАКРЫТЬ ]
```

Behavior:

- default tab is Standard;
- switching tabs loads that mode on demand;
- request top 10 only;
- ranks shown to the user are one-based (`SDK rank + 1` when SDK rank is zero-based);
- score formatting is owned by the game UI, not copied from localized SDK text;
- no avatars in the first version; show public name, rank, and time only;
- long names must truncate rather than distort the overlay;
- the top-10 layout must fit in the modal without any scrollbars; if a future version needs more rows, use pagination rather than scrolling;
- loading, empty, unavailable, and error states must be explicit and non-blocking;
- closing the overlay returns to the underlying menu/game state without starting or replacing a deal.

Leaderboard data is fetched only when the overlay opens or the mode tab changes. Do not poll in the background.

## 3. Guest and authorization behavior

Authorization is optional for the entire game.

### Guest

A guest may:

- play Standard, Classic, and Daily normally;
- keep local/cloud-fallback progress according to the existing platform behavior;
- open the leaderboard overlay;
- see the public top 10 through `getEntries()`.

A guest does not have a personal Yandex leaderboard entry because Yandex requires authorization for `setScore()` and `getPlayerEntry()`.

Public leaderboard browsing remains available while an existing game is paused in the menu. However, if an unfinished active game exists, the authorization button is disabled and the overlay explains that the current game must be completed first. This prevents the browser-local active-game checkpoint from being resumed against a different account MetaSave after Yandex account/progress selection. Authorization is allowed when there is no active game or the current board is already completed.

The overlay shows an explanatory CTA beneath the public top:

```text
Войдите с Яндекс ID, чтобы сохранить рекорд
и увидеть своё место в таблице.

[ ВОЙТИ ]
```

### Authorization

`ysdk.auth.openAuthDialog()` is called **only** after the player explicitly presses `ВОЙТИ`.

Do not show an authorization dialog:

- at game startup;
- after a win;
- when the menu opens;
- merely because a local best time exists;
- while an unfinished active game exists.

After successful authorization:

1. reacquire the Yandex `Player` object;
2. mark platform auth state as authorized;
3. synchronize any existing Standard/Classic local best times to the appropriate leaderboards;
4. reload the currently selected leaderboard;
5. show the player's own rank/result if present.

Yandex may additionally show its account/progress selection dialog when a guest progress and an authorized-account progress both exist. Subscribe to `ACCOUNT_SELECTION_DIALOG_CLOSED`. Because the leaderboard is entered from the paused/checkpointed main menu, closing that platform dialog triggers a page reload so normal bootstrap loads the progress chosen by the player. Do not attempt to merge or overwrite the two competing player saves client-side in this phase.

If authorization is cancelled or fails, keep the public top visible and show a small non-fatal status message. Gameplay and local statistics remain unaffected.

## 4. Source of truth and synchronization

### 4.1 MetaSave remains the game-stat source of truth

`MetaSave V2.stats` remains authoritative for in-game statistics:

- `played`;
- `wins`;
- `bestTimeMs`.

Yandex leaderboard data is a competitive projection of `bestTimeMs`, not a replacement for MetaSave.

Do not import leaderboard `score` back into `played` or `wins`, and do not use leaderboard availability to gate local stat updates.

### 4.2 When to submit a score

Submit only ordinary `bestTimeMs` values.

Synchronization happens in two cases:

1. **Platform/auth bootstrap:** after MetaSave has loaded and the player is already authorized, sync existing Standard/Classic bests. This covers players who earned records before the leaderboard feature was added or on another session.
2. **New ordinary record:** after `completeModeAttempt()` reports `improvedBest === true`, request a background sync for that mode if the player is authorized.

A normal slower win does not call `setScore()`.

Never submit Daily times.

### 4.3 Never overwrite a better server result

The Yandex SDK documentation describes `setScore()` as setting a score; the client must not assume it automatically preserves the better existing value.

For a sync of `(leaderboard, localBestMs)`:

1. check authorization and method availability;
2. read the player's current server entry;
3. if there is no entry, submit `localBestMs`;
4. if the server score is greater than `localBestMs`, submit the smaller local time;
5. if the server score is less than or equal to `localBestMs`, do nothing.

`LEADERBOARD_PLAYER_NOT_PRESENT` is a normal "no score yet" state, not an error shown to the player.

### 4.4 Rate limiting and deduplication

Yandex limits `leaderboards.setScore()` to one request per second.

All writes therefore pass through a single serialized submission queue with at least ~1100 ms between actual `setScore()` calls. This matters during initial sync because Standard and Classic may both have historical best times.

The queue should coalesce redundant pending writes per technical leaderboard, retaining the best (smallest) time requested for that board.

Reads are not polled:

- `getEntries()` only on overlay open/tab switch/manual refresh after auth;
- `getPlayerEntry()` only when an authorized personal entry or write comparison is needed.

## 5. Architecture

### 5.1 Platform boundary stays generic

Extend `src/platform/services.ts` instead of importing Yandex SDK types directly into `GameScene` or DOM views.

Conceptual platform capabilities:

```ts
export interface PlatformAuth {
  isAuthorized(): boolean;
  requestAuthorization(): Promise<boolean>;
}

export interface PlatformLeaderboardEntry {
  rank: number;
  score: number;
  playerId: string;
  publicName: string;
}

export interface PlatformLeaderboards {
  readonly available: boolean;
  getEntries(
    technicalName: string,
    options: { quantityTop: number },
  ): Promise<PlatformLeaderboardEntry[]>;
  getPlayerEntry(
    technicalName: string,
  ): Promise<PlatformLeaderboardEntry | null>;
  setScore(technicalName: string, score: number): Promise<void>;
}
```

`PlatformServices` gains `auth` and `leaderboards`.

The exact final signatures may be adjusted during implementation if SDK error normalization requires it, but these rules are fixed:

- platform layer owns SDK calls and SDK-specific errors;
- game/domain layer owns mode-to-leaderboard mapping and best-time semantics;
- views receive plain state/actions and never touch SDK/platform objects.

Unavailable/browser fallback implementation:

- `auth.isAuthorized() === false`;
- `requestAuthorization()` returns `false` without throwing;
- `leaderboards.available === false`;
- leaderboard reads/writes fail gracefully through normalized unavailable behavior;
- ordinary local statistics continue working.

### 5.2 Yandex adapter

`src/platform/yandex.ts` extends the existing SDK adapter with current APIs:

- `player.isAuthorized()`;
- `ysdk.auth.openAuthDialog()`;
- direct `ysdk.leaderboards.*` methods;
- `ysdk.isAvailableMethod(...)` before protected methods where required.

Do **not** use deprecated `ysdk.getLeaderboards()`.

After auth dialog success, reacquire `ysdk.getPlayer()` so subsequent auth/player state reflects the signed-in account.

### 5.3 Game-specific leaderboard service

Create a small game/domain service, tentatively:

```text
src/leaderboards/LeaderboardService.ts
src/leaderboards/LeaderboardConfig.ts
```

Responsibilities:

- map `winnable -> standardbesttime`;
- map `original -> classicbesttime`;
- reject `daily` at the type boundary;
- normalize top entries into UI-safe data;
- sync local best to server without overwriting a better server score;
- serialize/coalesce `setScore()` writes to obey the one-per-second limit;
- expose a simple load result for the view/controller.

It must not know Phaser or DOM.

### 5.4 Main menu and statistics view

`MainMenuView` gains only compact secondary actions:

- `statistics` action/button;
- `leaderboard` action/button;
- platform leaderboard availability state.

It does **not** render ordinary stat rows directly. The main menu remains a passive, no-scroll DOM view.

Create:

```text
src/game/view/StatisticsView.ts
```

`StatisticsView` receives plain Standard/Classic statistics state and a `close` action. It owns formatting/rendering only and never reads MetaSave or platform services. `GameScene` builds the statistics state from `MetaSave V2.stats`, opens the modal from the main-menu action, keeps it current when MetaSave changes, and ensures `Esc` closes the modal before the underlying menu.

### 5.5 Leaderboard view

Create:

```text
src/game/view/LeaderboardView.ts
```

Conceptual state:

```ts
interface LeaderboardViewState {
  mode: 'winnable' | 'original';
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  entries: readonly LeaderboardRow[];
  authorized: boolean;
  playerEntry: LeaderboardRow | null;
  authPending: boolean;
  message?: string;
}
```

Conceptual actions:

```ts
interface LeaderboardViewActions {
  selectMode(mode: OrdinaryGameMode): void;
  authorize(): void;
  close(): void;
}
```

The view owns rendering only. Network races are handled by the coordinator/service; stale responses from a previous tab selection must not overwrite the currently selected tab.

### 5.6 GameScene coordination

`GameScene` owns the view lifecycle and invokes leaderboard service operations, but contains no raw Yandex calls.

Integration points:

- after platform + MetaSave load: construct/activate leaderboard service and refresh menu availability;
- if already authorized: background-sync historical ordinary bests;
- menu `ТАБЛИЦА ЛИДЕРОВ`: open overlay and load Standard top;
- overlay tab switch: load selected top;
- `ВОЙТИ`: request authorization, then sync existing bests, then reload selected board/personal row;
- ordinary new record: background-sync only that mode;
- scene shutdown: invalidate outstanding view updates; no response may resurrect a destroyed overlay.

Leaderboard network failures must never block or roll back MetaSave completion/statistics writes.

## 6. Loading, error, and race behavior

### Platform unavailable

Statistics modal remains fully functional. Leaderboard button is disabled or clearly marked unavailable. No errors leak into gameplay.

### Leaderboard not configured / SDK 404

Show `Таблица лидеров временно недоступна` in the overlay (or disable the button after capability/config detection). Do not crash and do not retry continuously.

### Empty leaderboard

Show a normal empty state: `Пока нет результатов`.

### Slow network / tab switching

Each load has a monotonically increasing request token. Only the latest request for the currently selected mode may update the overlay.

### Close while loading

The promise may finish, but its result must not reopen or mutate a hidden/destroyed view.

### Auth during open overlay

Disable `ВОЙТИ` while the auth dialog is pending. On success, sync and reload. On cancel/failure, re-enable it and retain the already-loaded public top.

## 7. Console setup required for live verification

Before real leaderboard calls can succeed in a Yandex draft, create both leaderboard definitions in the Yandex Games Console with the exact technical names:

```text
standardbesttime
classicbesttime
```

Both:

- type: `time`;
- score unit: milliseconds;
- sort: ascending;
- decimal part: 0.

Mark only `standardbesttime` as the main leaderboard.

If the console technical name differs from the code constant, Yandex returns 404; therefore these names are treated as release configuration constants and must be documented in the moderation/release checklist.

## 8. Testing strategy

Tests must protect behavior, not visual pixel constants.

### Platform adapter tests

Verify:

- unavailable platform reports leaderboards unavailable and auth false;
- authorized state comes from `player.isAuthorized()`;
- auth dialog is invoked only by explicit adapter method;
- player is reacquired after successful auth;
- current direct `ysdk.leaderboards` API is used;
- protected methods use `isAvailableMethod` where required;
- `LEADERBOARD_PLAYER_NOT_PRESENT` normalizes to `null`;
- SDK failures do not crash fallback gameplay services.

### Leaderboard service tests

Verify:

- exact mode/name mapping;
- Daily cannot be passed as an ordinary mode;
- top entries normalize ranks/names/scores;
- server-better score is never overwritten;
- local-better score is submitted;
- absent server entry is submitted;
- slower ordinary win does not cause a submission at scene level;
- queued writes are serialized beyond the one-second SDK limit;
- pending writes for the same board coalesce to the smallest score.

### Main menu tests

Verify:

- Standard and Classic played/wins/win-rate/best are rendered;
- zero/no-best states render sensibly;
- leaderboard action is wired;
- unavailable platform state does not hide local stats;
- tests do not assert exact sizes/colors.

### Leaderboard view tests

Verify:

- Standard/Classic tabs;
- top rows and one-based ranks;
- personal result section;
- guest CTA;
- `ВОЙТИ` action;
- loading/empty/error/unavailable states;
- close action;
- no pixel-style assertions.

### Scene integration tests

Verify:

- platform/meta bootstrap makes stats visible;
- authorized startup syncs historical bests;
- guest startup does not submit or invoke auth;
- improved ordinary best triggers background sync;
- slower win does not;
- Daily completion never touches ordinary leaderboards;
- explicit login syncs both existing bests and reloads current board;
- stale async responses cannot overwrite a later selected leaderboard tab.

## 9. Manual acceptance

### Local/fallback

- ordinary menu stats survive F5;
- stats work with plain `pnpm dev` even though leaderboard service is unavailable;
- no authorization dialog appears automatically.

### Yandex dev/draft

- public top 10 opens for a guest;
- guest sees login explanation and `ВОЙТИ`;
- pressing `ВОЙТИ` is the only path that opens auth dialog;
- after login, existing best is synchronized and personal place appears;
- new faster Standard result updates `standardbesttime`;
- slower Standard result does not replace it;
- Classic writes only to `classicbesttime`;
- Daily never writes either leaderboard;
- two historical bests at login/bootstrap do not violate the one-write-per-second limit;
- a missing/misnamed Console leaderboard yields a graceful unavailable/error state, not a crash.

## 10. Explicit non-goals

Not in this phase:

- Daily leaderboard;
- custom leaderboard backend;
- anonymous-user custom ranking;
- achievements/currency/rewards for leaderboard rank;
- avatars;
- friends-only leaderboard;
- pagination beyond top 10;
- automatic login prompts;
- leaderboard data as a replacement for MetaSave;
- ads/localization/platform pause work from the separate pre-release roadmap.

## 11. External constraints checked on 2026-09-04

The implementation plan must preserve these current Yandex Games SDK constraints:

- use direct `ysdk.leaderboards` methods; `ysdk.getLeaderboards()` is deprecated;
- `setScore()` requires authorization and is limited to one request per second;
- `getPlayerEntry()` requires authorization;
- `getEntries()` does not require authorization and is limited to 20 requests per 5 minutes;
- time leaderboard scores are milliseconds;
- speed leaderboards should use ascending sort;
- authorization dialog should follow a conscious user action and explain the benefit;
- when Yandex closes its account/progress selection dialog, reload/reinitialize player data so the chosen progress becomes authoritative;
- leaderboard technical names must exist in the Console or SDK calls return 404.

Reference documentation:

- Yandex Games SDK — Leaderboards: https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard
- Yandex Games — Leaderboards concept/Console setup: https://yandex.ru/dev/games/doc/ru/concepts/leaderboards
- Yandex Games SDK — Player data / authorization: https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- Yandex Games requirement 1.2 — Authorization: https://yandex.ru/dev/games/doc/ru/requirements/1/2
- Yandex Games SDK — Events / account selection dialog: https://yandex.ru/dev/games/doc/ru/sdk/sdk-events
