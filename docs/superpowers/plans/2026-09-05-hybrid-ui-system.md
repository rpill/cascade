# Cascade Solitaire Hybrid UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected gameplay HUD and stacked/modal menu system with one coherent parchment-on-wood hybrid application shell that supports Play, Rules, Statistics/Leaderboard, future Collection/Shop, result overlays, desktop, and compact landscape.

**Architecture:** Keep the accepted responsive Phaser board geometry unchanged. Build a small DOM UI component system under `src/game/view/ui/`, use a dedicated `GameControlsView` for gameplay HUD, and replace `MainMenuView` plus large Statistics/Leaderboard modals with one `AppShellView` that hosts page views in a shared content region. `GameScene` remains the coordinator for game flow/data while page views remain presentation-only.

**Tech Stack:** TypeScript, native DOM, CSS, Phaser 3.90, Node built-in test runner, existing Yandex platform boundary.

**Spec:** `docs/superpowers/specs/2026-09-05-ui-system-hybrid-shell-design.md`

## Global Constraints

- Preserve the accepted Task 2 board geometry: vertical foundations on the left, one card size per viewport, centered `foundation rail + main play area` composition.
- Desktop, tablet landscape, and phone landscape are supported; portrait gameplay remains unsupported.
- Do not change solitaire legality, Daily identity, statistics semantics, leaderboard semantics, persistence, or platform lifecycle behavior.
- Do not introduce fake shop products, prices, currency balances, rewards, or economy semantics that are not defined by product design.
- Keep primary screens no-scroll on supported landscape viewports.
- Use at most two primary paper/surface levels: shell surface and emphasized/interactive card surface.
- Do not freeze exact colours, artwork bytes, or permanent pixel coordinates in tests; protect structural UI contracts, hit sizes, semantics, no-scroll behavior, and component reuse.
- Minimum interactive target is `44 × 44 CSS px`.
- Custom inline SVG icons only; no emoji / OS-dependent icon glyphs.
- Every icon-only control requires `aria-label`; desktop tooltip text must also be keyboard discoverable through focus.
- Every task must use TDD: write the test, run RED, implement the smallest behavior, then run focused and full verification.

---

## File Structure

New shared UI files:

- `src/game/view/ui/UiIcons.ts` — canonical inline SVG icon factory shared by gameplay HUD and shell utilities.
- `src/game/view/ui/UiControls.ts` — reusable DOM helpers for icon controls, text actions, and tooltip wiring.
- `src/game/view/GameControlsView.ts` — gameplay HUD only; owns Undo / Restart / New Deal / Home DOM.
- `src/game/view/AppShellView.ts` — fullscreen shell surface, brand/header, global nav, Rules utility, contextual back-to-game action, and shared page host.
- `src/game/view/PlayPageView.ts` — Standard / Daily / Classic mode cards and compact weekly progress strip.
- `src/game/view/RulesView.ts` — full shell Rules page with concise visual examples.
- `src/game/view/StatisticsPageView.ts` — personal statistics + integrated leaderboard page; replaces both old statistics and leaderboard modals.
- `src/game/view/CollectionPageView.ts` — collection-ready shell page using shared item-card structure without inventing economy data.
- `src/game/view/ShopPageView.ts` — shop-ready shell page using the same item-card structure without fake products or prices.
- `src/game/view/ui/ItemCardView.ts` — shared item-card DOM primitive for Collection/Shop readiness.

Existing files replaced or modified:

- `src/game/view/MainMenuView.ts` — removed after `AppShellView + PlayPageView` are wired.
- `src/game/view/StatisticsView.ts` — removed after `StatisticsPageView` is wired.
- `src/game/view/LeaderboardView.ts` — removed after `StatisticsPageView` is wired.
- `src/game/view/DailyCompleteView.ts` — restyled to shared result language.
- `src/game/view/GameCompleteView.ts` — restyled to shared result language.
- `src/game/scenes/GameScene.ts` — owns shell/page lifecycle and preserves current gameplay/data flows.
- `src/styles.css` — consolidated tokens/components/responsive rules; old one-off main-menu/meta-modal style families removed as their views migrate.
- `CURRENT_STATE.md`, `TECH.md` — updated only after the full UI phase is accepted.

---

### Task 1: Shared UI Primitives + Final Gameplay HUD

