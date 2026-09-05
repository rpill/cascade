# Yandex Platform Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add correct Yandex pause/resume handling and gameplay markup without letting menu, visibility, result, or platform pause reasons accidentally resume one another.

**Architecture:** Add one small pure activity-policy module, extend the existing platform-neutral services with pause and gameplay-markup capabilities, bridge `game_api_pause` / `game_api_resume` and `GameplayAPI` only inside `src/platform/yandex.ts`, then make `GameScene` reconcile timer, gameplay markup, persistence, and Phaser scene suspension from the combined state. Keep current model, save schemas, Daily rules, leaderboard behavior, and visuals unchanged.

**Tech Stack:** TypeScript, Phaser 3.90, Vite 7, Node built-in test runner, Yandex Games SDK.

**Spec:** `docs/superpowers/specs/2026-09-05-yandex-platform-lifecycle-design.md`

## Global Constraints

- Raw Yandex SDK access stays inside `src/platform/yandex.ts`.
- `src/game/model/**` stays platform-neutral.
- `AttemptTimer` remains the only attempt-timer implementation.
- External platform pause state is ephemeral and is not added to `ActiveGameSave` or `MetaSave`.
- Menu, hidden-tab, result, and platform pause are independent blockers; removing one blocker must not resume while another remains.
- `game_api_pause` / `game_api_resume` use exact `ysdk.on()` / `ysdk.off()` callback references.
- Startup pause state must be observable before slow `getPlayer()` / player-data loading finishes.
- Do not unconditionally call `GameplayAPI.start()` from every `game_api_resume`.
- Missing SDK, missing optional `GameplayAPI`, missing event APIs, and SDK exceptions must not break Standard/Classic play.
- Do not change solitaire legality, solver/deal behavior, undo, drag/drop, card assets, board theme, Daily identity, leaderboards, or save schemas.
- No advertising calls are added in this plan.
- Verification commands remain `pnpm test` and `pnpm build`.

---

## File Map

### Create

- `src/platform/GameplayActivity.ts` — pure derivation of timer/scene/markup behavior from attempt, flow, visibility, and platform pause state.
- `tests/gameplay-activity.test.ts` — exhaustive nested-blocker tests for the pure policy.
- `tests/platform-lifecycle-wiring.test.ts` — focused source-level wiring checks for GameScene lifecycle integration that are difficult to instantiate under the Node test runner.

### Modify

- `src/platform/services.ts:1-126` — add `PlatformPause` and `GameplayMarkup` interfaces and inert fallback implementations.
- `src/platform/yandex.ts:1-228` — add Yandex event bridge, gameplay-markup wrapper, exact on/off cleanup, and lazy Player acquisition so pause state is available before player-data load.
- `tests/platform-services.test.ts:1-426` — extend fake SDK coverage for pause/resume, `off`, GameplayAPI, startup pause, and failure isolation.
- `src/game/scenes/GameScene.ts:74-992` — subscribe to platform pause immediately after `initializePlatform()`, reconcile timer/markup/scene pause, checkpoint on external pause, and clean up on shutdown.
- `tests/ordinary-stats-wiring.test.ts:1-130` — protect ordinary attempt timing/completion from the new reconciliation.
- `tests/daily-scene-wiring.test.ts:1-40` — protect Daily timing/completion from the new reconciliation.
- `CURRENT_STATE.md` — record completed platform lifecycle support and next release work.
- `TECH.md` — record the platform lifecycle boundary and reconciliation invariants.

---

### Task 1: Pure Gameplay Activity Policy

**Files:**
- Create: `src/platform/GameplayActivity.ts`
- Create: `tests/gameplay-activity.test.ts`

**Interfaces:**
- Consumes: only booleans describing current runtime state.
- Produces:

```ts
export interface GameplayActivityInput {
  readonly attemptStarted: boolean;
  readonly attemptFinalized: boolean;
  readonly flowPlaying: boolean;
  readonly documentVisible: boolean;
  readonly platformPaused: boolean;
}

export type GameplayMarkupAction = 'start' | 'stop' | 'keep';

export interface GameplayActivityDecision {
  readonly timerShouldRun: boolean;
  readonly sceneShouldPause: boolean;
  readonly markupAction: GameplayMarkupAction;
}

export function deriveGameplayActivity(
  input: GameplayActivityInput,
): GameplayActivityDecision;
```

The crucial distinction is:

- local blockers (`not started`, `finalized`, `menu`, `hidden`) produce markup `stop`;
- an external Yandex pause alone produces markup `keep`, because the platform already aligns the pause event with `GameplayAPI.stop()`;
- active, visible, externally-unpaused gameplay produces markup `start`.

- [ ] **Step 1: Write the RED tests**

