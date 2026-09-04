# Daily & Weekly Retention Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first complete retention vertical slice: Yandex-backed structured player persistence, trusted UTC time, one solver-proven Daily Challenge per day, unlimited Daily retries with personal best time, and a persistent weekly 3/5/7 progress card.

**Architecture:** Keep solitaire rules independent from platform/meta code. Add a small platform boundary (`PlayerStorage`, `TrustedClock`), pure Daily/Weekly domain functions, and a `MetaRepository` for versioned structured data. `GameScene` coordinates the existing `GameFlow` with Daily state; the core deal generator only gains a fixed solver-proven Daily mode and does not learn about Yandex SDK details.

**Tech Stack:** TypeScript, Phaser 3.90, native DOM UI, Node built-in test runner, Vite, Yandex Games SDK.

**Spec:** `docs/superpowers/specs/2026-09-04-retention-meta-progression-design.md`

## Global Constraints

- Daily identity uses Yandex `ysdk.serverTime()` and UTC calendar boundaries.
- Daily IDs use exact `YYYY-MM-DD` format.
- Daily deal mapping is deterministic: date + `dailyAlgorithmVersion` -> frozen solver-proven seed pool index.
- Initial `dailyAlgorithmVersion` is `1` and the shipped `WINNABLE_SEEDS` ordering is frozen for that version.
- Daily attempts are unlimited; restart and New Game while in Daily replay the same Daily seed.
- The Daily timer starts when the initial deal/automatic opening chain has settled and input is becoming available; it stops on win.
- The Daily timer pauses while the main menu is open and while `document.visibilityState !== 'visible'`.
- Undo is allowed and is not part of the primary Daily score.
- Best Daily result is personal best completion time; only a faster successful attempt replaces it.
- Weekly progress uses UTC ISO weeks and milestones at exactly 3, 5, and 7 Daily completions.
- Missing a day never erases other completions in the same week.
- Phase A persists weekly `claimedMilestones` but does not grant XP/Coins yet; actual milestone reward payloads belong to the later progression/economy plans.
- If trusted server time is unavailable, Standard/Classic solitaire remains playable and Daily is disabled rather than minted from an untrusted production device clock.
- Structured save data is versioned and normalized through migration on every load.
- Platform write failures must not crash gameplay; the latest unsaved meta state remains queued for a later retry.
- No global per-day leaderboard is implemented in this plan.
- No XP, soft currency, shop, achievements, ads, or real-money purchases are implemented in this plan.
- Do not change solitaire legality, draw rules, free-cell rules, auto-foundation safety, undo semantics, drag/drop geometry, card art, or the current visual theme.

## File Structure

New domain/platform files:

- `src/platform/services.ts` — platform-neutral `PlayerStorage`, `TrustedClock`, and `PlatformServices` interfaces plus local unavailable fallbacks.
- `src/platform/yandex.ts` — cached Yandex SDK initialization and adapters for `player.getData()/setData()` and `ysdk.serverTime()`.
- `src/meta/MetaSave.ts` — `MetaSaveV1`, default state, runtime normalization/migration.
- `src/meta/MetaRepository.ts` — load + serialized queued saves with retry of the newest pending snapshot.
- `src/meta/DailyCalendar.ts` — UTC Daily ID, ISO week calculation, Daily seed mapping.
- `src/meta/DailyProgress.ts` — pure mutation rules for attempts, completion, personal best, weekly progress.
- `src/meta/DailyAttemptTimer.ts` — monotonic per-attempt timer with pause/resume.
- `src/game/view/DailyCompleteView.ts` — small DOM completion overlay for Daily only.

Existing files modified:

- `src/game/model/types.ts` — add technical `'daily'` game mode.
- `src/game/model/GameSession.ts` — add fixed solver-proven Daily deal start; Daily restart/new replay same seed.
- `src/game/model/GameFlow.ts` — allow Daily selection/start without changing Standard/Classic flow behavior.
- `src/game/scenes/GameScene.ts` — initialize platform/meta, start/finish Daily attempts, pause timer, persist result, wire Daily UI.
- `src/game/view/MainMenuView.ts` — add Daily button/status and weekly 3/5/7 summary; rename player-facing Standard/Classic labels.
- `src/styles.css` — minimal styles for Daily/Weekly additions using the existing historical visual language; do not redesign the menu again in this task.
- `CURRENT_STATE.md`, `TECH.md`, `TREE.txt` — document the implemented architecture and next phase.

Tests added/modified:

- `tests/platform-services.test.ts`
- `tests/meta-save.test.ts`
- `tests/meta-repository.test.ts`
- `tests/daily-calendar.test.ts`
- `tests/daily-progress.test.ts`
- `tests/daily-attempt-timer.test.ts`
- `tests/game-session.test.ts`
- `tests/game-controls.test.ts`
- `tests/main-menu-wiring.test.ts`
- `tests/daily-scene-wiring.test.ts`

---

### Task 1: Platform Boundary and Cached Yandex Initialization

**Files:**
- Create: `src/platform/services.ts`
- Modify: `src/platform/yandex.ts`
- Create: `tests/platform-services.test.ts`

**Interfaces:**
- Produces:
  - `interface PlayerStorage { load(): Promise<unknown>; save(data: Record<string, unknown>, flush?: boolean): Promise<void> }`
  - `interface TrustedClock { nowMs(): number | null }`
  - `interface PlatformServices { playerStorage: PlayerStorage; trustedClock: TrustedClock; ready(): void }`
  - `initializePlatform(): Promise<PlatformServices>`
- Yandex adapter uses one cached `YaGames.init()` result, `await ysdk.getPlayer()`, `player.getData()`, `player.setData(data, flush)`, and synchronous `ysdk.serverTime()`.

- [ ] **Step 1: Write the failing platform adapter tests**

Create `tests/platform-services.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createUnavailablePlatformServices,
} from '../src/platform/services.ts';
import {
  createYandexPlatformServices,
} from '../src/platform/yandex.ts';

test('unavailable platform keeps ordinary play possible but has no trusted time', async () => {
  const platform = createUnavailablePlatformServices();

  assert.equal(platform.trustedClock.nowMs(), null);
  assert.deepEqual(await platform.playerStorage.load(), {});
  await platform.playerStorage.save({ any: 'value' });
  assert.deepEqual(await platform.playerStorage.load(), { any: 'value' });
});

test('Yandex adapter reads trusted time and structured player data through one player object', async () => {
  const saved: Array<{ data: Record<string, unknown>; flush: boolean }> = [];
  let getPlayerCalls = 0;
  let readyCalls = 0;
  const player = {
    getData: async () => ({ meta: { version: 1 } }),
    setData: async (data: Record<string, unknown>, flush = false) => {
      saved.push({ data, flush });
    },
  };
  const ysdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return player;
    },
    serverTime: () => 1_787_856_000_000,
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
  };

  const platform = await createYandexPlatformServices(ysdk);

  assert.equal(platform.trustedClock.nowMs(), 1_787_856_000_000);
  assert.deepEqual(await platform.playerStorage.load(), { meta: { version: 1 } });
  await platform.playerStorage.save({ meta: { version: 1 } }, true);
  platform.ready();

  assert.equal(getPlayerCalls, 1);
  assert.deepEqual(saved, [{ data: { meta: { version: 1 } }, flush: true }]);
  assert.equal(readyCalls, 1);
});
```

