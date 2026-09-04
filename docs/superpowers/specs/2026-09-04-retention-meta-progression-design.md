# Cascade Solitaire — Retention, Meta & Progression Design

**Date:** 2026-09-04  
**Status:** Approved  
**Scope:** Post-core product loop for Yandex Games  

## 1. Purpose

Cascade Solitaire keeps the solitaire itself as the primary game and adds a light meta layer that gives players reasons to return without turning the project into a mobile grind game.

The target product model is **light meta (Option B)**:

- deterministic daily challenge;
- weekly participation milestones;
- persistent statistics;
- mastery XP and player level;
- one soft currency;
- cosmetic collection and simple shop;
- achievements;
- restrained ad monetization;
- no gameplay advantage sold for money or soft currency.

The meta layer must remain optional. A player who only wants to play solitaire must be able to ignore almost all of it.

---

## 2. Product principles

### 2.1. Solitaire first

Meta systems must never make the core game less readable, slower to access, or intentionally frustrating.

### 2.2. Return motivation, not obligation

The game should create reasons to return through fresh challenges and visible progress, not by threatening the player with loss.

### 2.3. One simple economy

There is at most one free in-game currency. No premium currency is required for the first release.

### 2.4. Cosmetics only

Progression and currency unlock visual customization. They do not alter solitaire legality, solvability, free-cell behavior, draw rules, undo behavior, or any other gameplay rule.

### 2.5. No dark-pattern retention

The following are explicitly out of scope:

- energy;
- lives;
- loot boxes;
- random reward chests;
- boosters;
- purchasable undo;
- purchasable hints that intentionally make the free experience worse;
- login streaks that reset to zero after a missed day;
- rotating FOMO shops;
- multiple currencies;
- tasks whose main purpose is to force ad viewing;
- mandatory daily chores.

---

## 3. Game modes

The product exposes three ways to play.

### 3.1. Standard Game

Working user-facing name: **New Game** / **Standard**.

- Uses the existing solver-proven Winnable seed pool.
- This is the default way to play.
- Every offered deal is known to be solvable by the offline solver pipeline.
- A new game uses a fresh seed from the proven pool.
- Restart keeps the same seed.

The current technical term `Winnable` should not be prominent in player-facing UI.

### 3.2. Classic / Original

Working user-facing name: **Classic**.

- Uses the existing reverse-engineered Hikone/Sawayama RNG and deal behavior.
- Some deals may be unsolvable.
- This is presented as the authentic/random challenge for experienced players.
- It remains available from the start and is not locked behind progression.

### 3.3. Daily Challenge

A single deterministic challenge is available for each UTC calendar day.

Properties:

- one deal per UTC date;
- the same date maps to the same deal for all players on the same released daily algorithm version;
- the deal must come from the solver-proven pool;
- attempts are unlimited;
- losing does not consume anything;
- restarting the Daily restarts the same deal;
- completing the Daily marks that date as completed;
- additional successful attempts remain allowed;
- the player's **best completion time** for that Daily is retained.

Daily is the main retention feature.

---

## 4. Daily identity and trusted time

### 4.1. Clock

The canonical date source is Yandex Games `ysdk.serverTime()`.

Daily and weekly boundaries use **UTC**, not the player's device clock.

If server time is temporarily unavailable, the game may continue ordinary solitaire play, but must not issue a new Daily/Weekly reward based only on an untrusted changed device clock.

### 4.2. Daily ID

Canonical format:

```text
YYYY-MM-DD
```

Example:

```text
2026-09-04
```

### 4.3. Daily deal mapping

The mapping is deterministic:

```text
UTC date
  -> stable date hash
  -> index in frozen solver-proven seed pool
  -> Daily seed
```

Requirements:

- the hash function and pool ordering are frozen once shipped;
- changing the pool must not silently remap an already active Daily;
- if the mapping algorithm ever changes, it receives an explicit `dailyAlgorithmVersion` and changes only on a future UTC boundary;
- the save data stores completed Daily IDs, not only an integer streak.