Create `tests/gameplay-activity.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveGameplayActivity,
} from '../src/platform/GameplayActivity.ts';

const active = {
  attemptStarted: true,
  attemptFinalized: false,
  flowPlaying: true,
  documentVisible: true,
  platformPaused: false,
} as const;

test('active visible gameplay runs timer starts markup and keeps scene live', () => {
  assert.deepEqual(deriveGameplayActivity(active), {
    timerShouldRun: true,
    sceneShouldPause: false,
    markupAction: 'start',
  });
});

test('menu is a local blocker that stops timer and gameplay markup', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    flowPlaying: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('hidden document is a local blocker that stops timer and gameplay markup', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    documentVisible: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('external platform pause freezes timer and scene without issuing a local markup stop', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    platformPaused: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: true,
    markupAction: 'keep',
  });
});

test('menu remains stopped while the platform is also paused', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    flowPlaying: false,
    platformPaused: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: true,
    markupAction: 'stop',
  });
});

test('finalized attempts stay stopped after platform resume', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    attemptFinalized: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('an attempt that has not reached the playable boundary is not marked as gameplay', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    attemptStarted: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/gameplay-activity.test.ts
```

Expected: FAIL because `src/platform/GameplayActivity.ts` does not exist.

- [ ] **Step 3: Add the minimal pure policy**

Create `src/platform/GameplayActivity.ts`:

```ts
export interface GameplayActivityInput {
  readonly attemptStarted: boolean;
  readonly attemptFinalized: boolean;
  readonly flowPlaying: boolean;
  readonly documentVisible: boolean;
  readonly platformPaused: boolean;
}

export type GameplayMarkupAction = 'start' | 'stop' | 'keep';

export interface GameplayActivityDecision {
  readonly timerShouldRun: boolean;
  readonly sceneShouldPause: boolean;
  readonly markupAction: GameplayMarkupAction;
}

export function deriveGameplayActivity(
  input: GameplayActivityInput,
): GameplayActivityDecision {
  const locallyPlayable =
    input.attemptStarted
    && !input.attemptFinalized
    && input.flowPlaying
    && input.documentVisible;

  return {
    timerShouldRun: locallyPlayable && !input.platformPaused,
    sceneShouldPause: input.platformPaused,
    markupAction: !locallyPlayable
      ? 'stop'
      : input.platformPaused
        ? 'keep'
        : 'start',
  };
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/gameplay-activity.test.ts
```

Expected: all activity-policy tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/platform/GameplayActivity.ts tests/gameplay-activity.test.ts
git commit -m "feat: add gameplay activity policy"
```

---

### Task 2: Extend the Platform-Neutral Lifecycle Boundary

**Files:**
- Modify: `src/platform/services.ts:1-126`
- Modify: `tests/platform-services.test.ts:1-426`

**Interfaces:**
- Consumes: existing `PlatformServices`.
- Produces:

```ts
export interface PlatformPause {
  isPaused(): boolean;
  subscribe(listener: (paused: boolean) => void): () => void;
}

export interface GameplayMarkup {
  start(): void;
  stop(): void;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly platformPause: PlatformPause;
  readonly gameplay: GameplayMarkup;
  readonly ready: () => void;
}
```

Unavailable services must expose:

```ts
platformPause: {
  isPaused: () => false,
  subscribe: () => () => undefined,
},
gameplay: {
  start: () => undefined,
  stop: () => undefined,
},
```

- [ ] **Step 1: Add RED fallback assertions**

Extend `tests/platform-services.test.ts` with:

```ts
test('unavailable platform exposes inert lifecycle services', () => {
  const platform = createUnavailablePlatformServices(null);

  assert.equal(platform.platformPause.isPaused(), false);

  let pauseNotifications = 0;
  const unsubscribe = platform.platformPause.subscribe(() => {
    pauseNotifications += 1;
  });
  unsubscribe();

  platform.gameplay.start();
  platform.gameplay.stop();

  assert.equal(pauseNotifications, 0);
});
```

- [ ] **Step 2: Run the focused platform test and verify RED**

Run:

```bash
node --test tests/platform-services.test.ts
```

Expected: FAIL because `PlatformServices` currently has no `platformPause` or `gameplay`.

- [ ] **Step 3: Add the new interfaces and fallback members**

In `src/platform/services.ts`, insert the interfaces after `TrustedClock`:

```ts
export interface PlatformPause {
  isPaused(): boolean;
  subscribe(listener: (paused: boolean) => void): () => void;
}

export interface GameplayMarkup {
  start(): void;
  stop(): void;
}
```

Extend `PlatformServices`:

```ts
export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly platformPause: PlatformPause;
  readonly gameplay: GameplayMarkup;
  readonly ready: () => void;
}
```

Extend `createUnavailablePlatformServices()`:

```ts
platformPause: {
  isPaused: () => false,
  subscribe: () => () => undefined,
},
gameplay: {
  start: () => undefined,
  stop: () => undefined,
},
```

Keep all existing browser storage, auth, leaderboard, and `ready()` behavior unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/platform-services.test.ts
```

Expected: all existing platform tests plus the new fallback lifecycle test PASS.

- [ ] **Step 5: Run TypeScript build boundary check**

Run:

```bash
pnpm build
```