- [ ] **Step 2: Run the platform tests and verify RED**

Run:

```bash
node --test tests/platform-services.test.ts
```

Expected: FAIL because `services.ts`, `createUnavailablePlatformServices`, and `createYandexPlatformServices` do not exist.

- [ ] **Step 3: Add the platform-neutral interfaces and unavailable fallback**

Create `src/platform/services.ts`:

```ts
export interface PlayerStorage {
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock {
  nowMs(): number | null;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly ready: () => void;
}

class MemoryPlayerStorage implements PlayerStorage {
  private data: Record<string, unknown> = {};

  async load(): Promise<unknown> {
    return structuredClone(this.data);
  }

  async save(data: Record<string, unknown>): Promise<void> {
    this.data = structuredClone(data);
  }
}

export function createUnavailablePlatformServices(): PlatformServices {
  return {
    playerStorage: new MemoryPlayerStorage(),
    trustedClock: { nowMs: () => null },
    ready: () => undefined,
  };
}
```

- [ ] **Step 4: Replace the one-shot readiness helper with cached Yandex services**

Modify `src/platform/yandex.ts` so the minimal SDK types and adapter are explicit and testable:

```ts
import {
  createUnavailablePlatformServices,
  type PlatformServices,
} from './services.ts';

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface YandexSdk {
  getPlayer(): Promise<YandexPlayer>;
  serverTime(): number;
  features?: { LoadingAPI?: { ready(): void } };
}

interface YandexGamesApi {
  init(): Promise<YandexSdk>;
}

declare global {
  interface Window {
    YaGames?: YandexGamesApi;
  }
}

let platformPromise: Promise<PlatformServices> | null = null;

export async function createYandexPlatformServices(
  ysdk: YandexSdk,
): Promise<PlatformServices> {
  const player = await ysdk.getPlayer();

  return {
    playerStorage: {
      load: () => player.getData(),
      save: (data, flush = false) => player.setData(data, flush),
    },
    trustedClock: { nowMs: () => ysdk.serverTime() },
    ready: () => ysdk.features?.LoadingAPI?.ready(),
  };
}

export function initializePlatform(): Promise<PlatformServices> {
  if (platformPromise !== null) {
    return platformPromise;
  }

  platformPromise = (async () => {
    try {
      const ysdk = await window.YaGames?.init();
      return ysdk === undefined
        ? createUnavailablePlatformServices()
        : createYandexPlatformServices(ysdk);
    } catch {
      return createUnavailablePlatformServices();
    }
  })();

  return platformPromise;
}
```

Yandex API reference used by this task:
- `https://yandex.com/dev/games/doc/en/sdk/sdk-player`
- `https://yandex.com/dev/games/doc/en/sdk/sdk-server-time`

- [ ] **Step 5: Run tests and full verification**

Run:

```bash
node --test tests/platform-services.test.ts
pnpm test
pnpm build
```

Expected: platform tests PASS; existing suite PASS; build exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/platform/services.ts src/platform/yandex.ts tests/platform-services.test.ts
git commit -m "feat: add Yandex meta platform boundary"
```

---

### Task 2: Versioned Meta Save and Queued Repository

**Files:**
- Create: `src/meta/MetaSave.ts`
- Create: `src/meta/MetaRepository.ts`
- Create: `tests/meta-save.test.ts`
- Create: `tests/meta-repository.test.ts`

**Interfaces:**
- Consumes: `PlayerStorage` from Task 1.
- Produces:
  - `MetaSaveV1`
  - `createDefaultMetaSave(): MetaSaveV1`
  - `normalizeMetaSave(raw: unknown): MetaSaveV1`
  - `class MetaRepository { load(): Promise<MetaSaveV1>; save(state: MetaSaveV1, flush?: boolean): Promise<void>; retryPending(): Promise<void> }`

- [ ] **Step 1: Write RED tests for save normalization**

Create `tests/meta-save.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultMetaSave,
  normalizeMetaSave,
} from '../src/meta/MetaSave.ts';

test('missing or malformed saves normalize to version 1 defaults', () => {
  assert.deepEqual(normalizeMetaSave(null), createDefaultMetaSave());
  assert.deepEqual(normalizeMetaSave({ version: 99 }), createDefaultMetaSave());
});

test('version 1 normalization preserves valid Daily records and removes invalid values', () => {
  const save = normalizeMetaSave({
    version: 1,
    daily: {
      algorithmVersion: 1,
      records: {
        '2026-09-04': { completed: true, bestTimeMs: 12_345, attempts: 3 },
        broken: { completed: true, bestTimeMs: -5, attempts: -1 },
      },
    },
    weekly: {
      weekId: '2026-W36',
      completedDailyIds: ['2026-09-04', '2026-09-04', 'bad'],
      claimedMilestones: [3, 3, 99],
    },
  });

  assert.deepEqual(save.daily.records['2026-09-04'], {
    completed: true,
    bestTimeMs: 12_345,
    attempts: 3,
  });
  assert.equal(save.daily.records.broken, undefined);
  assert.deepEqual(save.weekly.completedDailyIds, ['2026-09-04']);
  assert.deepEqual(save.weekly.claimedMilestones, [3]);
});
```

- [ ] **Step 2: Run normalization tests and verify RED**

Run:

```bash
node --test tests/meta-save.test.ts
```

Expected: FAIL because `MetaSave.ts` does not exist.

- [ ] **Step 3: Implement the exact V1 schema and normalization**

Create `src/meta/MetaSave.ts` with these public types:

```ts
export const META_SAVE_VERSION = 1 as const;
export const DAILY_ALGORITHM_VERSION = 1 as const;
export const WEEKLY_MILESTONES = [3, 5, 7] as const;

export interface DailyRecord {
  completed: boolean;
  bestTimeMs?: number;
  attempts: number;
}

export interface MetaSaveV1 {
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
    records: Record<string, DailyRecord>;
  };
  weekly: {
    weekId: string;
    completedDailyIds: string[];
    claimedMilestones: number[];
  };
}
```

Defaults for Phase A:

```ts
export function createDefaultMetaSave(): MetaSaveV1 {
  return {
    version: 1,
    collection: {
      ownedCardBacks: [],
      ownedTables: [],
      ownedThemes: [],
    },
    equipped: { cardBack: '', table: '', theme: '' },
    achievements: [],
    daily: { algorithmVersion: DAILY_ALGORITHM_VERSION, records: {} },
    weekly: { weekId: '', completedDailyIds: [], claimedMilestones: [] },
  };
}
```

Implement normalization with concrete guards rather than schema-library dependencies:

```ts
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function normalizeDailyRecord(value: unknown): DailyRecord | null {
  if (!isObject(value)) return null;
  const attempts = value.attempts;
  const completed = value.completed;
  const bestTimeMs = value.bestTimeMs;

  if (!Number.isInteger(attempts) || (attempts as number) < 0 || typeof completed !== 'boolean') {
    return null;
  }
  if (bestTimeMs !== undefined && (!Number.isFinite(bestTimeMs) || (bestTimeMs as number) <= 0)) {
    return null;
  }

  return {
    completed,
    attempts: attempts as number,
    ...(bestTimeMs === undefined ? {} : { bestTimeMs: bestTimeMs as number }),
  };
}