**Files:**
- Create: `src/game/view/ui/UiIcons.ts`
- Create: `src/game/view/ui/UiControls.ts`
- Create: `src/game/view/GameControlsView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Create: `tests/ui-primitives.test.ts`
- Create: `tests/game-controls-view.test.ts`
- Modify: `tests/dom-ui.test.ts`
- Modify: `tests/game-controls.test.ts`
- Modify: `tests/undo-wiring.test.ts`
- Modify: `tests/visual-theme.test.mjs`

**Interfaces:**
- Produces:
  - `type UiIconName = 'undo' | 'restart' | 'new-deal' | 'home' | 'rules' | 'settings' | 'back'`
  - `createUiIcon(name: UiIconName): SVGSVGElement`
  - `createIconControl(options: IconControlOptions): HTMLButtonElement`
  - `class GameControlsView { setDaily(isDaily: boolean): void; destroy(): void }`
- `GameControlsView` action order is exactly `Undo`, `Restart`, `New Deal`, gap, `Home`.
- `Home` is always the far-right control. Daily hides New Deal.

- [ ] **Step 1: Write failing primitive/HUD tests**

Create `tests/ui-primitives.test.ts` with structural expectations:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createUiIcon } from '../src/game/view/ui/UiIcons.ts';
import { createIconControl } from '../src/game/view/ui/UiControls.ts';

test('icon controls expose accessible labels and native title fallback', () => {
  const button = createIconControl({
    icon: 'home',
    label: 'На главную',
    tooltip: 'На главную',
  });

  assert.equal(button.getAttribute('aria-label'), 'На главную');
  assert.equal(button.title, 'На главную');
  assert.equal(button.querySelector('svg')?.getAttribute('aria-hidden'), 'true');
});

test('new-deal icon is its own card-plus glyph rather than shuffle', () => {
  const svg = createUiIcon('new-deal');
  assert.equal(svg.dataset.icon, 'new-deal');
  assert.equal(svg.querySelectorAll('[data-card]').length >= 1, true);
  assert.equal(svg.querySelectorAll('[data-plus]').length, 1);
});
```

Create `tests/game-controls-view.test.ts` asserting DOM order and Daily behavior:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');

test('gameplay HUD orders safe actions before separated Home', () => {
  const undo = source.indexOf("icon: 'undo'");
  const restart = source.indexOf("icon: 'restart'");
  const next = source.indexOf("icon: 'new-deal'");
  const home = source.indexOf("icon: 'home'");
  assert.ok(undo < restart && restart < next && next < home);
  assert.match(source, /game-control-home/);
});