Expected: TypeScript compiles. This catches every `PlatformServices` construction site that was not updated.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/platform/services.ts tests/platform-services.test.ts
git commit -m "feat: extend platform lifecycle boundary"
```

---

### Task 3: Bridge Yandex Pause/Resume and GameplayAPI

**Files:**
- Modify: `src/platform/yandex.ts:1-228`
- Modify: `tests/platform-services.test.ts:1-426`

**Interfaces:**
- Consumes: `PlatformPause`, `GameplayMarkup`, `PlatformServices` from Task 2.
- Produces: Yandex-backed `platformPause` and `gameplay` implementations while keeping `initializePlatform()` and `createYandexPlatformServices()` public signatures compatible.

**Required adapter behavior:**

1. subscribe to raw `game_api_pause` / `game_api_resume` immediately when `createYandexPlatformServices(ysdk)` starts;
2. cache pause state before player data finishes loading;
3. return `PlatformServices` without waiting for `getPlayer()` to resolve by making player-dependent operations lazy;
4. pair every scene subscription with exact `ysdk.on()` / `ysdk.off()` callback references;
5. keep a cache-only pause/resume listener active while there is no scene subscriber, so the next scene still sees current external state;
6. swallow both synchronous throws and asynchronous rejections from optional GameplayAPI calls.

- [ ] **Step 1: Expand the fake Yandex SDK contract**

In `tests/platform-services.test.ts`, extend the fake SDK options with event and gameplay hooks:

```ts
type EventListener = () => void;

interface FakeYsdkOptions {
  // keep all existing options
  on?: (eventName: string, listener: EventListener) => void;
  off?: (eventName: string, listener: EventListener) => void;
  gameplayStart?: () => void | Promise<void>;
  gameplayStop?: () => void | Promise<void>;
}
```

Update the fake `YandexSdk` shape so it exposes:

```ts
on: options.on,
off: options.off,
features: {
  LoadingAPI: { ready: () => undefined },
  GameplayAPI: {
    start: options.gameplayStart ?? (() => undefined),
    stop: options.gameplayStop ?? (() => undefined),
  },
},
```

For tests that need to simulate events, keep a map:

```ts
const listeners = new Map<string, Set<() => void>>();

const on = (eventName: string, listener: () => void) => {
  const set = listeners.get(eventName) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(eventName, set);
};

const off = (eventName: string, listener: () => void) => {
  listeners.get(eventName)?.delete(listener);
};

const emit = (eventName: string) => {
  listeners.get(eventName)?.forEach((listener) => listener());
};
```

- [ ] **Step 2: Write RED tests for external pause state and cleanup**

Add:

```ts
test('Yandex pause service caches pause state and emits only logical changes', async () => {
  const listeners = new Map<string, Set<() => void>>();
  const on = (eventName: string, listener: () => void) => {
    const set = listeners.get(eventName) ?? new Set<() => void>();
    set.add(listener);
    listeners.set(eventName, set);
  };
  const off = (eventName: string, listener: () => void) => {
    listeners.get(eventName)?.delete(listener);
  };
  const emit = (eventName: string) => {
    listeners.get(eventName)?.forEach((listener) => listener());
  };

  const platform = await createYandexPlatformServices(createFakeYsdk({ on, off }));
  const observed: boolean[] = [];
  const unsubscribe = platform.platformPause.subscribe((paused) => {
    observed.push(paused);
  });

  emit('game_api_pause');
  emit('game_api_pause');
  emit('game_api_resume');
  emit('game_api_resume');

  assert.deepEqual(observed, [true, false]);
  assert.equal(platform.platformPause.isPaused(), false);

  unsubscribe();
  const observedAfterUnsubscribe = [...observed];
  emit('game_api_pause');
  assert.deepEqual(observed, observedAfterUnsubscribe);
  assert.equal(platform.platformPause.isPaused(), true);
});
```

This last assertion proves the cache-only listener is restored after unsubscribe.

- [ ] **Step 3: Write RED test that exact callbacks are removed**

Add:

```ts
test('Yandex pause unsubscribe removes the exact registered callbacks', async () => {
  const registered = new Map<string, Set<() => void>>();
  const removed: Array<{ eventName: string; listener: () => void }> = [];

  const on = (eventName: string, listener: () => void) => {
    const set = registered.get(eventName) ?? new Set<() => void>();
    set.add(listener);
    registered.set(eventName, set);
  };

  const off = (eventName: string, listener: () => void) => {
    removed.push({ eventName, listener });
    registered.get(eventName)?.delete(listener);
  };

  const platform = await createYandexPlatformServices(createFakeYsdk({ on, off }));
  const unsubscribe = platform.platformPause.subscribe(() => undefined);

  const pauseListener = [...(registered.get('game_api_pause') ?? [])][0];
  const resumeListener = [...(registered.get('game_api_resume') ?? [])][0];

  unsubscribe();

  assert.ok(
    removed.some((entry) =>
      entry.eventName === 'game_api_pause' && entry.listener === pauseListener),
  );
  assert.ok(
    removed.some((entry) =>
      entry.eventName === 'game_api_resume' && entry.listener === resumeListener),
  );
});
```

When implementing the cache-listener swap, make the test capture the per-subscriber callbacks after the initial cache callbacks have been removed.

- [ ] **Step 4: Write RED startup-pause test before Player resolves**

Add:

```ts
test('Yandex pause state is available before slow Player acquisition finishes', async () => {
  let resolvePlayer!: (player: {
    getData: () => Promise<Record<string, unknown>>;
    setData: () => Promise<void>;
    isAuthorized: () => boolean;
  }) => void;

  const playerPromise = new Promise<{
    getData: () => Promise<Record<string, unknown>>;
    setData: () => Promise<void>;
    isAuthorized: () => boolean;
  }>((resolve) => {
    resolvePlayer = resolve;
  });

  const listeners = new Map<string, Set<() => void>>();
  const on = (eventName: string, listener: () => void) => {
    const set = listeners.get(eventName) ?? new Set<() => void>();
    set.add(listener);
    listeners.set(eventName, set);
  };
  const off = (eventName: string, listener: () => void) => {
    listeners.get(eventName)?.delete(listener);
  };

  const platformPromise = createYandexPlatformServices(createFakeYsdk({
    getPlayer: () => playerPromise,
    on,
    off,
  }));

  listeners.get('game_api_pause')?.forEach((listener) => listener());

  const platform = await platformPromise;
  assert.equal(platform.platformPause.isPaused(), true);

  resolvePlayer({
    getData: async () => ({}),
    setData: async () => undefined,
    isAuthorized: () => false,
  });

  assert.deepEqual(await platform.playerStorage.load(), {});
});
```

The key expectation is that `await platformPromise` completes before `resolvePlayer(...)` is called.

- [ ] **Step 5: Write RED GameplayAPI tests**

Add:

```ts
test('Yandex gameplay markup delegates to optional GameplayAPI', async () => {
  const calls: string[] = [];
  const platform = await createYandexPlatformServices(createFakeYsdk({
    gameplayStart: () => { calls.push('start'); },
    gameplayStop: () => { calls.push('stop'); },
  }));

  platform.gameplay.start();
  platform.gameplay.stop();

  assert.deepEqual(calls, ['start', 'stop']);
});

