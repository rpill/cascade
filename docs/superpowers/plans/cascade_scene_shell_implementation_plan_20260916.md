# Secondary Scene Shell Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Daily, Themes, Mastery, Leaderboards, Settings, and How to Play one shared desktop/mobile-landscape screen shell so their titles, back buttons, outer margins, top spacing, and content edges are visually identical.

**Architecture:** Add a pure `SceneShellLayout` function that computes header/back/title/right-slot/content rectangles from `ResolvedUiViewport`, then add a small `SceneShell` component that owns the shared back button and centered title. Each migrated scene keeps responsibility for its own inner content but must consume shell `contentBounds`; Settings and How to Play additionally share one centered narrow-panel helper inside those bounds.

**Tech Stack:** TypeScript 5.x, Phaser 4, Node test runner, existing `BaseUiScene`, `IconButton`, `CoinPill`, `UiViewport`, `UI_TOKENS`.

**Spec:** `docs/superpowers/specs/2026-09-16-scene-shell-design.md`

## Global Constraints

- Supported scene profiles are exactly `desktop` and `mobile-landscape`; do not add portrait behavior.
- Convert exactly Daily, Themes, Mastery, Leaderboards, Settings, and How to Play.
- Do not convert Home or the gameplay table.
- The shared shell owns page-level top/left/right/bottom geometry, square back-button geometry, centered title geometry, and the right header slot.
- Scene titles use Georgia bold and natural casing: `Daily`, `Темы`, `Мастерство`, `Таблица лидеров`, `Настройки`, `Как играть`.
- The title must remain centered on the physical viewport even when the right slot contains controls.
- Daily, Themes, Mastery, and Leaderboards use the full shared `contentBounds`.
- Settings and How to Play use the shared shell plus one shared centered narrow-panel rule inside `contentBounds`.
- Remove the bottom `Назад` action from Settings.
- Remove the bottom `Назад` action from How to Play; retain previous/next and contextual primary action only.
- Preserve existing scene behavior, data flow, scrolling, purchases, leaderboard logic, and localization other than the title-casing changes.

---

## File structure

**Create**

- `src/ui/layout/SceneShellLayout.ts` — pure shell geometry and narrow-panel geometry.
- `src/ui/components/SceneShell.ts` — shared Phaser back button + centered title; exposes latest shell layout to the owning scene.
- `tests/scene-shell-layout.test.ts` — pure desktop/mobile shell geometry tests.
- `tests/secondary-scene-shell-contract.test.mjs` — source-level regression proving all six scenes use the shell and no longer own duplicate page-level geometry.

**Modify**

- `src/ui/scenes/DailyScene.ts`
- `src/ui/daily/DailyCalendarLayout.ts`
- `src/ui/scenes/ThemesScene.ts`
- `src/ui/themes/ThemesGridLayout.ts`
- `src/ui/scenes/MasteryScene.ts`
- `src/ui/scenes/LeaderboardsScene.ts`
- `src/ui/scenes/SettingsScene.ts`
- `src/ui/scenes/HowToPlayScene.ts`
- `src/localization/English.ts`

No new UI framework or dependency is introduced.

---

### Task 1: Add the pure shared shell geometry

**Files:**
- Create: `src/ui/layout/SceneShellLayout.ts`
- Create: `tests/scene-shell-layout.test.ts`
- Read: `src/ui/layout/UiViewport.ts`
- Read: `src/ui/layout/HomeLayout.ts`

**Interfaces:**
- Consumes: `ResolvedUiViewport`, `UiRect`.
- Produces:
  - `SceneShellLayout`
  - `computeSceneShellLayout(viewport: ResolvedUiViewport): SceneShellLayout`
  - `computeNarrowScenePanel(content: UiRect, viewport: ResolvedUiViewport): UiRect`

- [ ] **Step 1: Write failing shell-geometry tests**

Create `tests/scene-shell-layout.test.ts` with real calls to the not-yet-existing helper:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import {
  computeNarrowScenePanel,
  computeSceneShellLayout,
} from '../src/ui/layout/SceneShellLayout.ts';