export function normalizeMetaSave(raw: unknown): MetaSaveV1 {
  const fallback = createDefaultMetaSave();
  if (!isObject(raw) || raw.version !== META_SAVE_VERSION) return fallback;

  const daily = isObject(raw.daily) ? raw.daily : {};
  const rawRecords = isObject(daily.records) ? daily.records : {};
  const records: Record<string, DailyRecord> = {};
  for (const [id, value] of Object.entries(rawRecords)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) continue;
    const record = normalizeDailyRecord(value);
    if (record !== null) records[id] = record;
  }

  const weekly = isObject(raw.weekly) ? raw.weekly : {};
  const claimedMilestones = Array.isArray(weekly.claimedMilestones)
    ? [...new Set(weekly.claimedMilestones.filter(
        (value): value is 3 | 5 | 7 => value === 3 || value === 5 || value === 7,
      ))]
    : [];

  const completedDailyIds = uniqueStrings(weekly.completedDailyIds)
    .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id));

  return {
    ...fallback,
    collection: isObject(raw.collection) ? {
      ownedCardBacks: uniqueStrings(raw.collection.ownedCardBacks),
      ownedTables: uniqueStrings(raw.collection.ownedTables),
      ownedThemes: uniqueStrings(raw.collection.ownedThemes),
    } : fallback.collection,
    equipped: isObject(raw.equipped) ? {
      cardBack: typeof raw.equipped.cardBack === 'string' ? raw.equipped.cardBack : '',
      table: typeof raw.equipped.table === 'string' ? raw.equipped.table : '',
      theme: typeof raw.equipped.theme === 'string' ? raw.equipped.theme : '',
    } : fallback.equipped,
    achievements: uniqueStrings(raw.achievements),
    daily: {
      algorithmVersion: Number.isInteger(daily.algorithmVersion) && (daily.algorithmVersion as number) > 0
        ? daily.algorithmVersion as number
        : DAILY_ALGORITHM_VERSION,
      records,
    },
    weekly: {
      weekId: typeof weekly.weekId === 'string' ? weekly.weekId : '',
      completedDailyIds,
      claimedMilestones,
    },
  };
}
```

Unknown keys/IDs are ignored rather than throwing; malformed sections fall back independently.

- [ ] **Step 4: Write RED tests for repository queuing/retry**

Create `tests/meta-repository.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { MetaRepository } from '../src/meta/MetaRepository.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

test('repository stores meta under one stable top-level key', async () => {
  let written: Record<string, unknown> | null = null;
  const storage: PlayerStorage = {
    load: async () => ({}),
    save: async (data) => { written = data; },
  };
  const repo = new MetaRepository(storage);
  const state = createDefaultMetaSave();

  await repo.save(state);

  assert.deepEqual(written, { cascadeMeta: state });
});

test('failed save keeps the newest snapshot pending and retry writes only that snapshot', async () => {
  const writes: Record<string, unknown>[] = [];
  let fail = true;
  const storage: PlayerStorage = {
    load: async () => ({}),
    save: async (data) => {
      if (fail) throw new Error('offline');
      writes.push(data);
    },
  };
  const repo = new MetaRepository(storage);
  const first = createDefaultMetaSave();
  const second = createDefaultMetaSave();
  second.daily.records['2026-09-04'] = { completed: true, attempts: 1, bestTimeMs: 1000 };

  await repo.save(first);
  await repo.save(second);
  fail = false;
  await repo.retryPending();

  assert.deepEqual(writes, [{ cascadeMeta: second }]);
});
```

- [ ] **Step 5: Run repository tests and verify RED**

Run:

```bash
node --test tests/meta-repository.test.ts
```

Expected: FAIL because `MetaRepository.ts` does not exist.

- [ ] **Step 6: Implement the repository**

Create `src/meta/MetaRepository.ts`:

```ts
import type { PlayerStorage } from '../platform/services.ts';
import {
  normalizeMetaSave,
  type MetaSaveV1,
} from './MetaSave.ts';

const META_KEY = 'cascadeMeta';

export class MetaRepository {
  private pending: MetaSaveV1 | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly storage: PlayerStorage) {}

  async load(): Promise<MetaSaveV1> {
    try {
      const raw = await this.storage.load();
      const root = raw !== null && typeof raw === 'object'
        ? raw as Record<string, unknown>
        : {};
      return normalizeMetaSave(root[META_KEY]);
    } catch {
      return normalizeMetaSave(null);
    }
  }

  async save(state: MetaSaveV1, flush = false): Promise<void> {
    this.pending = structuredClone(state);
    this.writing = this.writing.then(async () => {
      const snapshot = this.pending;
      if (snapshot === null) return;

      try {
        await this.storage.save({ [META_KEY]: snapshot }, flush);
        if (this.pending === snapshot) this.pending = null;
      } catch {
        // Keep the newest pending snapshot for retryPending()/the next save boundary.
      }
    });
    await this.writing;
  }

  async retryPending(): Promise<void> {
    const snapshot = this.pending;
    if (snapshot !== null) await this.save(snapshot, true);
  }
}
```

If the test exposes object-identity problems caused by `structuredClone`, track pending snapshots with an incrementing revision number instead of weakening the test.

- [ ] **Step 7: Run focused + full verification**

```bash
node --test tests/meta-save.test.ts tests/meta-repository.test.ts
pnpm test
pnpm build
```

Expected: all PASS and build exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/meta/MetaSave.ts src/meta/MetaRepository.ts tests/meta-save.test.ts tests/meta-repository.test.ts
git commit -m "feat: add versioned meta persistence"
```

---

### Task 3: Deterministic Daily Identity, Seed Mapping, and ISO Week Math

**Files:**
- Create: `src/meta/DailyCalendar.ts`
- Create: `tests/daily-calendar.test.ts`

**Interfaces:**
- Consumes: `DAILY_ALGORITHM_VERSION`, `WINNABLE_SEEDS`.
- Produces:
  - `getDailyId(timestampMs: number): string`
  - `getIsoWeekId(timestampMs: number): string`
  - `getIsoWeekDailyIds(timestampMs: number): readonly string[]`
  - `getDailySeed(dailyId: string, algorithmVersion?: number, pool?: readonly bigint[]): bigint`

- [ ] **Step 1: Write the failing calendar tests**