test('Yandex gameplay markup failures are non-fatal', async () => {
  const platform = await createYandexPlatformServices(createFakeYsdk({
    gameplayStart: () => { throw new Error('start failed'); },
    gameplayStop: async () => { throw new Error('stop failed'); },
  }));

  assert.doesNotThrow(() => platform.gameplay.start());
  assert.doesNotThrow(() => platform.gameplay.stop());

  await new Promise((resolve) => setTimeout(resolve, 0));
});
```

Also add a missing-feature case by deleting `ysdk.features?.GameplayAPI` before creating services and verifying `start()` / `stop()` do not throw.

- [ ] **Step 6: Run platform tests and verify RED**

Run:

```bash
node --test tests/platform-services.test.ts
```

Expected: FAIL on missing lifecycle APIs and because current `createYandexPlatformServices()` waits for Player.

- [ ] **Step 7: Extend minimal Yandex SDK types**

In `src/platform/yandex.ts`, import lifecycle interfaces:

```ts
import {
  createUnavailablePlatformServices,
  type GameplayMarkup,
  type PlatformLeaderboardEntry,
  type PlatformLeaderboards,
  type PlatformPause,
  type PlatformServices,
} from './services.ts';
```

Add:

```ts
type YandexEventListener = () => void;

interface YandexGameplayApi {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}
```

Change the Yandex SDK event shape to the documented on/off model:

```ts
export interface YandexSdk {
  getPlayer(): Promise<YandexPlayer>;
  serverTime(): number;
  isAvailableMethod(method: string): Promise<boolean>;
  auth: {
    openAuthDialog(): Promise<void>;
  };
  leaderboards?: YandexLeaderboards;
  EVENTS?: {
    ACCOUNT_SELECTION_DIALOG_CLOSED: string;
  };
  on?: (eventName: string, listener: YandexEventListener) => void;
  off?: (eventName: string, listener: YandexEventListener) => void;
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
    GameplayAPI?: YandexGameplayApi;
  };
}
```

- [ ] **Step 8: Add safe optional GameplayAPI wrapper**

Add:

```ts
function ignoreSdkCall(call: () => void | Promise<void>): void {
  try {
    void Promise.resolve(call()).catch(() => undefined);
  } catch {
    // Optional platform telemetry must never break local gameplay.
  }
}