test('desktop shell has square back button, viewport-centered title, and shared content edges', () => {
  const viewport = resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false });
  const shell = computeSceneShellLayout(viewport);

  assert.equal(shell.back.width, shell.back.height);
  assert.equal(shell.back.x, shell.content.x);
  assert.equal(shell.content.x + shell.content.width, viewport.width - shell.content.x);
  assert.equal(shell.title.x + shell.title.width / 2, viewport.width / 2);
  assert.ok(shell.content.y > shell.header.y + shell.header.height);
});

test('mobile-landscape shell preserves the same structural contract', () => {
  const viewport = resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  const shell = computeSceneShellLayout(viewport);

  assert.equal(viewport.profile, 'mobile-landscape');
  assert.equal(shell.back.width, shell.back.height);
  assert.equal(shell.back.x, shell.content.x);
  assert.equal(shell.title.x + shell.title.width / 2, viewport.width / 2);
  assert.ok(shell.content.height > 0);
});

test('narrow panel is centered inside shell content and never exceeds it', () => {
  const viewport = resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false });
  const content = computeSceneShellLayout(viewport).content;
  const panel = computeNarrowScenePanel(content, viewport);

  assert.ok(panel.width <= content.width);
  assert.equal(panel.x + panel.width / 2, content.x + content.width / 2);
  assert.equal(panel.y, content.y);
  assert.equal(panel.height, content.height);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/scene-shell-layout.test.ts
```

Expected: FAIL because `SceneShellLayout.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure layout helper**

Create `src/ui/layout/SceneShellLayout.ts` with this public shape:

```ts
import type { UiRect } from './HomeLayout.ts';
import type { ResolvedUiViewport } from './UiViewport.ts';

export interface SceneShellLayout {
  readonly header: UiRect;
  readonly back: UiRect;
  readonly title: UiRect;
  readonly rightSlot: UiRect;
  readonly content: UiRect;
}

export function computeSceneShellLayout(viewport: ResolvedUiViewport): SceneShellLayout {
  const css = viewport.minTouchTarget / 44;
  const outer = viewport.safeMargin;
  const mobile = viewport.profile === 'mobile-landscape';
  const headerHeight = Math.max(viewport.minTouchTarget, (mobile ? 48 : 60) * css);
  const contentGap = Math.max((mobile ? 8 : 14) * css, outer * 0.35);
  const back: UiRect = { x: outer, y: outer, width: headerHeight, height: headerHeight };
  const rightWidth = Math.max(headerHeight * (mobile ? 3.1 : 3.6), 144 * css);
  const rightSlot: UiRect = {
    x: viewport.width - outer - rightWidth,
    y: outer,
    width: rightWidth,
    height: headerHeight,
  };
  const titleWidth = Math.max(1, viewport.width - (outer + headerHeight + contentGap) * 2);
  const title: UiRect = {
    x: (viewport.width - titleWidth) / 2,
    y: outer,
    width: titleWidth,
    height: headerHeight,
  };
  const contentY = outer + headerHeight + contentGap;
  const content: UiRect = {
    x: outer,
    y: contentY,
    width: Math.max(1, viewport.width - outer * 2),
    height: Math.max(1, viewport.height - contentY - outer),
  };
  return {
    header: { x: outer, y: outer, width: viewport.width - outer * 2, height: headerHeight },
    back,
    title,
    rightSlot,
    content,
  };
}

export function computeNarrowScenePanel(content: UiRect, viewport: ResolvedUiViewport): UiRect {
  const css = viewport.minTouchTarget / 44;
  const maxWidth = viewport.profile === 'desktop' ? 820 * css : content.width * 0.88;
  const width = Math.min(content.width, maxWidth);
  return {
    x: content.x + (content.width - width) / 2,
    y: content.y,
    width,
    height: content.height,
  };
}
```

Do not add scene-specific fields to this helper.

- [ ] **Step 4: Run shell tests and viewport tests**

Run:

```bash
node --test tests/scene-shell-layout.test.ts tests/ui-viewport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout/SceneShellLayout.ts tests/scene-shell-layout.test.ts
git commit -m "feat: add shared secondary scene layout"
```

---

### Task 2: Add the reusable SceneShell component