Create `tests/daily-calendar.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDailyId,
  getDailySeed,
  getIsoWeekDailyIds,
  getIsoWeekId,
} from '../src/meta/DailyCalendar.ts';

test('Daily ID uses UTC rather than local calendar assumptions', () => {
  assert.equal(getDailyId(Date.parse('2026-09-04T23:59:59.999Z')), '2026-09-04');
  assert.equal(getDailyId(Date.parse('2026-09-05T00:00:00.000Z')), '2026-09-05');
});

test('ISO week calculation handles year boundaries', () => {
  assert.equal(getIsoWeekId(Date.parse('2026-01-01T12:00:00Z')), '2026-W01');
  assert.equal(getIsoWeekId(Date.parse('2027-01-01T12:00:00Z')), '2026-W53');
});

test('week Daily IDs are Monday through Sunday in UTC', () => {
  assert.deepEqual(getIsoWeekDailyIds(Date.parse('2026-09-04T12:00:00Z')), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('same Daily ID/version maps to the same solver-proven pool member', () => {
  const pool = [11n, 22n, 33n, 44n] as const;
  const first = getDailySeed('2026-09-04', 1, pool);
  const second = getDailySeed('2026-09-04', 1, pool);

  assert.equal(first, second);
  assert.ok(pool.includes(first as 11n | 22n | 33n | 44n));
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/daily-calendar.test.ts
```

Expected: FAIL because `DailyCalendar.ts` does not exist.

- [ ] **Step 3: Implement UTC and ISO-week helpers**

Create `src/meta/DailyCalendar.ts`. Daily ID:

```ts
export function getDailyId(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}
```

Use ISO-8601 Thursday anchoring for the week-year/week number; do not use locale APIs:

```ts
function startOfIsoWeekUtc(timestampMs: number): number {
  const date = new Date(timestampMs);
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utcMidnight).getUTCDay() || 7;
  return utcMidnight - (day - 1) * 86_400_000;
}

export function getIsoWeekId(timestampMs: number): string {
  const monday = startOfIsoWeekUtc(timestampMs);
  const thursday = monday + 3 * 86_400_000;
  const weekYear = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(weekYear, 0, 4);
  const week1Monday = startOfIsoWeekUtc(jan4);
  const week = Math.floor((monday - week1Monday) / (7 * 86_400_000)) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function getIsoWeekDailyIds(timestampMs: number): readonly string[] {
  const monday = startOfIsoWeekUtc(timestampMs);
  return Array.from({ length: 7 }, (_, index) =>
    getDailyId(monday + index * 86_400_000),
  );
}
```

Use frozen FNV-1a 32-bit for mapping:

```ts
function stableHash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getDailySeed(
  dailyId: string,
  algorithmVersion = DAILY_ALGORITHM_VERSION,
  pool: readonly bigint[] = WINNABLE_SEEDS,
): bigint {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyId)) {
    throw new Error('Invalid Daily ID.');
  }
  if (pool.length === 0) {
    throw new Error('Daily seed pool is empty.');
  }

  const index = stableHash32(`${algorithmVersion}:${dailyId}`) % pool.length;
  return pool[index];
}
```

- [ ] **Step 4: Run focused + full verification**

```bash
node --test tests/daily-calendar.test.ts
pnpm test
pnpm build
```

Expected: PASS; no existing seed/deal tests regress.

- [ ] **Step 5: Commit**

```bash
git add src/meta/DailyCalendar.ts tests/daily-calendar.test.ts
git commit -m "feat: add deterministic Daily calendar"
```

---

### Task 4: Pure Daily/Weekly Progress Rules

**Files:**
- Create: `src/meta/DailyProgress.ts`
- Create: `tests/daily-progress.test.ts`

**Interfaces:**
- Consumes: `MetaSaveV1`, `DailyRecord`, `WEEKLY_MILESTONES` and week helpers.
- Produces:
  - `beginDailyAttempt(state, dailyId, weekId): MetaSaveV1`
  - `completeDailyAttempt(state, dailyId, weekId, elapsedMs): DailyCompletionResult`
  - `getWeeklyProgress(state, weekId): { completed: number; thresholds: readonly [3, 5, 7]; completedDailyIds: readonly string[] }`

`DailyCompletionResult`:

```ts
export interface DailyCompletionResult {
  readonly state: MetaSaveV1;
  readonly firstCompletion: boolean;
  readonly improvedBest: boolean;
  readonly bestTimeMs: number;
  readonly newlyReachedMilestones: readonly number[];
}
```

- [ ] **Step 1: Write failing Daily progress tests**

Create `tests/daily-progress.test.ts` with at least these cases:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import {
  beginDailyAttempt,
  completeDailyAttempt,
  getWeeklyProgress,
} from '../src/meta/DailyProgress.ts';

test('starting attempts increments only that Daily record', () => {
  const state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  const next = beginDailyAttempt(state, '2026-09-04', '2026-W36');

  assert.equal(next.daily.records['2026-09-04'].attempts, 2);
  assert.equal(next.daily.records['2026-09-04'].completed, false);
});

test('first completion records best time and counts the Daily once in the week', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  const result = completeDailyAttempt(state, '2026-09-04', '2026-W36', 12_000);

  assert.equal(result.firstCompletion, true);
  assert.equal(result.improvedBest, true);
  assert.equal(result.bestTimeMs, 12_000);
  assert.deepEqual(result.state.weekly.completedDailyIds, ['2026-09-04']);
});

test('replaying a completed Daily only replaces a faster personal best', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-04', '2026-W36');
  state = completeDailyAttempt(state, '2026-09-04', '2026-W36', 12_000).state;
  state = beginDailyAttempt(state, '2026-09-04', '2026-W36');

  const slower = completeDailyAttempt(state, '2026-09-04', '2026-W36', 15_000);
  const faster = completeDailyAttempt(slower.state, '2026-09-04', '2026-W36', 9_000);

  assert.equal(slower.bestTimeMs, 12_000);
  assert.equal(slower.improvedBest, false);
  assert.equal(faster.bestTimeMs, 9_000);
  assert.equal(faster.improvedBest, true);
  assert.equal(faster.state.weekly.completedDailyIds.length, 1);
});

test('weekly progress resets to the new ISO week without deleting Daily history', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-06', '2026-W36');
  state = completeDailyAttempt(state, '2026-09-06', '2026-W36', 10_000).state;
  state = beginDailyAttempt(state, '2026-09-07', '2026-W37');

  assert.equal(state.weekly.weekId, '2026-W37');
  assert.deepEqual(state.weekly.completedDailyIds, []);
  assert.equal(state.daily.records['2026-09-06'].completed, true);
});