function createGameplayMarkup(ysdk: YandexSdk): GameplayMarkup {
  return {
    start: () => {
      const start = ysdk.features?.GameplayAPI?.start;
      if (start !== undefined) {
        ignoreSdkCall(() => start.call(ysdk.features!.GameplayAPI));
      }
    },
    stop: () => {
      const stop = ysdk.features?.GameplayAPI?.stop;
      if (stop !== undefined) {
        ignoreSdkCall(() => stop.call(ysdk.features!.GameplayAPI));
      }
    },
  };
}
```

- [ ] **Step 9: Add the Yandex platform-pause bridge**

Add constants:

```ts
const GAME_API_PAUSE = 'game_api_pause';
const GAME_API_RESUME = 'game_api_resume';
```

Add a helper with these exact semantics:

```ts
function createYandexPlatformPause(ysdk: YandexSdk): PlatformPause {
  if (ysdk.on === undefined || ysdk.off === undefined) {
    return {
      isPaused: () => false,
      subscribe: () => () => undefined,
    };
  }

  let paused = false;
  let subscribers = 0;
  let cacheAttached = false;

  const cachePause = () => { paused = true; };
  const cacheResume = () => { paused = false; };

  const attachCache = () => {
    if (cacheAttached) return;
    ysdk.on!(GAME_API_PAUSE, cachePause);
    ysdk.on!(GAME_API_RESUME, cacheResume);
    cacheAttached = true;
  };

  const detachCache = () => {
    if (!cacheAttached) return;
    ysdk.off!(GAME_API_PAUSE, cachePause);
    ysdk.off!(GAME_API_RESUME, cacheResume);
    cacheAttached = false;
  };

  attachCache();

  return {
    isPaused: () => paused,
    subscribe(listener) {
      const onPause = () => {
        if (paused) return;
        paused = true;
        listener(true);
      };
      const onResume = () => {
        if (!paused) return;
        paused = false;
        listener(false);
      };

      ysdk.on!(GAME_API_PAUSE, onPause);
      ysdk.on!(GAME_API_RESUME, onResume);

      if (subscribers === 0) {
        detachCache();
      }
      subscribers += 1;

      let active = true;
      return () => {
        if (!active) return;
        active = false;

        if (subscribers === 1) {
          attachCache();
        }

        ysdk.off!(GAME_API_PAUSE, onPause);
        ysdk.off!(GAME_API_RESUME, onResume);
        subscribers -= 1;
      };
    },
  };
}
```

Important: attach subscriber callbacks before detaching the cache callbacks, and reattach cache callbacks before removing the final subscriber callbacks. JavaScript executes those transitions synchronously, so there is no listener-free window.

- [ ] **Step 10: Make Player acquisition lazy**

Replace the top of `createYandexPlatformServices()`:

```ts
export async function createYandexPlatformServices(
  ysdk: YandexSdk,
): Promise<PlatformServices> {
  let playerPromise = ysdk.getPlayer();
  let player: YandexPlayer | null = null;

  const getPlayer = async (): Promise<YandexPlayer> => {
    if (player !== null) {
      return player;
    }
    player = await playerPromise;
    return player;
  };

  const reacquirePlayer = async (): Promise<YandexPlayer> => {
    playerPromise = ysdk.getPlayer();
    player = await playerPromise;
    return player;
  };

  const platformPause = createYandexPlatformPause(ysdk);
```

Do **not** `await getPlayer()` before returning the service object.

Make player storage lazy:

```ts
playerStorage: {
  load: async () => (await getPlayer()).getData(),
  save: async (data, flush = false) =>
    (await getPlayer()).setData(data, flush),
},
```

Make auth preserve its synchronous interface without blocking initialization:

```ts
auth: {
  isAuthorized: () => player?.isAuthorized() ?? false,
  requestAuthorization: async () => {
    const currentPlayer = await getPlayer();

    if (currentPlayer.isAuthorized()) {
      return true;
    }

    try {
      await ysdk.auth.openAuthDialog();
      return (await reacquirePlayer()).isAuthorized();
    } catch {
      return false;
    }
  },
  onAccountSelectionClosed: (listener) => {
    const eventName = ysdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
    if (
      eventName === undefined
      || ysdk.on === undefined
      || ysdk.off === undefined
    ) {
      return () => undefined;
    }

    ysdk.on(eventName, listener);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      ysdk.off!(eventName, listener);
    };
  },
},
```

Add to the returned object:

```ts
platformPause,
gameplay: createGameplayMarkup(ysdk),
```

Keep leaderboards, trusted time, LoadingAPI, SDK script loading, and cached `initializePlatform()` otherwise unchanged.

- [ ] **Step 11: Run platform tests and verify GREEN**

Run:

```bash
node --test tests/platform-services.test.ts
```

Expected: all platform tests PASS, including auth and leaderboard regressions.

- [ ] **Step 12: Run full test suite and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: 0 failed tests and a successful Vite build.

- [ ] **Step 13: Commit Task 3**

```bash
git add src/platform/yandex.ts tests/platform-services.test.ts
git commit -m "feat: bridge Yandex gameplay lifecycle"
```

---

### Task 4: Reconcile Lifecycle in GameScene

**Files:**
- Modify: `src/game/scenes/GameScene.ts:74-992`
- Create: `tests/platform-lifecycle-wiring.test.ts`
- Modify: `tests/ordinary-stats-wiring.test.ts:1-130`
- Modify: `tests/daily-scene-wiring.test.ts:1-40`

**Interfaces:**
- Consumes:
  - `deriveGameplayActivity()` from Task 1;
  - `platform.platformPause` and `platform.gameplay` from Tasks 2–3.
- Produces:
  - one central `reconcileGameplayActivity()` method;
  - exact platform pause subscription cleanup;
  - Phaser scene pause/resume only for the external platform blocker.

**New GameScene fields:**

```ts
private platformPaused = false;
private platformScenePaused = false;
private gameplayMarkupActive = false;
private unsubscribePlatformPause: (() => void) | null = null;
```

- [ ] **Step 1: Write RED source-level wiring test**

Create `tests/platform-lifecycle-wiring.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