**Files:**
- Create: `src/ui/components/SceneShell.ts`
- Create: `tests/scene-shell-component-contract.test.mjs`
- Read: `src/ui/components/IconButton.ts`
- Read: `src/ui/style/UiTokens.ts`

**Interfaces:**
- Consumes: `ResolvedUiViewport`, `computeSceneShellLayout`, `UI_ICON_KEYS.back`.
- Produces:

```ts
export class SceneShell {
  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    title: string,
    onBack: () => void,
    depth?: number,
  );
  setTitle(title: string): void;
  layout(viewport: ResolvedUiViewport): SceneShellLayout;
  destroy(): void;
}
```

- [ ] **Step 1: Write a failing source contract test**

Create `tests/scene-shell-component-contract.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/components/SceneShell.ts', import.meta.url), 'utf8');

test('SceneShell owns the shared back button and centered Georgia title', () => {
  assert.match(source, /new IconButton/);
  assert.match(source, /UI_ICON_KEYS\.back/);
  assert.match(source, /Georgia, serif/);
  assert.match(source, /computeSceneShellLayout/);
  assert.match(source, /setOrigin\(0\.5\)/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/scene-shell-component-contract.test.mjs
```

Expected: FAIL because `SceneShell.ts` does not exist.

- [ ] **Step 3: Implement SceneShell**

Use `IconButton` for the back control and a single Phaser text object for the title. `layout()` must call `computeSceneShellLayout(viewport)`, update the back button viewport, lay it out at `layout.back`, and place the title exactly at the center of `layout.title`.

Title styling must be owned here, not repeated by scenes:

```ts
this.title = scene.add.text(0, 0, title, {
  color: '#f2e6c9',
  fontFamily: 'Georgia, serif',
  fontStyle: 'bold',
  align: 'center',
}).setOrigin(0.5).setDepth(depth + 0.1);
```

In `layout()` use a profile-specific font size derived from the shared header:

```ts
const fontSize = Math.max(
  20 * css,
  Math.min((viewport.profile === 'desktop' ? 34 : 27) * css, bounds.header.height * 0.60),
);
```

- [ ] **Step 4: Run component + layout tests**

```bash
node --test tests/scene-shell-component-contract.test.mjs tests/scene-shell-layout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SceneShell.ts tests/scene-shell-component-contract.test.mjs
git commit -m "feat: add reusable secondary scene shell"
```

---

### Task 3: Migrate Daily to SceneShell

**Files:**
- Modify: `src/ui/scenes/DailyScene.ts`
- Modify: `src/ui/daily/DailyCalendarLayout.ts`
- Modify: `tests/daily-calendar-layout-polish.test.ts`
- Modify/Create: `tests/secondary-scene-shell-contract.test.mjs`

**Interfaces:**
- Consumes: `SceneShell.layout(viewport): SceneShellLayout`.
- Changes `computeDailyLayout` to consume shell content instead of recomputing page-level header geometry:

```ts
export function computeDailyLayout(
  viewport: ResolvedUiViewport,
  content: UiRect,
): DailyLayout;
```

- [ ] **Step 1: Write failing Daily shell assertions**

In `tests/secondary-scene-shell-contract.test.mjs`, assert that `DailyScene.ts` imports/constructs `SceneShell`, does not construct its own back `IconButton`, and passes `shell.content` into `computeDailyLayout`.

Also update `tests/daily-calendar-layout-polish.test.ts` so it creates `content = computeSceneShellLayout(viewport).content` and verifies `summary.x === content.x` and `calendar.x + calendar.width === content.x + content.width`.

- [ ] **Step 2: Run Daily tests and verify RED**

```bash
node --test tests/daily-calendar-layout-polish.test.ts tests/daily-scene-wiring.test.ts tests/secondary-scene-shell-contract.test.mjs
```

Expected: FAIL because Daily still owns its header/home bounds.

- [ ] **Step 3: Remove page-level geometry from DailyCalendarLayout**

Change `DailyLayout` so it no longer returns `header` or `home`; retain only `summary`, `calendar`, `calendarHeader`, and `calendarGrid`. Compute the split strictly inside the supplied `content` rect.

Keep the existing summary/calendar ratio and month-navigation helper.

- [ ] **Step 4: Migrate DailyScene header**

Replace the scene-owned `homeButton` and title positioning with:

```ts
this.shell = new SceneShell(this, viewport, 'Daily', () => this.scene.start('HomeScene'), 20);
```

In `layout(viewport)`:

```ts
const shell = this.shell.layout(viewport);
const bounds = computeDailyLayout(viewport, shell.content);
this.coinPill.layout(resolveCoinPillInRightSlot(shell.rightSlot, viewport));
```

Do not move month navigation into the shell; it belongs to the calendar panel.

- [ ] **Step 5: Run the Daily suite**

```bash
node --test tests/daily-calendar-layout-polish.test.ts tests/daily-concept-polish.test.mjs tests/daily-concept-icons.test.mjs tests/daily-scene-wiring.test.ts tests/secondary-scene-shell-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/DailyScene.ts src/ui/daily/DailyCalendarLayout.ts tests/daily-calendar-layout-polish.test.ts tests/secondary-scene-shell-contract.test.mjs
git commit -m "refactor: move Daily onto shared scene shell"
```

---

### Task 4: Migrate Themes and keep the 3-column responsive grid

**Files:**
- Modify: `src/ui/scenes/ThemesScene.ts`
- Modify: `src/ui/themes/ThemesGridLayout.ts`
- Modify: `tests/collection-mobile-layout-regression.test.mjs`
- Modify: `tests/secondary-scene-shell-contract.test.mjs`

**Interfaces:**
- `computeThemesGridLayout(viewport, content, cardCount)` receives shell content and returns only grid/card geometry.
- Themes uses `shell.rightSlot` for both the reward action and coin pill without shifting the title.

- [ ] **Step 1: Write failing Themes shell/grid tests**

Update the mobile grid regression so the content rectangle comes from `computeSceneShellLayout(viewport).content`. Assert:

```ts
assert.equal(layout.columns, 3);
assert.equal(layout.content.x, content.x);
assert.equal(layout.content.width, content.width);
assert.ok(layout.cards[0]!.height >= 100);
```

Add source assertions that Themes constructs `SceneShell` and no longer lays out `back` or `title` from `ThemesGridLayout`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/collection-mobile-layout-regression.test.mjs tests/secondary-scene-shell-contract.test.mjs
```

- [ ] **Step 3: Simplify ThemesGridLayout**

Remove `back`, `title`, `coinPill`, and `coinPack` from `ThemesGridLayout`. Keep only `columns`, `content`, `cards`, `contentHeight`. Build cards relative to `{ x: 0, y: 0 }` for the `ScrollRegion` while deriving width/height from the provided shell `content`.

- [ ] **Step 4: Migrate ThemesScene**

Construct `SceneShell(..., t('Темы'), ...)`. Lay out the `ScrollRegion` on `shell.content`. Split `shell.rightSlot` into reward and coin rectangles locally using one gap derived from `viewport.safeMargin`; do not introduce a new page margin.

Preserve the current pointer/hover behavior and 3-column mobile layout.

- [ ] **Step 5: Run Themes tests**

```bash
node --test tests/collection-mobile-layout-regression.test.mjs tests/theme-daily-home-polish.test.mjs tests/theme-selection.test.ts tests/theme-runtime-integration.test.mjs tests/secondary-scene-shell-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/ThemesScene.ts src/ui/themes/ThemesGridLayout.ts tests/collection-mobile-layout-regression.test.mjs tests/secondary-scene-shell-contract.test.mjs
git commit -m "refactor: move Themes onto shared scene shell"
```

---

### Task 5: Migrate Mastery and Leaderboards to identical outer content edges

**Files:**
- Modify: `src/ui/scenes/MasteryScene.ts`
- Modify: `src/ui/scenes/LeaderboardsScene.ts`
- Modify: `tests/mastery-scene-contract.test.ts`
- Modify: `tests/leaderboard-scene-wiring.test.ts`
- Modify: `tests/secondary-scene-shell-contract.test.mjs`

**Interfaces:**
- Both scenes consume `SceneShellLayout.content` exactly as their page-level working area.
- Mastery uses `shell.rightSlot` for its coin pill.
- Leaderboards leaves `shell.rightSlot` empty.

- [ ] **Step 1: Write failing source/layout contracts**

Add assertions that:

```js
assert.match(masterySource, /new SceneShell/);
assert.match(leaderboardSource, /new SceneShell/);
assert.doesNotMatch(masterySource, /viewport\.width \* \(mobile \? 0\.025 : 0\.045\)/);
assert.doesNotMatch(leaderboardSource, /const margin = viewport\.safeMargin/);
```

Add a source contract prohibiting a page-level `1180` width cap in Leaderboards.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/mastery-scene-contract.test.ts tests/leaderboard-scene-wiring.test.ts tests/secondary-scene-shell-contract.test.mjs
```