test('3 5 and 7 completions are reported once as newly reached milestones', () => {
  let state = createDefaultMetaSave();
  let latest: readonly number[] = [];

  for (let day = 1; day <= 7; day += 1) {
    const id = `2026-09-0${day}`;
    state = beginDailyAttempt(state, id, '2026-W36');
    const result = completeDailyAttempt(state, id, '2026-W36', 10_000);
    state = result.state;
    latest = result.newlyReachedMilestones;
    if (day === 3) assert.deepEqual(latest, [3]);
    if (day === 5) assert.deepEqual(latest, [5]);
    if (day === 7) assert.deepEqual(latest, [7]);
  }

  assert.equal(getWeeklyProgress(state, '2026-W36').completed, 7);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/daily-progress.test.ts
```

Expected: FAIL because `DailyProgress.ts` does not exist.

- [ ] **Step 3: Implement immutable progress mutations**

Implement the pure transitions with one week-normalization helper:

```ts
function normalizeWeek(state: MetaSaveV1, weekId: string): MetaSaveV1['weekly'] {
  return state.weekly.weekId === weekId
    ? {
        ...state.weekly,
        completedDailyIds: [...state.weekly.completedDailyIds],
        claimedMilestones: [...state.weekly.claimedMilestones],
      }
    : { weekId, completedDailyIds: [], claimedMilestones: [] };
}

export function beginDailyAttempt(
  state: MetaSaveV1,
  dailyId: string,
  weekId: string,
): MetaSaveV1 {
  const previous = state.daily.records[dailyId] ?? { completed: false, attempts: 0 };
  return {
    ...state,
    daily: {
      ...state.daily,
      records: {
        ...state.daily.records,
        [dailyId]: { ...previous, attempts: previous.attempts + 1 },
      },
    },
    weekly: normalizeWeek(state, weekId),
  };
}

export function completeDailyAttempt(
  state: MetaSaveV1,
  dailyId: string,
  weekId: string,
  elapsedMs: number,
): DailyCompletionResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error('Daily elapsed time must be positive.');
  }

  const weekly = normalizeWeek(state, weekId);
  const previous = state.daily.records[dailyId] ?? { completed: false, attempts: 0 };
  const firstCompletion = !previous.completed;
  const previousBest = previous.bestTimeMs;
  const improvedBest = previousBest === undefined || elapsedMs < previousBest;
  const bestTimeMs = improvedBest ? elapsedMs : previousBest;
  const beforeCount = weekly.completedDailyIds.length;
  const completedDailyIds = firstCompletion
    ? [...weekly.completedDailyIds, dailyId]
    : [...weekly.completedDailyIds];
  const afterCount = completedDailyIds.length;
  const newlyReachedMilestones = WEEKLY_MILESTONES.filter(
    (threshold) => beforeCount < threshold && afterCount >= threshold,
  );

  return {
    state: {
      ...state,
      daily: {
        ...state.daily,
        records: {
          ...state.daily.records,
          [dailyId]: {
            ...previous,
            completed: true,
            ...(bestTimeMs === undefined ? {} : { bestTimeMs }),
          },
        },
      },
      weekly: { ...weekly, completedDailyIds },
    },
    firstCompletion,
    improvedBest,
    bestTimeMs: bestTimeMs as number,
    newlyReachedMilestones,
  };
}

export function getWeeklyProgress(state: MetaSaveV1, weekId: string) {
  const weekly = normalizeWeek(state, weekId);
  return {
    completed: weekly.completedDailyIds.length,
    thresholds: WEEKLY_MILESTONES,
    completedDailyIds: weekly.completedDailyIds,
  };
}
```

Do **not** add thresholds to `claimedMilestones` in Phase A; later economy/mastery code will claim and grant them atomically.

- [ ] **Step 4: Run focused + full verification**

```bash
node --test tests/daily-progress.test.ts
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta/DailyProgress.ts tests/daily-progress.test.ts
git commit -m "feat: add Daily and weekly progress rules"
```

---

### Task 5: Pause-Aware Daily Attempt Timer

**Files:**
- Create: `src/meta/DailyAttemptTimer.ts`
- Create: `tests/daily-attempt-timer.test.ts`

**Interfaces:**
- Produces `class DailyAttemptTimer` with:
  - `start(nowMs: number): void`
  - `pause(nowMs: number): void`
  - `resume(nowMs: number): void`
  - `finish(nowMs: number): number`
  - `reset(): void`
  - `get running(): boolean`

- [ ] **Step 1: Write failing timer tests**

Create `tests/daily-attempt-timer.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { DailyAttemptTimer } from '../src/meta/DailyAttemptTimer.ts';

test('timer measures one active attempt', () => {
  const timer = new DailyAttemptTimer();
  timer.start(100);
  assert.equal(timer.finish(1_350), 1_250);
});

test('paused time is excluded', () => {
  const timer = new DailyAttemptTimer();
  timer.start(100);
  timer.pause(600);
  timer.resume(2_600);
  assert.equal(timer.finish(3_100), 1_000);
});

test('pause resume and finish are idempotent around inactive state', () => {
  const timer = new DailyAttemptTimer();
  timer.pause(100);
  timer.resume(200);
  assert.throws(() => timer.finish(300), /not started/i);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/daily-attempt-timer.test.ts
```

Expected: FAIL because the timer does not exist.

- [ ] **Step 3: Implement the timer as pure monotonic arithmetic**

Implement the class directly from monotonic segments:

```ts
export class DailyAttemptTimer {
  private started = false;
  private activeStartedAt: number | null = null;
  private accumulatedMs = 0;

  get running(): boolean {
    return this.started;
  }

  start(nowMs: number): void {
    this.assertTime(nowMs);
    this.started = true;
    this.activeStartedAt = nowMs;
    this.accumulatedMs = 0;
  }

  pause(nowMs: number): void {
    if (!this.started || this.activeStartedAt === null) return;
    this.assertForward(nowMs, this.activeStartedAt);
    this.accumulatedMs += nowMs - this.activeStartedAt;
    this.activeStartedAt = null;
  }

  resume(nowMs: number): void {
    if (!this.started || this.activeStartedAt !== null) return;
    this.assertTime(nowMs);
    this.activeStartedAt = nowMs;
  }

  finish(nowMs: number): number {
    if (!this.started) throw new Error('Daily timer was not started.');
    if (this.activeStartedAt !== null) {
      this.assertForward(nowMs, this.activeStartedAt);
      this.accumulatedMs += nowMs - this.activeStartedAt;
    }
    const elapsed = Math.max(1, Math.round(this.accumulatedMs));
    this.reset();
    return elapsed;
  }

  reset(): void {
    this.started = false;
    this.activeStartedAt = null;
    this.accumulatedMs = 0;
  }

  private assertTime(value: number): void {
    if (!Number.isFinite(value)) throw new Error('Timer timestamp must be finite.');
  }

  private assertForward(nowMs: number, fromMs: number): void {
    this.assertTime(nowMs);
    if (nowMs < fromMs) throw new Error('Timer cannot move backwards.');
  }
}
```

Do not use `Date.now()` inside the class. `GameScene` supplies `performance.now()` so tests are deterministic and Daily identity remains separately tied to trusted Yandex time.

- [ ] **Step 4: Run focused + full verification**

```bash
node --test tests/daily-attempt-timer.test.ts
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta/DailyAttemptTimer.ts tests/daily-attempt-timer.test.ts
git commit -m "feat: add Daily attempt timer"
```

---

### Task 6: Fixed Solver-Proven Daily Mode in Session and Flow

**Files:**
- Modify: `src/game/model/types.ts`
- Modify: `src/game/model/GameSession.ts`
- Modify: `src/game/model/GameFlow.ts`
- Modify: `tests/game-session.test.ts`
- Modify: `tests/game-controls.test.ts`

**Interfaces:**
- Extend `GameMode` to `'original' | 'winnable' | 'daily'`.
- Add `GameSession.startDaily(seed: bigint): Deal`.
- Add `GameFlow.playSelectedMode(dailySeed?: bigint): Deal` behavior for selected Daily.
- `GameFlow.startNewInCurrentMode()` replays the same seed in Daily instead of selecting a new deal.

- [ ] **Step 1: Add failing session tests**

Append to `tests/game-session.test.ts`:

```ts
test('Daily starts only from a seed in the frozen solver-proven pool', () => {
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [11n, 22n] });

  assert.equal(session.startDaily(22n).mode, 'daily');
  assert.equal(session.currentSeed, 22n);
  assert.throws(() => session.startDaily(99n), /solver-proven/i);
});