test('GameScene binds platform pause before player meta loading continues', () => {
  assert.match(
    sceneSource,
    /this\.platform = await initializePlatform\(\);[\s\S]*bindPlatformLifecycle[\s\S]*new MetaRepository/,
  );
});

test('GameScene reconciles timer markup and external scene pause from one path', () => {
  assert.match(sceneSource, /deriveGameplayActivity/);
  assert.match(sceneSource, /reconcileGameplayActivity/);
  assert.match(sceneSource, /platformPaused/);
  assert.match(sceneSource, /platformScenePaused/);
  assert.match(sceneSource, /gameplayMarkupActive/);
});

test('GameScene cleans up the platform pause subscription on shutdown', () => {
  assert.match(sceneSource, /unsubscribePlatformPause\?\.\(\)/);
  assert.match(sceneSource, /unsubscribePlatformPause = null/);
});

test('platform pause checkpoints the active game before suspension', () => {
  assert.match(
    sceneSource,
    /platformPause\.subscribe[\s\S]*checkpointActiveGame[\s\S]*reconcileGameplayActivity/,
  );
});
```

- [ ] **Step 2: Add RED regression expectations to ordinary/Daily wiring**

In `tests/ordinary-stats-wiring.test.ts`, add:

```ts
test('ordinary attempt timing uses the shared gameplay activity reconciliation', () => {
  assert.match(sceneSource, /reconcileGameplayActivity/);
  assert.match(sceneSource, /attemptTimer\.pause/);
  assert.match(sceneSource, /attemptTimer\.resume/);
  assert.match(sceneSource, /attemptFinalized/);
});
```

In `tests/daily-scene-wiring.test.ts`, add:

```ts
test('Daily uses the same platform-aware activity reconciliation as ordinary play', () => {
  assert.match(sceneSource, /deriveGameplayActivity/);
  assert.match(sceneSource, /reconcileGameplayActivity/);
  assert.doesNotMatch(sceneSource, /dailyPlatformPaused/);
});
```

The purpose is to prevent a second Daily-specific pause policy.

- [ ] **Step 3: Run the lifecycle tests and verify RED**

Run:

```bash
node --test \
  tests/platform-lifecycle-wiring.test.ts \
  tests/ordinary-stats-wiring.test.ts \
  tests/daily-scene-wiring.test.ts
```

Expected: new lifecycle assertions FAIL.

- [ ] **Step 4: Import the pure policy and add fields**

At the imports in `GameScene.ts` add:

```ts
import { deriveGameplayActivity } from '../../platform/GameplayActivity.ts';
```

Near the current platform fields add:

```ts
private platformPaused = false;
private platformScenePaused = false;
private gameplayMarkupActive = false;
private unsubscribePlatformPause: (() => void) | null = null;
```

- [ ] **Step 5: Bind platform lifecycle immediately after initializePlatform**

Change the start of `initializeMeta()` from:

```ts
this.platform = await initializePlatform();
this.metaRepository = new MetaRepository(this.platform.playerStorage);
```

to:

```ts
this.platform = await initializePlatform();
this.bindPlatformLifecycle(this.platform);
this.reconcileGameplayActivity();