test('Daily hides New Deal without hiding the other controls', () => {
  assert.match(source, /setDaily\(isDaily: boolean\)/);
  assert.match(source, /this\.newDealButton\.hidden = isDaily/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --experimental-strip-types --test tests/ui-primitives.test.ts tests/game-controls-view.test.ts
```

Expected: FAIL because `UiIcons.ts`, `UiControls.ts`, and `GameControlsView.ts` do not exist.

- [ ] **Step 3: Implement the shared icon/control boundary**

Create `src/game/view/ui/UiIcons.ts` with one SVG factory and consistent attributes:

```ts
export type UiIconName =
  | 'undo'
  | 'restart'
  | 'new-deal'
  | 'home'
  | 'rules'
  | 'settings'
  | 'back';

const NS = 'http://www.w3.org/2000/svg';

function path(d: string): SVGPathElement {
  const element = document.createElementNS(NS, 'path');
  element.setAttribute('d', d);
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', '1.8');
  element.setAttribute('stroke-linecap', 'round');
  element.setAttribute('stroke-linejoin', 'round');
  return element;
}

export function createUiIcon(name: UiIconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.icon = name;

  if (name === 'home') {
    svg.append(path('M4 11.5 12 5l8 6.5'), path('M6.5 10.5V20h11v-9.5'), path('M10 20v-5h4v5'));
  } else if (name === 'undo') {
    svg.append(path('M9 7 4 12l5 5'), path('M5 12h8a6 6 0 0 1 6 6'));
  } else if (name === 'restart') {
    svg.append(path('M19 8V4l-3 3'), path('M19 5a8 8 0 1 0 1 10'));
  } else if (name === 'new-deal') {
    const card = path('M7 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z');
    card.dataset.card = 'true';
    const plus = path('M16 8h5M18.5 5.5v5');
    plus.dataset.plus = 'true';
    svg.append(card, plus);
  } else if (name === 'rules') {
    svg.append(path('M9.5 9a2.7 2.7 0 1 1 4.6 1.9c-1.4 1-2.1 1.6-2.1 3'), path('M12 18h.01'), path('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z'));
  } else if (name === 'settings') {
    svg.append(path('M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z'), path('M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.3 3h-4.6L9.3 6a7 7 0 0 0-1.7 1L5.1 6 3 9.4 5.1 11a7 7 0 0 0 0 2L3 14.6 5.1 18l2.5-1a7 7 0 0 0 1.7 1l.4 3h4.6l.4-3a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z'));
  } else {
    svg.append(path('M19 12H5'), path('m10 18-6-6 6-6'));
  }

  return svg;
}
```

Create `src/game/view/ui/UiControls.ts`:

```ts
import { createUiIcon, type UiIconName } from './UiIcons.ts';

export interface IconControlOptions {
  readonly icon: UiIconName;
  readonly label: string;
  readonly tooltip: string;
  readonly className?: string;
  readonly onClick?: () => void;
}

export function createIconControl(options: IconControlOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['ui-icon-control', options.className].filter(Boolean).join(' ');
  button.setAttribute('aria-label', options.label);
  button.title = options.tooltip;
  button.dataset.tooltip = options.tooltip;
  button.append(createUiIcon(options.icon));
  if (options.onClick !== undefined) button.addEventListener('click', options.onClick);
  return button;
}
```

- [ ] **Step 4: Implement final gameplay HUD and GameScene wiring**

Create `GameControlsView.ts` using the exact semantic order and gap class:

```ts
import type Phaser from 'phaser';
import { createIconControl } from './ui/UiControls.ts';

export interface GameControlsActions {
  readonly undo: () => void;
  readonly restart: () => void;
  readonly newDeal: () => void;
  readonly home: () => void;
}

export class GameControlsView {
  private readonly root: HTMLDivElement;
  private readonly newDealButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: GameControlsActions) {
    this.root = document.createElement('div');
    this.root.className = 'game-controls';

    const undo = createIconControl({ icon: 'undo', label: 'Отменить ход', tooltip: 'Отменить ход · Z', onClick: actions.undo });
    const restart = createIconControl({ icon: 'restart', label: 'Начать раздачу заново', tooltip: 'Начать заново · R', onClick: actions.restart });
    this.newDealButton = createIconControl({ icon: 'new-deal', label: 'Новая раздача', tooltip: 'Новая раздача · N', onClick: actions.newDeal });
    const home = createIconControl({ icon: 'home', label: 'На главную', tooltip: 'На главную', className: 'game-control-home', onClick: actions.home });

    this.root.append(undo, restart, this.newDealButton, home);
    scene.game.canvas.parentElement?.append(this.root);
  }

  setDaily(isDaily: boolean): void {
    this.newDealButton.hidden = isDaily;
  }

  destroy(): void {
    this.root.remove();
  }
}
```

Modify `GameScene` so `BoardView` owns no gameplay DOM and `GameControlsView` delegates to existing scene methods (`undoLastAction`, restart/new-game flow, `openMainMenu`). Do not change keyboard behavior.

- [ ] **Step 5: Replace old HUD CSS with shared control tokens**

Add structural variables without freezing exact colours in tests:

```css
:root {
  --ui-hit-size: 44px;
  --ui-control-gap: 8px;
  --ui-home-gap: 18px;
  --ui-radius-sm: 7px;
  --ui-shadow-soft: 0 4px 14px rgba(20, 13, 8, 0.24);
}

.game-controls {
  position: absolute;
  top: max(8px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  z-index: 20;
  display: flex;
  gap: var(--ui-control-gap);
  align-items: center;
}

.ui-icon-control {
  position: relative;
  width: var(--ui-hit-size);
  height: var(--ui-hit-size);
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--ui-bronze-dark) 70%, transparent);
  background: var(--ui-parchment);
  color: var(--ui-ink);
  box-shadow: var(--ui-shadow-soft);
}

.game-control-home { margin-left: calc(var(--ui-home-gap) - var(--ui-control-gap)); }
.ui-icon-control svg { width: 100%; height: 100%; display: block; }
.ui-icon-control::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}
.ui-icon-control:hover::after,
.ui-icon-control:focus-visible::after { opacity: 1; }
@media (hover: none) { .ui-icon-control::after { display: none; } }
```

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
node --experimental-strip-types --test tests/ui-primitives.test.ts tests/game-controls-view.test.ts tests/dom-ui.test.ts tests/game-controls.test.ts tests/undo-wiring.test.ts
node --experimental-strip-types --test tests/*.test.ts tests/*.test.mjs
pnpm test
pnpm build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 7: Visual gate and commit**

Required screenshots: desktop + phone landscape. Reject the task if Home is not far-right/separated, icon optical sizes differ, or the four controls read as unrelated button styles.

```bash
git add src/game/view/ui/UiIcons.ts src/game/view/ui/UiControls.ts src/game/view/GameControlsView.ts src/game/scenes/GameScene.ts src/styles.css tests/ui-primitives.test.ts tests/game-controls-view.test.ts tests/dom-ui.test.ts tests/game-controls.test.ts tests/undo-wiring.test.ts tests/visual-theme.test.mjs
git commit -m "feat: establish shared UI controls and gameplay HUD"
```

---

### Task 2: Hybrid App Shell + Play Destination

**Files:**
- Create: `src/game/view/AppShellView.ts`
- Create: `src/game/view/PlayPageView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Delete: `src/game/view/MainMenuView.ts`
- Create: `tests/app-shell-view.test.ts`
- Create: `tests/play-page-view.test.ts`
- Modify: `tests/main-menu-wiring.test.ts`
- Modify: `tests/menu-stats-wiring.test.ts`
- Modify: `tests/dom-ui.test.ts`
- Modify: `tests/visual-theme.test.mjs`