This avoids needing a daily database row or manually authored server schedule.

---

## 5. Daily timing rules

The Daily result is **completion + personal best time**.

### 5.1. Attempt timer

The timer:

- starts when the initial deal animation is complete and player input becomes available;
- stops when the win state is reached;
- is per attempt;
- resets when the player explicitly restarts the Daily;
- pauses when the game is not in an active playable state, including platform ad presentation and page/background suspension where reliable visibility events are available;
- does not include time spent in the main menu or reward screen.

### 5.2. Undo

Undo is allowed in Daily.

Undo count is recorded as a statistic but is **not** part of the primary Daily score in the first version.

### 5.3. Best result

For each Daily ID, save:

```ts
{
  completed: true,
  bestTimeMs: number,
  attempts: number
}
```

Only a faster successful time replaces `bestTimeMs`.

---

## 6. Weekly return loop

The weekly system is not a streak that resets after one missed day.

A week is identified using the UTC ISO week.

Example display:

```text
WEEK 36
Mon ✓  Tue ✓  Wed ○  Thu ✓  Fri ○  Sat ○  Sun ○
```

### 6.1. Milestones

Initial milestone structure:

- **3 Daily completions** — small reward;
- **5 Daily completions** — medium reward;
- **7 Daily completions** — premium weekly reward, preferably including or contributing toward a cosmetic unlock.

Missing a day does not erase previous progress.

### 6.2. Claim semantics

A weekly milestone can be claimed once per week.

The save records claimed threshold IDs so reconnecting, reloading, or replaying a completed Daily cannot duplicate the reward.

---

## 7. Mastery progression

The player has one persistent mastery level.

### 7.1. Goals

Mastery exists to provide long-term visible progress and periodic rewards. It does **not** gate core modes.

### 7.2. XP sources

Initial tunable defaults:

| Action | XP |
|---|---:|
| Standard win | 100 |
| Classic win | 120 |
| Daily first completion for that date | 150 |
| First win of the UTC day | +50 |
| Win without Undo | small bonus, initially +20 |

These numbers are balancing defaults, not permanent design constants.

### 7.3. Level curve

Use a simple deterministic XP curve that is easy to display and tune. The first implementation should avoid complex prestige systems.

A level-up may grant:

- soft currency;
- occasional direct cosmetic unlock;
- no gameplay power.

---

## 8. Soft currency

The game has exactly one soft currency.

Working name: **Coins**. Historical naming can be chosen later.

### 8.1. Currency sources

Initial tunable sources:

- first Daily completion;
- first win of the day;
- weekly milestones;
- mastery level-up;
- achievements;
- optional rewarded ad after a completed game.

### 8.2. Currency sinks

Currency buys cosmetics only:

- card backs;
- table surfaces;
- UI/foundation frame themes when those themes exist;
- possibly other visual flourishes that do not reduce readability.

### 8.3. Explicit exclusions

Currency cannot buy:

- extra free cells;
- easier deals;
- solver information;
- gameplay-changing items;
- undo charges;
- automatic wins;
- additional Daily attempts.

---

## 9. Cosmetic collection

The long-term collection gives the player something visible to complete.

Initial categories:

### 9.1. Card backs

Primary low-cost cosmetic category.

Examples:

- classic red;
- dark blue;
- botanical;
- heraldic;
- manuscript ornament;
- black/gold.

### 9.2. Table surfaces

Examples:

- current dark fine-grained wood;
- lighter oak;
- aged writing desk;
- green cloth;
- dark leather.

### 9.3. UI themes

Potential later category:

- bronze;
- iron;
- carved wood;
- manuscript.

Do not add multiple front-face card decks until readability has been proven. The current Vintage faces remain the gameplay readability baseline.

### 9.4. Collection screen

The collection screen shows visible completion counts, for example:

```text
Card backs  7 / 18
Tables      3 / 8
Themes      2 / 6
```

Locked items can show their unlock source or price where appropriate.

---

## 10. Shop

The shop is a permanent catalog, not a rotating FOMO storefront.

Rules:

- no random inventory;
- no countdown rotation;
- no loot boxes;
- no duplicate cosmetics;
- each item has a stable ID and price;
- ownership is permanent;
- equipping an owned cosmetic is free.

Example catalog entry:

```ts
{
  id: 'cardback_botanical',
  category: 'cardBack',
  price: 800
}
```

Prices should be tunable through configuration rather than scattered through UI code.

---

## 11. Achievements

Achievements are a later layer on top of stable gameplay and progression.

Target first set: roughly **20–30 meaningful achievements**, not hundreds of filler tasks.

Examples:

- first win;
- first Classic win;
- win without Undo;
- complete 5 Dailies;
- complete all 7 Dailies in one week;
- 50 wins;
- 250 wins;
- reach a mastery milestone;
- win multiple games consecutively.

Rewards may be:

- soft currency;
- XP;
- unique cosmetics.

Achievement IDs are permanent once shipped.

---

## 12. Statistics

Statistics are useful both as player motivation and as support for future achievements.

Track at minimum:

- games started;
- games won;
- total win rate;
- Standard wins;
- Classic wins;
- Daily completions;
- current and best gameplay win streak;
- wins without Undo;
- total Undo count;
- best Daily times by Daily ID for the retained history window;
- first/last play timestamps where useful for migration or rewards.

The gameplay win streak is separate from Daily attendance and may reset on a lost/abandoned game according to a later precise gameplay-state rule.

---

## 13. End-of-game reward flow

### 13.1. Win

After a win, show a short reward summary before the next deal.

Example:

```text
GAME COMPLETE

+100 XP
First win today  +30 Coins

Level 12
████████░░

NEW GAME
```

For Daily:

```text
DAILY COMPLETE

Best time: 04:32
+150 XP
+100 Coins

This week: 4 / 7
```

The screen should be quick to dismiss and must not block the player with multiple reward popups.

### 13.2. Loss / dead end

No resource penalty.

Offer:

- retry the same deal;
- start a new deal;
- for Daily, retry the same Daily.

---

## 14. Monetization principles

### 14.1. Interstitial ads

If used, interstitials belong at natural session boundaries such as between completed/abandoned games, not during card interaction.

Frequency must be restrained and tuned later from actual session length.

### 14.2. Rewarded ads

Acceptable initial use:

- optional extra soft currency after a completed game or reward screen.

Declining the ad must not remove a reward the player already earned.

### 14.3. Real-money purchases

Not required for the first meta release.

Potential later non-consumable purchase:

- remove ads;
- cosmetic supporter pack.

Gameplay power is not sold.

If meaningful real-money consumables are ever introduced, reconsider a trusted backend because server-side purchase processing provides stronger fraud resistance.

---

## 15. Yandex Games serverless architecture

The first release of this meta system is designed to work **without our own server or database**.

### 15.1. Platform boundary

Core solitaire and meta rules must not directly call `ysdk` throughout the codebase.

Use adapters/interfaces:

```text
Core Solitaire
      |
Meta Domain
  |-- Daily
  |-- Weekly
  |-- Progression
  |-- Economy
  |-- Collection
  |-- Achievements
  `-- Statistics
      |
Platform interfaces
  |-- PlayerStorage
  |-- PlayerStats
  |-- TrustedClock
  |-- Ads
  |-- Leaderboards
  |-- Payments
  `-- RemoteConfig
      |
Yandex Games adapters
```

Local development/tests use fake/in-memory adapters.

### 15.2. Player data

Use Yandex `Player` data for structured state such as:

- collection ownership;
- equipped cosmetics;
- achievements;
- Daily completion records;
- weekly claimed milestones;
- schema version.

Yandex currently allows up to **200 KB per player** in `player.setData()`.