this.metaRepository = new MetaRepository(this.platform.playerStorage);
```

This ordering is mandatory: GameScene sees cached startup pause state before waiting on player-data load.

- [ ] **Step 6: Add the platform lifecycle binding method**

Add:

```ts
private bindPlatformLifecycle(platform: PlatformServices): void {
  this.unsubscribePlatformPause?.();
  this.platformPaused = platform.platformPause.isPaused();

  this.unsubscribePlatformPause = platform.platformPause.subscribe((paused) => {
    this.platformPaused = paused;

    if (paused && this.gameState !== null) {
      this.pauseAttemptTimer();
      this.checkpointActiveGame(this.gameState);
    }

    this.reconcileGameplayActivity();
  });
}
```

Add the small timer helper used by lifecycle callers:

```ts
private pauseAttemptTimer(): void {
  if (this.attemptStarted && !this.attemptFinalized) {
    this.attemptTimer.pause(performance.now());
  }
}
```

- [ ] **Step 7: Add idempotent GameplayAPI markup state**

Add:

```ts
private setGameplayMarkupActive(active: boolean): void {
  const platform = this.platform;
  if (platform === null || this.gameplayMarkupActive === active) {
    return;
  }

  this.gameplayMarkupActive = active;

  if (active) {
    platform.gameplay.start();
  } else {
    platform.gameplay.stop();
  }
}
```

Do not set `gameplayMarkupActive` while `this.platform === null`; that guarantees a board that became playable before platform initialization will still issue the first real `GameplayAPI.start()` after platform initialization completes.

- [ ] **Step 8: Add central reconciliation**

Add:

```ts
private reconcileGameplayActivity(): void {
  const decision = deriveGameplayActivity({
    attemptStarted: this.attemptStarted,
    attemptFinalized: this.attemptFinalized,
    flowPlaying: this.flow?.state === 'playing',
    documentVisible: document.visibilityState === 'visible',
    platformPaused: this.platformPaused,
  });

  if (decision.timerShouldRun) {
    this.attemptTimer.resume(performance.now());
  } else {
    this.pauseAttemptTimer();
  }

  if (decision.markupAction === 'start') {
    this.setGameplayMarkupActive(true);
  } else if (decision.markupAction === 'stop') {
    this.setGameplayMarkupActive(false);
  }

  if (decision.sceneShouldPause && !this.platformScenePaused) {
    this.platformScenePaused = true;
    this.scene.pause();
  } else if (!decision.sceneShouldPause && this.platformScenePaused) {
    this.platformScenePaused = false;
    this.scene.resume();
  }
}
```

`markupAction === 'keep'` intentionally leaves our last explicit markup state unchanged. This is what prevents a plain external pause/resume pair from generating a second local stop/start pair.

- [ ] **Step 9: Replace scattered timer resume/pause decisions with reconciliation**

Make these exact call-site changes.

In restored-deal setup (`startDeal`, currently around lines 389–403):

- keep `attemptTimer.start(now, restored.elapsedMs)`;
- remove the local `restored.uiState/document.visibilityState` pause branch;
- after restored state has been installed, call:

```ts
this.reconcileGameplayActivity();
```

In first playable settlement (`onBoardSettled`, currently around lines 426–440):

- keep `attemptTimer.start(now)`, `attemptStarted = true`, and meta mutation;
- remove the local flow/visibility pause branch;
- call:

```ts
this.reconcileGameplayActivity();
```

immediately after `attemptStarted` / `attemptFinalized` are set.

In `openMainMenu()`:

- replace direct timer pause with:

```ts
this.reconcileGameplayActivity();
```

after `flow.openMainMenu()` succeeds and before/around checkpointing.

In `closeMainMenu()`:

- replace `resumeAttemptTimerIfPlayable()` with:

```ts
this.reconcileGameplayActivity();
```

In `handleVisibilityChange`:

```ts
private handleVisibilityChange = (): void => {
  if (document.visibilityState !== 'visible') {
    this.pauseAttemptTimer();
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  }

  this.reconcileGameplayActivity();
};
```

In `handlePageHide`:

```ts
private handlePageHide = (): void => {
  this.pauseAttemptTimer();
  if (this.gameState !== null) {
    this.checkpointActiveGame(this.gameState);
  }
};
```

Delete `resumeAttemptTimerIfPlayable()` once no callers remain.

- [ ] **Step 10: Stop gameplay markup on completion and reset transitions**

In `finishOrdinaryAttempt()`:

- keep the existing `attemptTimer.finish()` and stats ordering;
- after `attemptFinalized = true` and before showing completion, call:

```ts
this.reconcileGameplayActivity();
```

In `finishDailyAttempt()` do the same after `attemptFinalized = true`.

In `resetAttempt()` after resetting attempt state call:

```ts
this.reconcileGameplayActivity();
```

only when `this.flow` has already been initialized. If calling during `startDeal()` before the next attempt starts, the policy produces `stop`, which is correct between deals.

When `playMenuMode()` hides the menu and starts the next deal, the new deal must not be marked active until `onBoardSettled()` starts the attempt.

- [ ] **Step 11: Handle Phaser external scene pause safely**

Keep scene suspension tied only to `platformPaused`.

Do not pause the Phaser scene merely because the main menu is open; the DOM menu and current board rendering continue using existing behavior.

On `game_api_pause`:

1. pause timer;
2. checkpoint active game;
3. reconcile, which sets `platformScenePaused` and calls `this.scene.pause()`.

On `game_api_resume`:

1. update `platformPaused = false`;
2. reconcile;
3. `this.scene.resume()` only if this integration previously paused it.

Menu/result/visibility state still decides whether timer or gameplay markup actually resumes.

- [ ] **Step 12: Add shutdown cleanup**

At the top of `shutdown()` before destroying views:

```ts
this.setGameplayMarkupActive(false);
this.unsubscribePlatformPause?.();
this.unsubscribePlatformPause = null;

if (this.platformScenePaused) {
  this.platformScenePaused = false;
}
```

Do not call `this.scene.resume()` during shutdown.

Keep existing account-selection unsubscribe, DOM lifecycle cleanup, timer reset, view destruction, and board destruction.

- [ ] **Step 13: Run focused lifecycle tests**

Run:

```bash
node --test \
  tests/gameplay-activity.test.ts \
  tests/platform-services.test.ts \
  tests/platform-lifecycle-wiring.test.ts \
  tests/ordinary-stats-wiring.test.ts \
  tests/daily-scene-wiring.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 14: Run full verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: 0 failed tests; TypeScript and Vite build succeed.

- [ ] **Step 15: Commit Task 4**

```bash
git add \
  src/game/scenes/GameScene.ts \
  tests/platform-lifecycle-wiring.test.ts \
  tests/ordinary-stats-wiring.test.ts \
  tests/daily-scene-wiring.test.ts
git commit -m "feat: reconcile Yandex gameplay lifecycle"
```