**Interfaces:**
- Produces:
  - `type ShellDestination = 'play' | 'statistics' | 'collection' | 'shop' | 'rules'`
  - `class AppShellView { readonly contentHost: HTMLDivElement; show(options: AppShellShowOptions): void; setDestination(destination: ShellDestination): void; hide(): void; destroy(): void }`
  - `class PlayPageView { updateDailyState(state: DailyMenuState): void; setSelectedMode(mode: GameMode | null): void; show(): void; hide(): void; destroy(): void }`
- Current `canCancel` behavior survives as a compact contextual `К игре` back action in the shell header; do not reintroduce a full-width `ЗАКРЫТЬ` button.
- Collection/Shop nav entries exist in the shell, but until their task lands they are rendered disabled with accessible `aria-disabled="true"` rather than opening fake content.

- [ ] **Step 1: Write failing shell/play tests**

Create tests requiring:

```ts
assert.match(shellSource, /CASCADE/);
assert.match(shellSource, /data-destination/);
assert.doesNotMatch(shellSource, /ГЛАВНОЕ МЕНЮ/);
assert.doesNotMatch(playSource, /НЕДЕЛЯ \$\{/);
assert.doesNotMatch(playSource, /WEEKLY_MILESTONES/);
assert.match(playSource, /На этой неделе/);
assert.match(playSource, /main-shell-mode-card/);
```

Also assert three mode cards are created through one helper/component path rather than three unrelated DOM branches.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/app-shell-view.test.ts tests/play-page-view.test.ts
```

Expected: FAIL because the new views do not exist.

- [ ] **Step 3: Implement `AppShellView`**

Use one shell root, one quiet surface, one header, one nav, and one content host:

```ts
export type ShellDestination = 'play' | 'statistics' | 'collection' | 'shop' | 'rules';

export interface AppShellActions {
  readonly navigate: (destination: ShellDestination) => void;
  readonly cancel: () => void;
}

export interface AppShellShowOptions {
  readonly canCancel: boolean;
  readonly destination: ShellDestination;
}