test('Daily restart preserves its fixed seed', () => {
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [11n] });
  const first = session.startDaily(11n);
  const restarted = session.restart();

  assert.equal(restarted.mode, 'daily');
  assert.equal(restarted.seed, first.seed);
});
```

Append to `tests/game-controls.test.ts`:

```ts
test('Daily requires its deterministic seed and New Game replays the same deal', () => {
  const flow = createFlow();
  flow.selectMenuMode('daily');

  assert.throws(() => flow.playSelectedMode(), /Daily seed/i);
  const first = flow.playSelectedMode(1n);
  const second = flow.startNewInCurrentMode();

  assert.equal(first.mode, 'daily');
  assert.equal(second.mode, 'daily');
  assert.equal(second.seed, first.seed);
});
```

Update the test helper pool to include `1n` so the Daily seed is solver-proven for that test.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test tests/game-session.test.ts tests/game-controls.test.ts
```

Expected: FAIL because `'daily'` and `startDaily()` are not implemented.

- [ ] **Step 3: Extend the technical mode and session**

In `src/game/model/types.ts`:

```ts
export type GameMode = 'original' | 'winnable' | 'daily';
```

In `GameSession` add:

```ts
startDaily(seed: bigint): Deal {
  if (!this.winnableSeeds.includes(seed)) {
    throw new Error('Daily seed must come from the solver-proven seed pool.');
  }

  this.activeDeal = createDealForMode('daily', seed);
  return this.activeDeal;
}
```

Keep `startNew(mode)` for `original`/`winnable`; throw a development error if called with `daily` so Daily cannot accidentally pick entropy:

```ts
if (mode === 'daily') {
  throw new Error('Use startDaily() with the deterministic Daily seed.');
}
```

- [ ] **Step 4: Extend `GameFlow.playSelectedMode` and New Game behavior**

Use this contract:

```ts
playSelectedMode(dailySeed?: bigint): Deal {
  // existing state/pending validation...
  const deal = this.pendingMode === 'daily'
    ? this.session.startDaily(
        dailySeed ?? (() => { throw new Error('Daily seed is required.'); })(),
      )
    : this.session.startNew(this.pendingMode);
  this.flowState = 'playing';
  return deal;
}
```

For `startNewInCurrentMode()`:

```ts
if (this.session.currentDeal.mode === 'daily') {
  return this.session.restart();
}
return this.session.startNew(this.session.currentDeal.mode);
```

Do not change restart semantics for Standard/Classic.

- [ ] **Step 5: Run focused + full verification**

```bash
node --test tests/game-session.test.ts tests/game-controls.test.ts
pnpm test
pnpm build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/model/types.ts src/game/model/GameSession.ts src/game/model/GameFlow.ts tests/game-session.test.ts tests/game-controls.test.ts
git commit -m "feat: add deterministic Daily game mode"
```

---

### Task 7: Minimal Daily/Weekly Menu State

**Files:**
- Modify: `src/game/view/MainMenuView.ts`
- Modify: `src/styles.css`
- Modify: `tests/main-menu-wiring.test.ts`

**Interfaces:**
- `MainMenuShowOptions` gains `daily: DailyMenuState`.
- New public view type:

```ts
export interface DailyMenuState {
  readonly available: boolean;
  readonly dailyId: string | null;
  readonly completed: boolean;
  readonly bestTimeMs: number | null;
  readonly weekId: string | null;
  readonly weekDailyIds: readonly string[];
  readonly completedDailyIds: readonly string[];
}
```

- [ ] **Step 1: Add failing wiring assertions**

Extend `tests/main-menu-wiring.test.ts` to assert player-facing hierarchy rather than exact CSS:

```ts
test('main menu exposes Standard Classic and Daily with weekly progress', () => {
  const menuSource = readFileSync(
    new URL('../src/game/view/MainMenuView.ts', import.meta.url),
    'utf8',
  );

  assert.match(menuSource, /СТАНДАРТ/);
  assert.match(menuSource, /КЛАССИКА/);
  assert.match(menuSource, /ИСПЫТАНИЕ ДНЯ/);
  assert.match(menuSource, /main-menu-weekly/);
  assert.match(menuSource, /bestTimeMs/);
  assert.doesNotMatch(menuSource, /ГАРАНТИРОВАННО РЕШАЕМЫЙ/);
});
```

This test protects product hierarchy/copy, not colors, coordinates, border widths, or visual assets.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/main-menu-wiring.test.ts
```

Expected: FAIL on missing Daily/weekly structure.

- [ ] **Step 3: Add the Daily menu button without redesigning the temporary menu**

In `MainMenuView`:
- rename `winnable` player copy to `СТАНДАРТ`;
- rename `original` player copy to `КЛАССИКА`;
- add a third `createModeButton('daily', 'ИСПЫТАНИЕ ДНЯ', ...)`;
- keep the existing selection/play interaction so Daily is simply another pending mode;
- disable the Daily button when `daily.available === false` and show `Серверное время недоступно` in its copy;
- when completed, show `Пройдено · Лучшее время MM:SS`;
- when incomplete, show the Daily date.

Add one small weekly DOM block below mode buttons:

```html
<section class="main-menu-weekly" aria-label="Прогресс недели">
  <div class="main-menu-weekly-title">НЕДЕЛЯ 36 · 4/7</div>
  <div class="main-menu-weekly-days">Пн ✓ · Вт ✓ · Ср ○ ...</div>
  <div class="main-menu-weekly-milestones">3 ✓ · 5 ○ · 7 ○</div>
</section>
```

Generate this from `weekDailyIds`/`completedDailyIds`; do not hardcode the sample values.

Add a small pure formatter inside `MainMenuView.ts` or a focused nearby helper for `MM:SS`:

```ts
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