---

### Task 5: Document and Verify the Real Yandex Lifecycle

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`

**Interfaces:**
- Consumes: completed lifecycle implementation.
- Produces: current project truth and a reproducible real-draft acceptance sequence.

- [ ] **Step 1: Update CURRENT_STATE**

Under the platform/Yandex section add these concrete implemented facts:

```md
- Yandex `game_api_pause` / `game_api_resume` are isolated behind the platform boundary and pause/resume the active gameplay lifecycle without creating a second timer policy.
- Startup pause state is captured before slow Player/meta loading, so restored or quickly-started boards do not run behind the startup ad.
- `GameplayAPI.start()` / `stop()` mark playable gameplay, menu transitions, visibility transitions, and completion while preserving Yandex's external pause/resume semantics.
- External platform pause freezes Phaser gameplay and checkpoints the active board; resume only restores the timer/input when menu, result, visibility, and attempt state also permit it.
```

Update “Current next focus” so the next step is advertising at logical pauses, then localization/platform declarations/release verification.

- [ ] **Step 2: Update TECH**

Add a platform lifecycle subsection containing:

```md
## Platform gameplay lifecycle

- `PlatformServices.platformPause` exposes cached external pause state plus one platform-neutral subscription API.
- `PlatformServices.gameplay` wraps optional Yandex `GameplayAPI.start()` / `stop()` and is inert outside Yandex.
- `src/platform/GameplayActivity.ts` is the pure blocker policy for attempt timer, external scene pause, and local gameplay-markup decisions.
- `GameScene.reconcileGameplayActivity()` is the single coordinator for menu, visibility, result, attempt, and external platform pause state.
- Yandex event callbacks are registered/unregistered with matching `ysdk.on()` / `ysdk.off()` callback references.
- External platform pause state is runtime-only and is not persisted in `cascadeActiveGame` or `cascadeMeta`.
```

- [ ] **Step 3: Run final automated verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: 0 failed tests and successful build.

- [ ] **Step 4: Commit documentation**

```bash
git add CURRENT_STATE.md TECH.md
git commit -m "docs: document Yandex gameplay lifecycle"
```

- [ ] **Step 5: Build a Yandex draft archive using the known-safe ZIP method**

Do not use PowerShell `Compress-Archive`.

Run:

```powershell
Remove-Item .\cascade-yandex.zip -ErrorAction SilentlyContinue
Push-Location .\dist
tar -a -c -f ..\cascade-yandex.zip *
Pop-Location
```

Validate central-directory separators:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path .\cascade-yandex.zip))
$zip.Entries |
  Select-Object -First 20 -ExpandProperty FullName
$zip.Dispose()
```

Expected: nested entries use `/`, never `\`.

- [ ] **Step 6: Run Yandex debug-panel acceptance**

In a new Yandex Draft with debug mode enabled, verify these exact scenarios:

1. Startup ad: board/timer do not advance while the platform Play indicator is paused.
2. Debug Play/Pause button:
   - pause freezes card motion/input/timer;
   - resume restores active gameplay.
3. Open `В МЕНЮ`:
   - gameplay gamepad indicator is stopped/red;
   - trigger external pause then resume;
   - gamepad remains stopped because the menu is still open.
4. Close menu:
   - gameplay becomes active/green immediately when no external blocker remains.
5. Switch browser tabs:
   - timer does not count hidden time;
   - return resumes only if menu/result is not blocking.
6. Finish Standard/Classic or Daily when convenient:
   - result view keeps gameplay markup stopped.
7. F5 an unfinished game:
   - exact board restore and elapsed-time behavior remain correct.
8. Optional-API resilience:
   - ordinary play still works if lifecycle markup is unavailable in a local/unavailable-platform path.

Record any failing scenario before changing implementation; do not patch from assumptions.

---

## Plan Self-Review

### Spec coverage

- Platform-neutral pause service: Task 2.
- Gameplay markup service: Task 2.
- Startup pause before Player/meta: Task 3.
- Exact Yandex on/off pairing: Task 3.
- GameplayAPI error isolation: Task 3.
- One GameScene reconciliation path: Task 4.
- Nested menu/visibility/platform/result blockers: Tasks 1 and 4.
- Phaser external pause: Task 4.
- Checkpoint on external pause: Task 4.
- No save-schema changes: global constraints + Task 4.
- Shutdown cleanup: Task 4.
- Unavailable-platform fallback: Tasks 2 and 3.
- Full tests/build: Tasks 3–5.
- Real Yandex debug acceptance: Task 5.
- Ads remain out of scope: global constraints.

### Type consistency

The plan uses the same names throughout:

- `PlatformPause`
- `GameplayMarkup`
- `platformPause`
- `gameplay`
- `GameplayActivityInput`
- `GameplayActivityDecision`
- `deriveGameplayActivity`
- `reconcileGameplayActivity`
- `platformPaused`
- `platformScenePaused`
- `gameplayMarkupActive`
- `unsubscribePlatformPause`

No new persistent field is introduced.