export class AppShellView {
  readonly contentHost: HTMLDivElement;
  // constructor creates brand, nav buttons, Rules icon, disabled Settings icon,
  // optional compact back-to-game action, and appends contentHost exactly once.
}
```

Rules is the `?` icon control and invokes `navigate('rules')`. Settings is rendered with the shared gear icon but remains disabled until a real settings contract exists; use `aria-label="Настройки"`, `aria-disabled="true"`, and no fake settings page.

- [ ] **Step 4: Implement `PlayPageView`**

Keep `DailyMenuState` semantics but replace debug week text with seven accessible dots:

```ts
private renderWeekly(state: DailyMenuState): void {
  const completed = new Set(state.completedDailyIds);
  const completedCount = state.weekDailyIds.filter((id) => completed.has(id)).length;
  this.weeklyCount.textContent = `${completedCount}/7`;
  this.weeklyDots.replaceChildren(...state.weekDailyIds.map((id) => {
    const dot = document.createElement('span');
    dot.className = 'main-shell-week-dot';
    dot.classList.toggle('is-complete', completed.has(id));
    dot.setAttribute('aria-label', `${id}: ${completed.has(id) ? 'пройдено' : 'не пройдено'}`);
    return dot;
  }));
}
```

Mode card order: Standard, Daily, Classic. All three use one `createModeCard()` helper and one CSS border family.

- [ ] **Step 5: Wire GameScene and remove old MainMenuView**

`openMainMenu()` becomes shell-show on destination `play`. `closeMainMenu()` preserves current flow/persistence semantics. `Esc` still returns to the current board only when a board exists. Mode buttons still start immediately and Daily still obeys availability.

- [ ] **Step 6: Replace old menu CSS**

Remove `.main-menu-backdrop`, heavy `.main-menu-panel` double-frame rules, `.main-menu-divider`, `.main-menu-weekly-title/days/milestones`, full-width mode-button treatment, and meta action boxes.

Add shared shell structure:

```css
.app-shell-dom { position: absolute; inset: 0; z-index: 100; }
.app-shell-surface {
  position: absolute;
  inset: clamp(16px, 4vw, 56px);
  max-width: 1180px;
  margin: auto;
  padding: clamp(18px, 3vw, 38px);
  background: var(--ui-parchment);
  box-shadow: var(--ui-shadow-soft);
  overflow: hidden;
}
.app-shell-nav { display: flex; justify-content: center; gap: clamp(18px, 3vw, 42px); }
.app-shell-nav-button { border: 0; background: none; min-height: 44px; }
.main-shell-mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 2vw, 28px); }
.main-shell-mode-card { min-width: 0; border: 1px solid var(--ui-bronze); background: var(--ui-parchment-light); }
.main-shell-weekly { display: flex; align-items: center; justify-content: center; gap: 12px; }
```

- [ ] **Step 7: Verify, visually review, commit**

Run focused + full suite + build. Required visual gate: desktop and phone landscape Play page must look like one centered composition, not a stacked form.

```bash
git add src/game/view/AppShellView.ts src/game/view/PlayPageView.ts src/game/scenes/GameScene.ts src/styles.css tests/app-shell-view.test.ts tests/play-page-view.test.ts tests/main-menu-wiring.test.ts tests/menu-stats-wiring.test.ts tests/dom-ui.test.ts tests/visual-theme.test.mjs
git add -u src/game/view/MainMenuView.ts
git commit -m "feat: replace main menu with hybrid app shell"
```

---

### Task 3: Rules as a Full Shell Page

**Files:**
- Create: `src/game/view/RulesView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Create: `tests/rules-view.test.ts`
- Modify: `tests/app-shell-view.test.ts`
- Modify: `tests/game-controls.test.ts`

**Interfaces:**
- Produces: `class RulesView { show(): void; hide(): void; destroy(): void }`
- Rules is entered from the global `?` utility and returns to the previously selected shell destination via Back.

- [ ] **Step 1: Write RED tests for required rule sections and visual examples**

Assert the source contains section identifiers for:

```text
goal
tableau
runs
foundations
stock
undo
modes
```