CSS changes must reuse the existing parchment/bronze menu variables/classes from the current historical pass. Do not introduce a second unrelated menu style and do not add tests for exact CSS values.

- [ ] **Step 4: Run focused + full verification**

```bash
node --test tests/main-menu-wiring.test.ts
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/view/MainMenuView.ts src/styles.css tests/main-menu-wiring.test.ts
git commit -m "feat: add Daily and weekly menu state"
```

---

### Task 8: Daily Completion Overlay

**Files:**
- Create: `src/game/view/DailyCompleteView.ts`
- Create: `tests/daily-complete-view.test.ts`

**Interfaces:**
- Produces:

```ts
export interface DailyCompleteState {
  readonly elapsedMs: number;
  readonly bestTimeMs: number;
  readonly improvedBest: boolean;
  readonly weekCompleted: number;
}

export interface DailyCompleteActions {
  readonly retry: () => void;
  readonly menu: () => void;
}
```

- [ ] **Step 1: Write a failing source-structure test**

Create `tests/daily-complete-view.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/DailyCompleteView.ts', import.meta.url),
  'utf8',
);

test('Daily completion view shows run time best time weekly progress and retry/menu actions', () => {
  assert.match(source, /DAILY COMPLETE|ИСПЫТАНИЕ ДНЯ/);
  assert.match(source, /bestTimeMs/);
  assert.match(source, /weekCompleted/);
  assert.match(source, /retry/);
  assert.match(source, /menu/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/daily-complete-view.test.ts
```

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement a small native DOM overlay**

The view follows the same lifecycle as `MainMenuView`: append once to the canvas parent, `show(state)`, `hide()`, `destroy()`.

Required visible copy:

```text
ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО
Время: 4:32
Лучшее: 4:18   (or "Новый рекорд")
Эта неделя: 4 / 7

ПОВТОРИТЬ
В МЕНЮ
```

Do not add XP/coins/reward claims yet. Style with existing parchment/bronze variables, not fixed pixel snapshots.

- [ ] **Step 4: Run focused + full verification**

```bash
node --test tests/daily-complete-view.test.ts
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/view/DailyCompleteView.ts src/styles.css tests/daily-complete-view.test.ts
git commit -m "feat: add Daily completion summary"
```

---

### Task 9: Integrate Trusted Time, Persistence, Attempts, and Win Completion in GameScene

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `tests/daily-scene-wiring.test.ts`
- Modify: `src/game/view/MainMenuView.ts` only if a small public `updateDailyState()` method is cleaner than re-calling `show()`.

**Interfaces:**
- Consumes all Tasks 1–8.
- Produces no new cross-domain API; `GameScene` is the coordinator.

- [ ] **Step 1: Write a failing scene-wiring test**

Create `tests/daily-scene-wiring.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('GameScene coordinates platform meta Daily timer and completion without putting Yandex calls in solitaire model', () => {
  assert.match(scene, /initializePlatform/);
  assert.match(scene, /MetaRepository/);
  assert.match(scene, /getDailyId/);
  assert.match(scene, /getDailySeed/);
  assert.match(scene, /DailyAttemptTimer/);
  assert.match(scene, /completeDailyAttempt/);
  assert.match(scene, /visibilitychange/);
});
```

Also extend an existing model test to assert no direct `YaGames`/`ysdk` references exist under `src/game/model/**`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/daily-scene-wiring.test.ts
```

Expected: FAIL on missing integration.

- [ ] **Step 3: Add GameScene meta fields and asynchronous initialization**

Add fields conceptually equivalent to:

```ts
private platform: PlatformServices | null = null;
private metaRepository: MetaRepository | null = null;
private metaState = createDefaultMetaSave();
private dailyContext: {
  dailyId: string;
  weekId: string;
  weekDailyIds: readonly string[];
  seed: bigint;
} | null = null;
private readonly dailyTimer = new DailyAttemptTimer();
private dailyAttemptStarted = false;
private dailyCompleteView!: DailyCompleteView;
```

At the end of `create()` call `void this.initializeMeta()` and create the Daily completion view. Do not block Standard/Classic menu/gameplay while awaiting platform data.

`initializeMeta()`:

```ts
private async initializeMeta(): Promise<void> {
  this.platform = await initializePlatform();
  this.metaRepository = new MetaRepository(this.platform.playerStorage);
  this.metaState = await this.metaRepository.load();

  const now = this.platform.trustedClock.nowMs();
  if (now !== null) {
    const dailyId = getDailyId(now);
    this.dailyContext = {
      dailyId,
      weekId: getIsoWeekId(now),
      weekDailyIds: getIsoWeekDailyIds(now),
      seed: getDailySeed(dailyId, this.metaState.daily.algorithmVersion),
    };
  }

  this.refreshMenuMeta();
  this.platform.ready();
}
```

If platform load fails, `MetaRepository.load()` already returns defaults. If trusted time is null, `dailyContext` remains null and Daily is disabled.

- [ ] **Step 4: Build the `DailyMenuState` from current meta state**

`refreshMenuMeta()` must compute:
- `available = dailyContext !== null`;
- completion/best from `metaState.daily.records[dailyId]`;
- week list and completed ids from the current week only;
- if saved `weekly.weekId` is stale, display 0/7 until a Daily attempt/completion normalizes the new week; do not mutate merely by rendering.

Update the visible main menu immediately if it is open.

- [ ] **Step 5: Start a deterministic Daily from the existing Play action**

When pending menu mode is Daily:
- if `dailyContext === null`, ignore/disable Play;
- call `flow.playSelectedMode(dailyContext.seed)`;
- reset `dailyTimer` and `dailyAttemptStarted`;
- hide any previous Daily result;
- start the normal board via `startDeal(deal)`.

Standard/Classic must keep their existing path.

- [ ] **Step 6: Start attempts at the board-settled/input boundary**

Use the existing `autoFoundationStep` action wrapper in `startDeal()` rather than adding meta logic to `BoardView`:

```ts
autoFoundationStep: () => {
  const card = gameState.autoMoveToFoundation();
  if (card === null) {
    this.onBoardSettled(gameState);
  }
  return card;
},
```

`onBoardSettled(gameState)`:
- return immediately unless `gameState.mode === 'daily'` and `dailyContext !== null`;
- if attempt not started yet: `metaState = beginDailyAttempt(...)`, `dailyTimer.start(performance.now())`, mark started, queue save, then return;
- on later settlements, if `gameState.isWon`, call `finishDailyAttempt()` exactly once.

Guard with `dailyAttemptStarted` reset before completion so the same final settle cannot complete twice.

- [ ] **Step 7: Complete and persist the Daily**

`finishDailyAttempt()`:

```ts
const elapsedMs = this.dailyTimer.finish(performance.now());
const result = completeDailyAttempt(
  this.metaState,
  this.dailyContext.dailyId,
  this.dailyContext.weekId,
  elapsedMs,
);
this.metaState = result.state;
void this.metaRepository?.save(this.metaState, true);
this.refreshMenuMeta();
this.dailyCompleteView.show({
  elapsedMs,
  bestTimeMs: result.bestTimeMs,
  improvedBest: result.improvedBest,
  weekCompleted: getWeeklyProgress(this.metaState, this.dailyContext.weekId).completed,
});
```

Retry action calls the existing Daily restart path; menu action opens the main menu. Both hide the completion view first.

- [ ] **Step 8: Pause/resume timer for menu and browser visibility**

Add:

```ts
private handleVisibilityChange = (): void => {
  if (!this.dailyAttemptStarted) return;
  if (document.visibilityState === 'visible') {
    this.dailyTimer.resume(performance.now());
  } else {
    this.dailyTimer.pause(performance.now());
  }
};
```

Register in `create()`, remove in `shutdown()`.

Before opening the main menu, pause. On cancel/return to the same active Daily, resume. Starting a different mode resets the timer. This ensures main-menu time is excluded.

Ads are not part of this plan; when ads are implemented later, their platform callbacks must call the same pause/resume boundary.

- [ ] **Step 9: Ensure Daily New Game/restart semantics remain fixed-seed**

The existing `R` and `N` paths now both produce the same seed while mode is Daily due to Task 6. Every new Daily board attempt:
- clears history as today;
- resets `dailyAttemptStarted`;
- starts a fresh attempt timer after the opening chain settles;
- increments attempts once.

Do not increment attempts merely for opening the menu or selecting Daily without playing.

- [ ] **Step 10: Run focused + full verification**

```bash
node --test \
  tests/platform-services.test.ts \
  tests/meta-save.test.ts \
  tests/meta-repository.test.ts \
  tests/daily-calendar.test.ts \
  tests/daily-progress.test.ts \
  tests/daily-attempt-timer.test.ts \
  tests/game-session.test.ts \
  tests/game-controls.test.ts \
  tests/main-menu-wiring.test.ts \
  tests/daily-complete-view.test.ts \
  tests/daily-scene-wiring.test.ts