- [ ] **Step 3: Migrate MasteryScene**

Replace its `back`, `heading`, page `margin`, `header`, `top`, and page `height` calculations with `SceneShell`. Keep all inner Mastery composition relative to:

```ts
const content = shell.content;
const x = content.x;
const y = content.y;
const width = content.width;
const height = content.height;
```

The existing Mastery art/layout may remain imperfect visually; this task only standardizes the outer shell and must not re-redesign rank cards.

- [ ] **Step 4: Migrate LeaderboardsScene**

Replace local back/title/header/margin geometry with `SceneShell`. Place tabs at the top of `shell.content`, then compute the leaderboard paper panel below tabs using only `shell.content` width. Remove any page-level `max-width: 1180` logic if present.

- [ ] **Step 5: Run Mastery + Leaderboards suites**

```bash
node --test tests/mastery-scene-contract.test.ts tests/mastery-view-model.test.ts tests/leaderboard-scene-wiring.test.ts tests/leaderboard-scroll-region.test.ts tests/leaderboard-view.test.ts tests/secondary-scene-shell-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/MasteryScene.ts src/ui/scenes/LeaderboardsScene.ts tests/mastery-scene-contract.test.ts tests/leaderboard-scene-wiring.test.ts tests/secondary-scene-shell-contract.test.mjs
git commit -m "refactor: standardize Mastery and leaderboard shells"
```

---

### Task 6: Migrate Settings and How to Play to the shell + shared narrow panel

**Files:**
- Modify: `src/ui/scenes/SettingsScene.ts`
- Modify: `src/ui/scenes/HowToPlayScene.ts`
- Modify: `tests/how-to-play-onboarding.test.ts`
- Modify: `tests/how-to-play-product-flow.test.ts`
- Modify: `tests/product-scenes-contract.test.mjs`
- Modify: `tests/secondary-scene-shell-contract.test.mjs`

**Interfaces:**
- Both scenes use `SceneShell` for back/title.
- Both call `computeNarrowScenePanel(shell.content, viewport)` for the inner paper panel.

- [ ] **Step 1: Write failing navigation/layout contracts**

Assert Settings no longer owns an `ActionCard` named `back`, and HowToPlay no longer owns a bottom `back: ActionCard`. Assert both construct `SceneShell` and call `computeNarrowScenePanel`.