and a mini alternating-colour example using actual suit/rank text (`9♠`, `8♥`, `7♣`) rather than a wall of prose.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/rules-view.test.ts
```

- [ ] **Step 3: Implement Rules page**

Use one section navigation and one content pane. Desktop uses side section navigation; compact layout later converts it through CSS without changing DOM semantics.

Example data structure:

```ts
const RULE_SECTIONS = [
  { id: 'goal', title: 'Цель', body: 'Переместите все карты в четыре стопки по мастям от туза до короля.' },
  { id: 'tableau', title: 'Таблица', body: 'Кладите карты по убыванию, чередуя цвет масти.' },
  { id: 'runs', title: 'Серии', body: 'Правильно собранную последовательность можно переносить целиком.' },
  { id: 'foundations', title: 'Стопки', body: 'Каждая масть строится от туза к королю.' },
  { id: 'stock', title: 'Колода', body: 'Колода открывается по три; после исчерпания её место становится свободной ячейкой.' },
  { id: 'undo', title: 'Отмена', body: 'Отмена возвращает состояние до последнего успешного действия вместе с вызванными им автоматическими переносами.' },
  { id: 'modes', title: 'Режимы', body: 'Стандарт использует проверенные раздачи, Классика — оригинальный алгоритм, Испытание дня — одну общую раздачу на дату.' },
] as const;
```

- [ ] **Step 4: Wire navigation and verify**

Rules must not create its own fullscreen backdrop or modal panel. It mounts inside `AppShellView.contentHost` and uses shared Back/icon controls.

- [ ] **Step 5: Commit**

```bash
git add src/game/view/RulesView.ts src/game/scenes/GameScene.ts src/styles.css tests/rules-view.test.ts tests/app-shell-view.test.ts tests/game-controls.test.ts
git commit -m "feat: add visual rules shell page"
```

---

### Task 4: Statistics + Leaderboard as One Shell Destination

**Files:**
- Create: `src/game/view/StatisticsPageView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Delete: `src/game/view/StatisticsView.ts`
- Delete: `src/game/view/LeaderboardView.ts`
- Create: `tests/statistics-page-view.test.ts`
- Modify: `tests/statistics-view.test.ts`
- Modify: `tests/leaderboard-view.test.ts`
- Modify: `tests/leaderboard-scene-wiring.test.ts`
- Modify: `tests/menu-stats-wiring.test.ts`
- Modify: `tests/dom-ui.test.ts`

**Interfaces:**
- Produces:

```ts
export type StatisticsSection = 'personal' | 'leaderboard';
export interface StatisticsPageState {
  readonly mode: 'winnable' | 'original';
  readonly section: StatisticsSection;
  readonly personal: StatisticsModeState;
  readonly leaderboard: LeaderboardViewState;
}
```

- Preserve existing leaderboard request-token guards, authorization rules, public browsing, personal-row semantics, and ascending best-time behavior.

- [ ] **Step 1: Write RED tests**

Require one page root, Standard/Classic segmented switch, personal stats section, leaderboard section, top-10 truncation, auth state, and no fullscreen `.meta-modal-*` usage.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/statistics-page-view.test.ts tests/leaderboard-scene-wiring.test.ts
```

- [ ] **Step 3: Implement `StatisticsPageView`**

Use a single page with two small section tabs:

```text
СТАТИСТИКА
[ Стандарт | Классика ]
[ Личные результаты | Таблица лидеров ]
```

Personal section renders played, wins, win rate, best time using one `stat-card` component class. Leaderboard section renders the existing top-10 states and auth affordance; names remain ellipsized.

- [ ] **Step 4: Migrate GameScene without changing leaderboard service semantics**

Keep `leaderboardRequestId`, `leaderboardMode`, auth pending, `loadLeaderboard`, `requestAuthorization`, account selection reload, and historical sync. Replace only old view show/hide calls with state updates and shell destination/section selection.

- [ ] **Step 5: Delete old modal views and old modal CSS**

Remove `.statistics-dom`, `.meta-modal-dom`, `.meta-modal-panel`, `.leaderboard-panel` fullscreen-dialog architecture after new tests are green. Keep no-scroll guarantees on the shell.

- [ ] **Step 6: Verify and commit**

```bash
git add src/game/view/StatisticsPageView.ts src/game/scenes/GameScene.ts src/styles.css tests/statistics-page-view.test.ts tests/statistics-view.test.ts tests/leaderboard-view.test.ts tests/leaderboard-scene-wiring.test.ts tests/menu-stats-wiring.test.ts tests/dom-ui.test.ts
git add -u src/game/view/StatisticsView.ts src/game/view/LeaderboardView.ts
git commit -m "feat: integrate statistics and leaderboards into shell"
```

---

### Task 5: Collection / Shop Ready Page System

**Files:**
- Create: `src/game/view/ui/ItemCardView.ts`
- Create: `src/game/view/CollectionPageView.ts`
- Create: `src/game/view/ShopPageView.ts`
- Modify: `src/game/view/AppShellView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Create: `tests/item-card-view.test.ts`
- Create: `tests/collection-shop-shell.test.ts`