pnpm test
pnpm build
```

Expected: all tests PASS; build exits 0.

Manual local/Yandex SDK preview checklist:
1. Standard starts and plays with no Daily/meta dependency.
2. Classic starts and plays unchanged.
3. With Yandex SDK trusted time, Daily shows today's UTC date and deterministic deal.
4. Restart Daily gives identical tableau/stock seed.
5. Completing Daily shows elapsed and best time.
6. Slower replay preserves previous best; faster replay replaces it.
7. Replaying a completed Daily never increments weekly count twice.
8. A simulated week with 3/5/7 completed dates displays corresponding checkpoints.
9. Opening menu pauses timer; backgrounding tab pauses timer.
10. Refresh reloads Daily completion/best/weekly progress from platform storage.

- [ ] **Step 11: Commit**

```bash
git add src/game/scenes/GameScene.ts src/game/view/MainMenuView.ts tests/daily-scene-wiring.test.ts tests/main-menu-wiring.test.ts
git commit -m "feat: integrate Daily retention loop"
```

---

### Task 10: Documentation, Tree, and Final Phase-A Verification

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Regenerate: `TREE.txt`
- Keep: `docs/superpowers/specs/2026-09-04-retention-meta-progression-design.md`
- Keep: `docs/superpowers/plans/2026-09-04-daily-weekly-retention-foundation.md`

**Interfaces:** None; this task documents the implemented state only.

- [ ] **Step 1: Update `CURRENT_STATE.md` with only implemented facts**

Add concise bullets:
- technical Daily mode with deterministic solver-proven seed;
- Yandex Player data + trusted clock behind platform interfaces;
- Daily unlimited attempts and personal best time;
- weekly current-week completion card with 3/5/7 checkpoints;
- Daily timer pause semantics;
- Daily disabled when trusted production time is unavailable;
- next product phase is persistent statistics + generic win summary, not economy yet.

Do not describe XP, coins, shop, achievements, or ads as implemented.

- [ ] **Step 2: Update `TECH.md` architecture**

Document exact new responsibilities:

```text
src/meta/MetaSave.ts            versioned structured save + migration
src/meta/MetaRepository.ts      queued platform persistence
src/meta/DailyCalendar.ts       UTC IDs / ISO week / deterministic seed mapping
src/meta/DailyProgress.ts       pure Daily + weekly rules
src/meta/DailyAttemptTimer.ts   pause-aware per-attempt timer
src/platform/services.ts        platform-neutral persistence/time interfaces
src/platform/yandex.ts          Yandex SDK adapter
```

State explicitly that model code must not import platform/Yandex modules.

- [ ] **Step 3: Refresh tree/context**

Run:

```bash
pnpm context
```

Verify `TREE.txt` contains `src/meta/**` and the new tests, with no patch payload/install-script garbage.

- [ ] **Step 4: Fresh final verification**

Run from the real project root:

```bash
pnpm test
pnpm build
git status --short
```

Expected:
- test suite: 0 failures;
- build: exit 0;
- status contains only the intended Phase-A implementation/docs before final commit.

- [ ] **Step 5: Final Phase-A commit**

```bash
git add CURRENT_STATE.md TECH.md TREE.txt docs/superpowers src/meta src/platform src/game tests src/styles.css
git commit -m "docs: record Daily retention foundation"
```

Then:

```bash
git status
```

Expected: clean working tree.

---

## Self-Review Result

### Spec coverage for Phase A

Covered:
- Yandex platform abstraction for structured player save;
- trusted Yandex server time;
- UTC Daily IDs;
- deterministic versioned Daily seed mapping from frozen solver-proven pool;
- unlimited retries / same Daily seed;
- attempts counter;
- timer start/stop/pause semantics available in current architecture;
- personal best time;
- weekly ISO-week progress;
- 3/5/7 milestones represented and detected;
- versioned save + normalization;
- idempotent Daily completion and weekly counting;
- graceful ordinary play without trusted time;
- no global per-day leaderboard;
- minimal Daily/Weekly menu + Daily completion summary.

Explicitly deferred to later approved-spec plans:
- actual 3/5/7 reward payload/claim UI (needs XP/Coins/cosmetics);
- persistent aggregate statistics screen;
- XP/mastery;
- soft currency;
- cosmetics/shop;
- achievements;
- ads/IAP;
- global leaderboards.

### Placeholder scan

No `TBD`, `TODO`, "implement later", or unspecified "add tests/error handling" steps remain. Deferred systems are named above because they belong to later independent plans, not because this plan leaves incomplete implementation steps.

### Type consistency

The plan consistently uses:
- `PlayerStorage.load/save`;
- `TrustedClock.nowMs`;
- `MetaSaveV1`;
- `MetaRepository.load/save/retryPending`;
- `DailyAttemptTimer.start/pause/resume/finish/reset`;
- `getDailyId/getIsoWeekId/getIsoWeekDailyIds/getDailySeed`;
- `beginDailyAttempt/completeDailyAttempt/getWeeklyProgress`;
- technical `GameMode = 'original' | 'winnable' | 'daily'`.