### 15.3. Numeric stats

Use `player.setStats()` / `incrementStats()` for frequently changing numeric values such as:

- XP;
- level if stored directly;
- coins;
- wins;
- games played;
- Daily completion count;
- Classic wins.

Yandex currently allows up to **10 KB** of numeric stats per player.

### 15.4. Save frequency

Do not save every animation frame or card movement.

Persist at meaningful state boundaries:

- after completed/abandoned game state that changes permanent stats;
- after Daily completion;
- after reward claim;
- after shop purchase/equip;
- after achievement unlock;
- after important progression mutation.

Respect Yandex request limits and use queued/non-flushed writes when immediate network confirmation is unnecessary.

### 15.5. Guest play and authorization

The game must remain playable without forcing authorization.

Progress must also be preserved for non-authorized play as required by Yandex game requirements.

Offer authorization voluntarily with a clear benefit message, for example:

> Sign in with Yandex to keep your collection and progress across devices.

Cloud/player storage is the primary platform persistence path; local/safe storage may be used as a resilience/cache layer where useful.

### 15.6. Trusted time

Use `ysdk.serverTime()` for Daily/Weekly boundaries and reward eligibility.

Do not trust `Date.now()` alone for claim eligibility.

### 15.7. Remote Config

Remote Config is optional but recommended for tunable live values such as:

- XP rewards;
- coin rewards;
- weekly thresholds/rewards;
- cosmetic prices;
- rewarded-ad coin bonus;
- feature rollout flags.

Do not put core solitaire legality rules into Remote Config.

---

## 16. Save schema

All structured save data is versioned.

Initial conceptual schema:

```ts
interface MetaSaveV1 {
  version: 1;

  collection: {
    ownedCardBacks: string[];
    ownedTables: string[];
    ownedThemes: string[];
  };

  equipped: {
    cardBack: string;
    table: string;
    theme: string;
  };

  achievements: string[];

  daily: {
    algorithmVersion: number;
    records: Record<string, {
      completed: boolean;
      bestTimeMs?: number;
      attempts: number;
    }>;
  };

  weekly: {
    weekId: string;
    completedDailyIds: string[];
    claimedMilestones: number[];
  };
}
```

Frequently changing counters are stored through numeric stats rather than duplicated everywhere in `MetaSaveV1`.

### 16.1. Migration

Every load path must pass through a migration function:

```text
unknown saved object
  -> validate
  -> migrate by version
  -> normalized current MetaState
```

Unknown cosmetic or achievement IDs must not crash loading.

---

## 17. Conflict and retry policy

The first serverless version assumes a single active play session per account most of the time.

Rules:

- load platform data before presenting meta-dependent screens when possible;
- keep gameplay available if cloud/meta loading fails;
- queue a retry for failed non-critical saves;
- permanent rewards must be idempotent by stable claim ID;
- Daily completion is keyed by Daily ID;
- weekly reward claims are keyed by week ID + threshold;
- cosmetic purchase is idempotent by cosmetic ID;
- never grant the same one-time reward merely because a network response was retried.

A full multi-device transactional merge service is explicitly out of scope without a backend.

---

## 18. Security / cheating stance

Without our own trusted backend, a determined user can potentially tamper with client-side logic or progression values.

For this game that risk is acceptable in v1 because:

- the game is single-player;
- soft currency buys cosmetics only;
- there is no player-to-player economy;
- progression gives no competitive gameplay advantage.

Do not spend major development time building fake client-side anti-cheat.

If the product later introduces valuable competitive rankings, trading, or important real-money consumables, reevaluate the backend requirement.

---

## 19. Leaderboards

### 19.1. V1 decision

**No global per-day Daily leaderboard in the first serverless version.**

Daily records still store the player's own best completion time.

Reason: Yandex SDK leaderboards are configured as fixed leaderboard entities in the Developer Console. Creating/resetting a unique global board for every calendar day is not a clean scalable serverless workflow.