**Interfaces:**
- Produces:

```ts
export interface UiItemCardState {
  readonly id: string;
  readonly title: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly previewUrl?: string;
}

export class ItemCardView {
  readonly element: HTMLElement;
  update(state: UiItemCardState): void;
}
```

- No price/currency/purchase API is introduced.
- Collection and Shop use the same category-tabs and item-grid class family.
- Until real catalogs exist, both pages render polished empty states and no fake products.

- [ ] **Step 1: RED tests for shared component reuse**

Require both pages to import `ItemCardView` or share the same item-grid primitives; forbid one-off border class families per page.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/item-card-view.test.ts tests/collection-shop-shell.test.ts
```

- [ ] **Step 3: Implement reusable item-card and page skeletons**

Categories are structural only: `Рубашки`, `Столы`, `Темы`. Do not add `Эффекты` until there is a real product concept for them.

Empty states use user-facing neutral copy:

```text
Коллекция: «Здесь появятся ваши открытые оформления.»
Магазин: «Каталог оформлений пока пуст.»
```

No developer language, fake prices, fake coins, or fake ownership.

- [ ] **Step 4: Enable shell nav entries and verify**

After these pages exist, Collection and Shop nav buttons become enabled and switch shell content without modal stacking.

- [ ] **Step 5: Commit**

```bash
git add src/game/view/ui/ItemCardView.ts src/game/view/CollectionPageView.ts src/game/view/ShopPageView.ts src/game/view/AppShellView.ts src/game/scenes/GameScene.ts src/styles.css tests/item-card-view.test.ts tests/collection-shop-shell.test.ts
git commit -m "feat: add collection and shop shell foundations"
```

---

### Task 6: Result Overlays in the Shared UI Language

**Files:**
- Modify: `src/game/view/DailyCompleteView.ts`
- Modify: `src/game/view/GameCompleteView.ts`
- Modify: `src/styles.css`
- Modify: `tests/daily-complete-view.test.ts`
- Modify: `tests/game-complete-view.test.ts`
- Modify: `tests/dom-ui.test.ts`
- Modify: `tests/visual-theme.test.mjs`

**Interfaces:**
- Keep all existing state/action signatures unchanged.
- Result overlays remain true modals because keeping the completed board visible beneath them is intentional.
- They reuse shared button, typography, surface, and icon language; they do not reuse the removed old `.daily-complete-divider` / one-off border language.

- [ ] **Step 1: Write RED tests for shared class reuse**

Require result panels to use shared classes such as `ui-result-panel`, `ui-action-button`, `ui-stat-row`; forbid introducing separate new border families.

- [ ] **Step 2: Implement minimal markup migration**

Keep all completion copy and action semantics unchanged. Replace only DOM structure/classes and CSS.

- [ ] **Step 3: Verify and commit**

```bash
git add src/game/view/DailyCompleteView.ts src/game/view/GameCompleteView.ts src/styles.css tests/daily-complete-view.test.ts tests/game-complete-view.test.ts tests/dom-ui.test.ts tests/visual-theme.test.mjs
git commit -m "feat: unify result overlay styling"
```

---

### Task 7: Compact Landscape, Safe Area, Structural CSS Cleanup

**Files:**
- Modify: `src/styles.css`
- Modify: `src/game/view/AppShellView.ts`
- Modify: `src/game/view/RulesView.ts`
- Modify: `src/game/view/StatisticsPageView.ts`
- Modify: `src/game/view/CollectionPageView.ts`
- Modify: `src/game/view/ShopPageView.ts`
- Create: `tests/ui-responsive.test.ts`
- Modify: `tests/dom-ui.test.ts`
- Modify: `tests/visual-theme.test.mjs`

**Interfaces:**
- Supported compact viewports include at minimum `844×390`, `915×412`, `932×430`, `992×472`, `1024×576`.
- Shell and HUD honor safe-area insets.
- No primary shell page scrolls at supported sizes.

- [ ] **Step 1: Write RED structural responsive tests**

Assert CSS includes compact breakpoint rules, safe-area env usage, `44px` hit floor, and no `overflow:auto|scroll` on primary shell/content roots.

- [ ] **Step 2: Implement compact layout**

Required behavior:

- header height compresses;
- full text global nav may reduce to short labels but retains accessible full names;
- mode cards stay a three-card composition rather than stacked full-width buttons;
- weekly strip stays one row;
- Rules section navigation becomes horizontal/compact;
- Statistics uses compact columns/tabs;
- Collection/Shop grid reduces column count;
- result panels fit without scroll.

Use CSS media queries driven by viewport dimensions, not user-agent/device detection.

- [ ] **Step 3: Full visual matrix gate**

Manual screenshots / checks:

```text
844×390
915×412
932×430
992×472
1024×576
1366×768
1920×1080
2560×1080
3440×1440
```

Reject if shell clips, mode cards collapse into a form, touch targets become smaller than 44 px, or any primary page requires scrolling.

- [ ] **Step 4: Verify and commit**

```bash
git add src/styles.css src/game/view/AppShellView.ts src/game/view/RulesView.ts src/game/view/StatisticsPageView.ts src/game/view/CollectionPageView.ts src/game/view/ShopPageView.ts tests/ui-responsive.test.ts tests/dom-ui.test.ts tests/visual-theme.test.mjs
git commit -m "feat: complete compact hybrid UI layouts"
```

---

### Task 8: Truth Docs + Yandex UI Acceptance

**Files:**
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Modify: `TREE.txt`

**Interfaces:**
- Documentation must describe the implemented UI architecture, not the rejected modal/HUD history as current behavior.

- [ ] **Step 1: Update truth docs**

Document:

- hybrid shell architecture;
- page destinations;
- Rules page;
- integrated Statistics/Leaderboard;
- Collection/Shop-ready page system with no economy implementation;
- shared UI primitives;
- final gameplay HUD semantic order;
- compact landscape and safe-area policy;
- result overlays as the remaining true modal UI.

- [ ] **Step 2: Run complete automated verification**

```bash
pnpm test
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 3: Yandex Draft acceptance**