For HowToPlay, assert the bottom row contains only `prev`, `next`, and `play`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/how-to-play-onboarding.test.ts tests/how-to-play-product-flow.test.ts tests/product-scenes-contract.test.mjs tests/secondary-scene-shell-contract.test.mjs
```

- [ ] **Step 3: Migrate SettingsScene**

Construct shell title `t('Настройки')` with `close()` as the back callback. Remove the bottom `ActionCard` back button entirely. Layout the paper panel from:

```ts
const shell = this.shell.layout(viewport);
const panel = computeNarrowScenePanel(shell.content, viewport);
```

Keep sound and language controls inside `panel`; derive their vertical positions from `panel.y/panel.height`, not viewport center.

- [ ] **Step 4: Migrate HowToPlayScene**

Construct shell title `t('Как играть')` with `exitHowToPlay()` as the back callback. The page-specific slide title remains inside the paper panel as content, but it must not act as the page header.

Remove the bottom `back` action. Layout `prev`, `next`, and `play` across the bottom of the narrow panel. Preserve onboarding behavior and `returnToGame` flow.

- [ ] **Step 5: Run Settings/HowToPlay tests**

```bash
node --test tests/how-to-play-onboarding.test.ts tests/how-to-play-overlay-v2.test.ts tests/how-to-play-product-flow.test.ts tests/product-scenes-contract.test.mjs tests/home-settings-polish-v2.test.mjs tests/secondary-scene-shell-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/SettingsScene.ts src/ui/scenes/HowToPlayScene.ts tests/how-to-play-onboarding.test.ts tests/how-to-play-product-flow.test.ts tests/product-scenes-contract.test.mjs tests/secondary-scene-shell-contract.test.mjs
git commit -m "refactor: standardize Settings and How to Play shells"
```

---

### Task 7: Normalize title copy/localization and lock the six-scene contract

**Files:**
- Modify: `src/localization/English.ts`
- Modify: `tests/secondary-scene-shell-contract.test.mjs`
- Modify: `tests/product-scenes-contract.test.mjs`

**Interfaces:**
- Natural-case Russian keys used by the six shell titles:
  - `Daily`
  - `Темы`
  - `Мастерство`
  - `Таблица лидеров`
  - `Настройки`
  - `Как играть`

- [ ] **Step 1: Add failing title-copy assertions**

In the shared shell contract test, assert each scene passes the natural-case title into `SceneShell` and prohibit the former all-caps title literals `ТЕМЫ`, `ТАБЛИЦА ЛИДЕРОВ`, `НАСТРОЙКИ` as page-shell headings.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/secondary-scene-shell-contract.test.mjs tests/product-scenes-contract.test.mjs
```

- [ ] **Step 3: Add/adjust English localization entries**

Ensure `English.ts` maps the natural-case keys to:

```ts
'Daily': 'Daily',
'Темы': 'Themes',
'Мастерство': 'Mastery',
'Таблица лидеров': 'Leaderboard',
'Настройки': 'Settings',
'Как играть': 'How to Play',
```

Keep old uppercase entries only if they are still used by non-shell UI; do not remove unrelated localization keys in this task.

- [ ] **Step 4: Run copy/contracts**

```bash
node --test tests/secondary-scene-shell-contract.test.mjs tests/product-scenes-contract.test.mjs tests/rules-scene-wiring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/localization/English.ts tests/secondary-scene-shell-contract.test.mjs tests/product-scenes-contract.test.mjs
git commit -m "style: normalize secondary scene titles"
```

---

### Task 8: Full regression and build verification

**Files:**
- No production files unless a regression exposed by this verification requires a focused fix.

**Interfaces:**
- Verifies the complete six-scene migration against the spec.

- [ ] **Step 1: Run the focused shared-shell suite**

```bash
node --test \
  tests/scene-shell-layout.test.ts \
  tests/scene-shell-component-contract.test.mjs \
  tests/secondary-scene-shell-contract.test.mjs \
  tests/daily-calendar-layout-polish.test.ts \
  tests/collection-mobile-layout-regression.test.mjs \
  tests/mastery-scene-contract.test.ts \
  tests/leaderboard-scene-wiring.test.ts \
  tests/how-to-play-onboarding.test.ts \
  tests/how-to-play-product-flow.test.ts \
  tests/product-scenes-contract.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

```bash
pnpm build
```

Expected: `tsc` and `vite build` both exit 0 with no TypeScript errors.

- [ ] **Step 4: Manual visual verification in Yandex dev mode**

Run:

```bash
pnpm yandex:dev
```

Verify at one desktop viewport and one mobile-landscape viewport:

1. Daily, Themes, Mastery, Leaderboards, Settings, and How to Play have the back button at the same x/y and same square size.
2. All six titles share the same Georgia bold treatment and vertical baseline.
3. All six titles remain physically centered even when Daily/Themes/Mastery show right-side controls.
4. Daily, Themes, Mastery, and Leaderboards share identical left/right content edges and content top.
5. Settings and How to Play share those outer edges through the shell while their inner paper panels use the same centered narrow-panel rule.
6. Settings has no bottom `Назад` button.
7. How to Play has no bottom `Назад`; previous/next and the contextual primary button still work.
8. No portrait-specific branch is introduced.

- [ ] **Step 5: Final commit**

If verification required no code changes, no extra commit is needed. If a focused regression fix was required, commit only that fix:

```bash
git add <exact changed files>
git commit -m "fix: close secondary scene shell regressions"
```