### 19.2. Possible later leaderboard uses

Yandex's built-in persistent leaderboards remain suitable for stable metrics such as:

- lifetime Daily completions;
- lifetime wins;
- another long-lived score if a meaningful one is designed.

A true automatically rotating global Daily ranking should be treated as a separate feature requiring additional design, and potentially our own backend.

---

## 20. Suggested menu/information architecture

Final visual design is deferred, but product hierarchy should become approximately:

```text
PLAY
  - New Game (Standard)
  - Daily Challenge
  - Classic

COLLECTION
STATISTICS
ACHIEVEMENTS   [when implemented]
SETTINGS
```

Daily should be visually prominent when today's challenge is incomplete.

The player should not have to choose Standard vs Classic every time they press New Game.

---

## 21. Release sequencing

This is a product/design sequence, not the implementation task breakdown.

### Phase A — Retention foundation

- Yandex platform abstraction for player save + trusted time;
- Daily Challenge;
- personal Daily best time;
- Weekly 3/5/7 card;
- minimal Daily/Weekly UI;
- save/load and idempotent claims.

This phase is the highest priority because it creates a reason to return before building an economy.

### Phase B — Statistics

- persistent game stats;
- statistics screen;
- win/reward summary foundation.

### Phase C — Mastery

- XP;
- level curve;
- level-up rewards.

### Phase D — Economy & collection

- one soft currency;
- cosmetic catalog;
- collection ownership;
- equip flow;
- simple permanent shop.

### Phase E — Achievements

- 20–30 meaningful achievements;
- rewards and unique cosmetic unlocks.

### Phase F — Monetization polish

- restrained interstitial policy;
- optional rewarded ad for extra cosmetic currency;
- consider remove-ads purchase only after the core loop is stable.

Leaderboards are not required for these phases.

---

## 22. Success criteria

The design is successful when:

1. A new player can launch and play Standard solitaire without understanding the meta layer.
2. A returning player has a clear new Daily challenge each UTC day.
3. Missing a Daily does not erase the rest of the week's progress.
4. Daily attempts are unlimited and preserve the same deal.
5. The player's best Daily completion time is stored.
6. Progression unlocks only cosmetics and status, never gameplay power.
7. All permanent progress survives refresh and normal platform lifecycle events.
8. The first release does not require our own hosted server/database.
9. Platform APIs are isolated behind adapters so a backend could be added later without rewriting solitaire rules.
10. The system avoids energy, lives, loot boxes, FOMO store rotation, booster selling, and mandatory ad tasks.

---

## 23. Yandex platform facts used by this design

Verified against current Yandex Games documentation on 2026-09-04:

- `player.setData()` supports up to 200 KB of player data.
- numeric `setStats()` / `incrementStats()` support up to 10 KB and are recommended for points, XP and in-game currency.
- `ysdk.serverTime()` provides synchronized server time and is explicitly intended for daily/weekly events and protection from device-clock tampering.
- Remote Config flags can be changed through the Games Console without uploading a new archive; up to 100 flags are supported.
- built-in leaderboards must be created/configured in the Developer Console and score submission is tied to fixed technical leaderboard names.
- in-app purchases support both client-side and signed server-side processing; server-side processing provides stronger fraud protection.
- Yandex requirements state that game progress must be saved for users whether or not they are logged in, while authorization can be voluntarily offered for platform/account benefits.

References:

- https://yandex.com/dev/games/doc/en/sdk/sdk-player
- https://yandex.com/dev/games/doc/en/sdk/sdk-server-time
- https://yandex.com/dev/games/doc/en/config
- https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard
- https://yandex.com/dev/games/doc/en/concepts/leaderboards
- https://yandex.com/dev/games/doc/en/sdk/sdk-purchases
- https://yandex.com/dev/games/doc/en/requirements/1/2
- https://yandex.com/dev/games/doc/en/requirements/1/9