Check with DevTools closed:

1. Desktop Play shell is visually balanced and the board remains visible only when intended.
2. Gameplay HUD: Undo → Restart → New Deal → separated Home; Daily omits New Deal.
3. Home opens shell; contextual return-to-game works without resetting the current board.
4. Rules opens as shell content, not a modal.
5. Statistics and Leaderboard switch inside the shell; auth rules remain unchanged.
6. Collection/Shop pages use the same shell/card language and contain no fake economy data.
7. Result overlays fit and visually match the same component system.
8. `844×390`, `915×412`, `932×430`, and the real phone landscape viewport require no scroll and no clipping.
9. Resize/moderation-style viewport reduction does not produce overlap.
10. F5 regression remains fixed in Draft.

- [ ] **Step 4: Commit docs**

```bash
git add PROJECT.md CURRENT_STATE.md TECH.md TREE.txt
git commit -m "docs: record hybrid UI system"
```

---

## Self-Review

### Spec coverage

- Hybrid parchment-on-wood shell: Tasks 2 and 7.
- Play mode cards and compact week strip: Task 2.
- Correct gameplay HUD order/icons/tooltip/hit areas: Task 1.
- Rules full page: Task 3.
- Statistics + Leaderboard shell content: Task 4.
- Collection/Shop readiness without invented economy: Task 5.
- Result modal language: Task 6.
- Responsive landscape / safe area / no-scroll: Task 7.
- Final documentation and Yandex acceptance: Task 8.

No approved spec requirement is intentionally omitted. Settings is rendered as a reserved disabled global utility until a real settings contract exists; the plan does not invent settings semantics.

### Placeholder scan

The plan contains no `TBD`, `TODO`, `FIXME`, “implement later”, or unspecified “add tests/error handling” steps. Future economy/catalog/settings semantics are explicitly outside the approved spec and are not fabricated.

### Type consistency

- `ShellDestination` is defined once in Task 2 and reused by later shell pages.
- `UiIconName` / `createUiIcon` / `createIconControl` are defined in Task 1 and reused throughout.
- `StatisticsPageState` replaces old separate Statistics/Leaderboard view-state presentation while preserving existing service semantics in `GameScene`.
- Result state/action interfaces remain unchanged.
