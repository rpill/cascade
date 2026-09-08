# Green Felt Club Theme Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one complete `green_felt_club` cosmetic theme alongside the existing Walnut baseline, selectable through `?theme=green_felt_club`, with original generated assets, safe per-asset fallback, unchanged gameplay/layout, and a reusable registry-driven theme contract.

**Architecture:** Add a small `src/theme/` domain containing immutable theme definitions, selection, runtime asset fallback, and DOM token application. `BootScene` selects the preview theme and preloads only Walnut plus the selected theme; `BoardView` and `AppShellView` consume the active definition through one shared runtime accessor instead of theme-specific branches. Green Felt art ships as isolated production assets under `public/assets/themes/green-felt-club/`; no Collection, ownership, XP, Coins, or persistence writes are introduced in this pilot.

**Tech Stack:** TypeScript, Phaser `^3.90.0`, Vite `^7`, native DOM/CSS, Node built-in test runner, PNG/JPEG/SVG runtime assets, ChatGPT image generation plus local raster post-processing for original theme art.

**Spec:** `docs/superpowers/specs/2026-09-07-theme-system-green-felt-pilot-design.md`

## Global Constraints

- Themes are cosmetic only: no solitaire rule, RNG/deal identity, move geometry, timing, scoring, responsive layout, hit-area, camera, or face-card changes.
- The current gameplay screenshot/layout is structurally locked; generated concepts may change cosmetics only.
- `walnut_study` stays the default and guaranteed fallback.
- Pilot selection precedence is valid `?theme=` preview override, then a future persisted equipped value if supplied to the pure selector, then `walnut_study`.
- The preview query must not write theme ownership/equipment to `MetaSave` or active-game checkpoints.
- Green Felt board surface target is `2048 × 2048`; Green Felt card back target is `360 × 480` PNG.
- Green Felt direction is deep green felt + warm ivory + antique brass + burgundy card back; no neon casino, glossy casino UI, props, or flattened gameplay screenshot assets.
- Hybrid Shell geometry, page structure, typography hierarchy, Rules layout, Statistics layout, and button/icon geometry remain shared across themes.
- Missing Green Felt board/back/cursor assets must degrade to Walnut board, default red back, and native cursor respectively; cosmetic failure must never prevent play.
- Theme runtime code must be registry-driven; no `if (theme === 'green_felt_club')` branches scattered through Board, Shell, Rules, or Statistics.
- Do not hash-lock generated artwork, exact temporary colours, or decorative coordinates in tests.
- Do not add Collection, Shop, Coins, XP, levels, achievements, purchases, rewarded-ad payouts, extra face decks, extra themes, theme-specific sounds, or arbitrary component mixing in this pilot.
- Normal verification remains `pnpm test` and `pnpm build`; final manual smoke also includes `pnpm yandex:dev` in the actual Yandex/proxy path.

---

## File Structure

Create these focused theme-domain files:

- `src/theme/ThemeDefinition.ts` — public theme types and IDs.
- `src/theme/ThemeRegistry.ts` — immutable Walnut and Green Felt definitions plus lookup/fallback.
- `src/theme/ThemeSelection.ts` — pure preview/persisted/default precedence; never persists.
- `src/theme/ThemeRuntime.ts` — scene registry key, active-theme lookup, per-asset texture fallback.
- `src/theme/ThemeDom.ts` — apply shared theme CSS variables/data attribute to the game host.

Create these Green Felt runtime assets:

- `public/assets/themes/green-felt-club/board-surface.jpg`
- `public/assets/themes/green-felt-club/card-back.png`
- `public/assets/themes/green-felt-club/cursor.svg`

Modify only the integration points that already own the affected responsibility:

- `src/game/scenes/BootScene.ts` — select theme, preload default + selected raster assets, store active ID, apply host tokens.
- `src/game/view/BoardTexture.ts` — resolve active/fallback board texture key.
- `src/game/view/BoardView.ts` — consume theme board/card-back/slot/symbol colours; do not touch layout math.
- `src/game/view/AppShellView.ts` — derive environment asset CSS variables from active theme instead of hard-coded wood.
- `src/styles.css` — consume theme cursor/accent variables while retaining Walnut defaults.
- `CURRENT_STATE.md` — record the pilot only after visual/Yandex acceptance.
- `TECH.md` — record the registry/fallback boundary only after acceptance.

Tests:

- `tests/theme-registry.test.ts`
- `tests/theme-selection.test.ts`
- `tests/theme-assets.test.mjs`
- `tests/theme-runtime.test.ts`
- `tests/theme-board-wiring.test.mjs`
- `tests/theme-shell-wiring.test.mjs`
- update `tests/board-texture-wiring.test.mjs`
- update `tests/visual-theme.test.mjs`
- update `tests/card-assets.test.ts` only where it currently assumes the sole back is `redBack.png`; face-card assertions stay untouched.

---

### Task 1: Central Theme Contract, Registry, and Preview Selection

**Files:**
- Create: `src/theme/ThemeDefinition.ts`
- Create: `src/theme/ThemeRegistry.ts`
- Create: `src/theme/ThemeSelection.ts`
- Test: `tests/theme-registry.test.ts`
- Test: `tests/theme-selection.test.ts`

**Interfaces:**
- Produces: `ThemeId`, `ThemeDefinition`, `ThemeAssetRef`, `DEFAULT_THEME_ID`, `getTheme(id)`, `isThemeId(value)`, `resolveThemeId(search, persistedThemeId?)`.
- Consumes: no Phaser APIs; these files stay pure so selection/fallback semantics are testable in Node.

- [ ] **Step 1: Write failing registry tests**

Create `tests/theme-registry.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
} from '../src/theme/ThemeRegistry.ts';

test('Walnut Study is the stable default theme', () => {
  assert.equal(DEFAULT_THEME_ID, 'walnut_study');
  assert.equal(getTheme().id, 'walnut_study');
  assert.equal(getTheme('walnut_study').cardBack.key, 'card-back');
  assert.equal(getTheme('walnut_study').boardSurface.key, 'cascade-board-surface');
});

test('Green Felt Club is a complete registry theme', () => {
  const theme = getTheme('green_felt_club');

  assert.equal(theme.id, 'green_felt_club');
  assert.match(theme.boardSurface.url, /green-felt-club\/board-surface\.jpg$/);
  assert.match(theme.cardBack.url, /green-felt-club\/card-back\.png$/);
  assert.match(theme.cursor?.url ?? '', /green-felt-club\/cursor\.svg$/);
  assert.ok(theme.shellEnvironment.length > 0);
});

test('unknown ids never escape the registry and fall back to Walnut', () => {
  assert.equal(isThemeId('green_felt_club'), true);
  assert.equal(isThemeId('missing_theme'), false);
  assert.equal(getTheme('missing_theme').id, 'walnut_study');
});
```

Create `tests/theme-selection.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveThemeId } from '../src/theme/ThemeSelection.ts';

test('valid preview query overrides a persisted equipped theme', () => {
  assert.equal(
    resolveThemeId('?theme=green_felt_club', 'walnut_study'),
    'green_felt_club',
  );
});

test('invalid preview query falls through to a valid persisted theme', () => {
  assert.equal(
    resolveThemeId('?theme=does_not_exist', 'green_felt_club'),
    'green_felt_club',
  );
});

test('missing or invalid inputs fall back to Walnut without mutation', () => {
  assert.equal(resolveThemeId('', null), 'walnut_study');
  assert.equal(resolveThemeId('?theme=nope', 'nope'), 'walnut_study');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/theme-registry.test.ts tests/theme-selection.test.ts
```

Expected: FAIL because `src/theme/ThemeRegistry.ts` / `ThemeSelection.ts` do not exist yet.

- [ ] **Step 3: Implement the minimal theme types and registry**

Create `src/theme/ThemeDefinition.ts`:

```ts
export type ThemeId = 'walnut_study' | 'green_felt_club';

export interface ThemeAssetRef {
  readonly key: string;
  readonly url: string;
}

export interface ThemeCursorRef {
  readonly url: string;
  readonly hotspotX: number;
  readonly hotspotY: number;
}

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  readonly boardSurface: ThemeAssetRef;
  readonly cardBack: ThemeAssetRef;
  readonly shellEnvironment: string;
  readonly shellDetail?: string;
  readonly cursor?: ThemeCursorRef;
  readonly colors: {
    readonly boardTint: number;
    readonly slotFill: number;
    readonly slotStroke: number;
    readonly foundationSymbol: string;
    readonly redFoundationSymbol: string;
    readonly highlight: number;
    readonly shellAccent: string;
    readonly shellAccentDark: string;
  };
}
```

Create `src/theme/ThemeRegistry.ts`:

```ts
import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const DEFAULT_THEME_ID: ThemeId = 'walnut_study';

const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  walnut_study: {
    id: 'walnut_study',
    name: 'Walnut Study',
    boardSurface: {
      key: 'cascade-board-surface',
      url: './assets/theme/fine-grained-wood.jpg',
    },
    cardBack: {
      key: 'card-back',
      url: './assets/cards/redBack.png',
    },
    shellEnvironment: './assets/theme/menu-dark-wood.jpg',
    shellDetail: './assets/theme/fine-grained-wood.jpg',
    colors: {
      boardTint: 0x8a7b6d,
      slotFill: 0x1a140f,
      slotStroke: 0x8a7047,
      foundationSymbol: '#9a7b4f',
      redFoundationSymbol: '#7a312a',
      highlight: 0xd6c39b,
      shellAccent: '#8a7047',
      shellAccentDark: '#5c452c',
    },
  },
  green_felt_club: {
    id: 'green_felt_club',
    name: 'Green Felt Club',
    boardSurface: {
      key: 'cascade-board-surface-green-felt-club',
      url: './assets/themes/green-felt-club/board-surface.jpg',
    },
    cardBack: {
      key: 'card-back-green-felt-club',
      url: './assets/themes/green-felt-club/card-back.png',
    },
    shellEnvironment: './assets/themes/green-felt-club/board-surface.jpg',
    cursor: {
      url: './assets/themes/green-felt-club/cursor.svg',
      hotspotX: 2,
      hotspotY: 2,
    },
    colors: {
      boardTint: 0xffffff,
      slotFill: 0x142c23,
      slotStroke: 0xa78349,
      foundationSymbol: '#c5aa73',
      redFoundationSymbol: '#9b5b55',
      highlight: 0xe9dfc7,
      shellAccent: '#a78349',
      shellAccentDark: '#6d5632',
    },
  },
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'walnut_study' || value === 'green_felt_club';
}

export function getTheme(id: string = DEFAULT_THEME_ID): ThemeDefinition {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME_ID];
}
```

Create `src/theme/ThemeSelection.ts`:

```ts
import type { ThemeId } from './ThemeDefinition.ts';
import { DEFAULT_THEME_ID, isThemeId } from './ThemeRegistry.ts';

export function resolveThemeId(
  search: string,
  persistedThemeId: string | null = null,
): ThemeId {
  const previewId = new URLSearchParams(search).get('theme');

  if (isThemeId(previewId)) {
    return previewId;
  }

  if (isThemeId(persistedThemeId)) {
    return persistedThemeId;
  }

  return DEFAULT_THEME_ID;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
node --test tests/theme-registry.test.ts tests/theme-selection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full suite before committing the domain contract**

```bash
pnpm test
pnpm build
```

Expected: both commands exit 0; no existing gameplay/UI test changes are needed in this task.

- [ ] **Step 6: Commit**

```bash
git add src/theme tests/theme-registry.test.ts tests/theme-selection.test.ts
git commit -m "feat: add theme registry contract"
```

---

### Task 2: Produce and Validate the Green Felt Runtime Art Pack

**Files:**
- Create: `public/assets/themes/green-felt-club/board-surface.jpg`
- Create: `public/assets/themes/green-felt-club/card-back.png`
- Create: `public/assets/themes/green-felt-club/cursor.svg`
- Test: `tests/theme-assets.test.mjs`

**Interfaces:**
- Consumes: exact URLs declared by `ThemeRegistry.ts` in Task 1.
- Produces: one isolated board surface, one card-back bitmap, one cursor asset; no concept collage or flattened gameplay screenshot is copied to `public/`.

- [ ] **Step 1: Write a failing asset-contract test before creating production assets**

Create `tests/theme-assets.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../public/assets/themes/green-felt-club/', import.meta.url);

function pngSize(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function jpegSize(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }

  throw new Error('JPEG dimensions not found');
}

test('Green Felt runtime assets exist without shipping concept screenshots', () => {
  assert.equal(existsSync(new URL('board-surface.jpg', root)), true);
  assert.equal(existsSync(new URL('card-back.png', root)), true);
  assert.equal(existsSync(new URL('cursor.svg', root)), true);
});

test('Green Felt board surface and card back use the production dimensions', () => {
  const surface = jpegSize(readFileSync(new URL('board-surface.jpg', root)));
  const back = pngSize(readFileSync(new URL('card-back.png', root)));

  assert.deepEqual(surface, { width: 2048, height: 2048 });
  assert.deepEqual(back, { width: 360, height: 480 });
});

test('Green Felt cursor is an SVG with explicit dimensions', () => {
  const cursor = readFileSync(new URL('cursor.svg', root), 'utf8');
  assert.match(cursor, /<svg\b/);
  assert.match(cursor, /width="\d+"/);
  assert.match(cursor, /height="\d+"/);
  assert.doesNotMatch(cursor, /<image\b|data:image\//);
});
```

- [ ] **Step 2: Run the asset test and verify RED**

```bash
node --test tests/theme-assets.test.mjs
```

Expected: FAIL because the Green Felt production directory/assets do not yet exist.

- [ ] **Step 3: Generate the board surface as original production art**

Use image generation with this art brief, not the gameplay concept screenshot:

```text
Seamless square top-down card-table felt surface for an original solitaire game.
Deep restrained private-club green, approximately #315B46, with subtle fine wool fibres
and gentle natural tonal variation. Perfectly flat orthographic material sample, even
lighting, no perspective, no table edge, no cards, no UI, no seams, no folds, no stains,
no poker markings, no logos, no text, no vignette, no props. Quiet low-contrast texture
that keeps cream playing cards as the strongest visual objects. Premium but understated,
not casino neon, not glossy, not a 3D room.
```

Generate multiple candidates, choose the quietest one that reads as felt at gameplay scale, then post-process the chosen source to exactly `2048 × 2048` and save as opaque JPEG at:

```text
public/assets/themes/green-felt-club/board-surface.jpg
```

The post-process must not add a baked viewport vignette. Use high-quality resampling and JPEG quality around 88–92; visually inspect for obvious tiling seams before accepting.

- [ ] **Step 4: Generate the burgundy card back against the approved felt**

Use image generation with this art brief:

```text
Original vertical playing-card back artwork for an elegant private card club theme.
Burgundy / oxblood field, warm ivory and muted antique-brass ornament, strong clean outer
frame, restrained symmetrical vintage geometry with subtle Art Nouveau influence. Designed
to remain readable at small solitaire stock size against deep green felt. Two-way / vertically
balanced composition, broad shapes rather than microscopic filigree. No logos, letters,
trademarks, suits, characters, scenes, casino chips, gradients that look plastic, or copied
recognizable commercial card-back patterns. Flat print artwork, front-facing, no perspective,
no mockup, no surrounding table.
```

Select the candidate whose silhouette/ornament still reads when shown around `84 × 118` CSS pixels. Crop/resize to exactly `360 × 480`, preserve clean edges, and save:

```text
public/assets/themes/green-felt-club/card-back.png
```

Do not alter any of the 52 face-card files.

- [ ] **Step 5: Create the theme cursor as a clean vector asset**

Create `public/assets/themes/green-felt-club/cursor.svg` as a small original arrow rather than shipping a noisy generated raster. Start with this exact simple structure and tune only after in-game review:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34" fill="none">
  <path d="M3 2.5L23.5 18.2L14.7 19.7L19.4 29.2L14.2 31.6L9.8 22L4 28.2L3 2.5Z"
        fill="#E9DFC7" stroke="#29251F" stroke-width="2" stroke-linejoin="round"/>
  <path d="M13.8 18.7L20.2 18" stroke="#A78349" stroke-width="2" stroke-linecap="round"/>
</svg>
```

Keep the hotspot near `(2, 2)` as declared in the registry.

- [ ] **Step 6: Run asset tests and inspect the three assets together**

```bash
node --test tests/theme-assets.test.mjs
```

Expected: PASS.

Manual checkpoint before integration: place the existing `redBack.png` and the new Green Felt back on the generated felt at normal and minimum card sizes. Reject the art if the new back disappears into the felt or if felt fibres compete with face-card ranks/suits.

- [ ] **Step 7: Commit only final runtime assets, never concept sheets**

```bash
git add public/assets/themes/green-felt-club tests/theme-assets.test.mjs
git commit -m "art: add green felt club theme assets"
```

---

### Task 3: Runtime Theme Selection, Preload, and Safe Texture Fallback

**Files:**
- Create: `src/theme/ThemeRuntime.ts`
- Modify: `src/game/scenes/BootScene.ts`
- Modify: `src/game/view/BoardTexture.ts`
- Test: `tests/theme-runtime.test.ts`
- Modify: `tests/board-texture-wiring.test.mjs`

**Interfaces:**
- Consumes: `ThemeDefinition`, `getTheme`, `resolveThemeId` from Task 1.
- Produces: `ACTIVE_THEME_REGISTRY_KEY`, `getActiveTheme(scene)`, `chooseThemeAssetKey(hasKey, preferred, fallback)`, `getBoardTexture(scene)`, and BootScene registry initialization.

- [ ] **Step 1: Write failing runtime fallback tests**

Create `tests/theme-runtime.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { chooseThemeAssetKey } from '../src/theme/ThemeRuntime.ts';

test('preferred theme asset is used when it loaded successfully', () => {
  const green = getTheme('green_felt_club');
  const walnut = getTheme('walnut_study');
  const available = new Set([green.boardSurface.key, walnut.boardSurface.key]);

  assert.equal(
    chooseThemeAssetKey((key) => available.has(key), green.boardSurface, walnut.boardSurface),
    green.boardSurface.key,
  );
});

test('missing theme asset falls back to the Walnut asset key', () => {
  const green = getTheme('green_felt_club');
  const walnut = getTheme('walnut_study');
  const available = new Set([walnut.cardBack.key]);

  assert.equal(
    chooseThemeAssetKey((key) => available.has(key), green.cardBack, walnut.cardBack),
    walnut.cardBack.key,
  );
});
```

Update `tests/board-texture-wiring.test.mjs` so it no longer requires one literal board key. Assert instead that `BootScene` preloads the Walnut default through the registry contract and `BoardTexture.ts` delegates to runtime texture fallback.

- [ ] **Step 2: Run runtime tests and verify RED**

```bash
node --test tests/theme-runtime.test.ts tests/board-texture-wiring.test.mjs
```

Expected: FAIL because `ThemeRuntime.ts` and registry-driven preload wiring do not exist.

- [ ] **Step 3: Implement runtime theme access and texture fallback**

Create `src/theme/ThemeRuntime.ts`:

```ts
import type Phaser from 'phaser';

import type { ThemeAssetRef, ThemeDefinition } from './ThemeDefinition.ts';
import { DEFAULT_THEME_ID, getTheme } from './ThemeRegistry.ts';

export const ACTIVE_THEME_REGISTRY_KEY = 'cascade-active-theme';

export function getActiveTheme(scene: Phaser.Scene): ThemeDefinition {
  const id = scene.registry.get(ACTIVE_THEME_REGISTRY_KEY);
  return getTheme(typeof id === 'string' ? id : DEFAULT_THEME_ID);
}

export function chooseThemeAssetKey(
  hasKey: (key: string) => boolean,
  preferred: ThemeAssetRef,
  fallback: ThemeAssetRef,
): string {
  return hasKey(preferred.key) ? preferred.key : fallback.key;
}
```

Update `src/game/view/BoardTexture.ts`:

```ts
import type Phaser from 'phaser';

import { getTheme } from '../../theme/ThemeRegistry.ts';
import { chooseThemeAssetKey, getActiveTheme } from '../../theme/ThemeRuntime.ts';

export function getBoardTexture(scene: Phaser.Scene): string {
  const theme = getActiveTheme(scene);
  const fallback = getTheme('walnut_study');

  return chooseThemeAssetKey(
    (key) => scene.textures.exists(key),
    theme.boardSurface,
    fallback.boardSurface,
  );
}
```

- [ ] **Step 4: Make BootScene select once and preload Walnut plus only the requested pilot assets**

Replace hard-coded board/back constants in `src/game/scenes/BootScene.ts` with registry data. Keep face-card preload exactly as it is.

Use this structure:

```ts
import { DEFAULT_THEME_ID, getTheme } from '../../theme/ThemeRegistry.ts';
import { resolveThemeId } from '../../theme/ThemeSelection.ts';
import { ACTIVE_THEME_REGISTRY_KEY } from '../../theme/ThemeRuntime.ts';

private readonly selectedTheme = getTheme(resolveThemeId(window.location.search));

preload(): void {
  const fallback = getTheme(DEFAULT_THEME_ID);

  this.load.image(fallback.boardSurface.key, fallback.boardSurface.url);
  this.load.image(fallback.cardBack.key, fallback.cardBack.url);

  if (this.selectedTheme.id !== fallback.id) {
    this.load.image(this.selectedTheme.boardSurface.key, this.selectedTheme.boardSurface.url);
    this.load.image(this.selectedTheme.cardBack.key, this.selectedTheme.cardBack.url);
  }

  // existing 52 face-card preload stays unchanged
}

create(): void {
  this.registry.set(ACTIVE_THEME_REGISTRY_KEY, this.selectedTheme.id);
  this.scene.start('GameScene');
}
```

Do not call `MetaRepository`, `MetaSave`, localStorage, or player storage from theme selection.

- [ ] **Step 5: Verify runtime fallback and full regression**

```bash
node --test tests/theme-runtime.test.ts tests/board-texture-wiring.test.mjs
pnpm test
pnpm build
```

Expected: all exit 0. A deliberately invalid `?theme=nope` must still boot Walnut.

- [ ] **Step 6: Commit**

```bash
git add src/theme/ThemeRuntime.ts src/game/scenes/BootScene.ts src/game/view/BoardTexture.ts tests/theme-runtime.test.ts tests/board-texture-wiring.test.mjs
git commit -m "feat: load themes with safe asset fallback"
```

---

### Task 4: Apply Theme Assets and Tokens to the Phaser Board

**Files:**
- Modify: `src/game/view/BoardView.ts`
- Create: `tests/theme-board-wiring.test.mjs`
- Modify: `tests/visual-theme.test.mjs`
- Modify: `tests/card-assets.test.ts`

**Interfaces:**
- Consumes: `getActiveTheme(scene)`, `chooseThemeAssetKey(...)`, Walnut fallback definition.
- Produces: active board tint, themed stock back, slot/frame/symbol palette. No changes to `ViewportLayout`, `layout.ts`, input geometry, or model state.

- [ ] **Step 1: Write failing board-theme wiring tests**

Create `tests/theme-board-wiring.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);
const layoutSource = readFileSync(
  new URL('../src/game/view/ViewportLayout.ts', import.meta.url),
  'utf8',
);

test('BoardView consumes centralized theme visuals instead of hard-coded Walnut colours', () => {
  assert.match(boardSource, /getActiveTheme\(/);
  assert.match(boardSource, /theme\.colors\.boardTint/);
  assert.match(boardSource, /theme\.colors\.slotStroke/);
  assert.match(boardSource, /getCardBackTexture\(/);
  assert.doesNotMatch(boardSource, /setTint\(0x8a7b6d\)/);
});

test('responsive layout remains completely theme-neutral', () => {
  assert.doesNotMatch(layoutSource, /ThemeDefinition|ThemeRegistry|getActiveTheme|green_felt_club/);
});
```

Update `tests/card-assets.test.ts` with one additional test that Green Felt has a separate back asset while the 52 face-card loop stays unchanged:

```ts
test('theme backs are separate from the shared 52 face cards', () => {
  const greenBack = readFileSync(
    new URL('../public/assets/themes/green-felt-club/card-back.png', import.meta.url),
  );
  assert.ok(greenBack.length > 8);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test tests/theme-board-wiring.test.mjs tests/card-assets.test.ts tests/visual-theme.test.mjs
```

Expected: the new wiring test fails because `BoardView` still contains hard-coded Walnut tint/slot colours and hard-coded `'card-back'`.

- [ ] **Step 3: Add a card-back texture resolver beside the board resolver**

Extend `src/theme/ThemeRuntime.ts` with:

```ts
export function getCardBackTexture(scene: Phaser.Scene): string {
  const theme = getActiveTheme(scene);
  const fallback = getTheme('walnut_study');

  return chooseThemeAssetKey(
    (key) => scene.textures.exists(key),
    theme.cardBack,
    fallback.cardBack,
  );
}
```

- [ ] **Step 4: Replace only cosmetic BoardView constants with active theme data**

Import the theme contract/runtime and resolve it once at BoardView construction time:

```ts
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { getActiveTheme, getCardBackTexture } from '../../theme/ThemeRuntime.ts';

private readonly theme: ThemeDefinition;

constructor(...) {
  this.scene = scene;
  this.game = game;
  this.actions = actions;
  this.layout = layout;
  this.theme = getActiveTheme(scene);
  ...
}
```

Then make these substitutions without touching coordinates or input code:

```ts
this.boardSurface.setTint(this.theme.colors.boardTint);
```

Foundation symbols:

```ts
const color = suit === 'diamonds' || suit === 'hearts'
  ? this.theme.colors.redFoundationSymbol
  : this.theme.colors.foundationSymbol;
```

Free arrow:

```ts
color: this.theme.colors.foundationSymbol,
```

Slots:

```ts
const slot = this.scene.add.rectangle(
  x + this.layout.cardWidth / 2,
  y + this.layout.cardHeight / 2,
  this.layout.cardWidth,
  this.layout.cardHeight,
  this.theme.colors.slotFill,
  kind === 'tableau' ? alpha * 0.22 : alpha * 0.34,
).setDepth(5);

if (kind !== 'foundation') {
  slot.setStrokeStyle(
    1,
    this.theme.colors.slotStroke,
    kind === 'stock' ? 0.48 : 0.24,
  );
}
```

Foundation frame:

```ts
const lineColor = this.theme.colors.slotStroke;
```

Stock images:

```ts
const backTexture = getCardBackTexture(this.scene);

for (let index = 0; index < MAX_STOCK_LAYERS; index += 1) {
  const back = this.scene.add.image(
    this.layout.stock.x,
    this.layout.stock.y,
    backTexture,
  );
  ...
}
```

Do not theme the 52 card-face texture keys.

- [ ] **Step 5: Update historical visual tests so they protect the new contract, not Walnut literals**

In `tests/visual-theme.test.mjs`, retain the assertions that the surface is an external texture, foundation decoration is vector, HUD uses shared UI, and artwork is not hash-locked. Replace only assertions that require a literal hard-coded Walnut tint with assertions that BoardView obtains a centralized theme and still uses non-destructive `setTint(...)`.

- [ ] **Step 6: Run board-focused and full verification**

```bash
node --test tests/theme-board-wiring.test.mjs tests/card-assets.test.ts tests/visual-theme.test.mjs
pnpm test
pnpm build
```

Expected: all exit 0.

Manual check with identical seed in two tabs:

```text
/?theme=walnut_study
/?theme=green_felt_club
```

Card positions, sizes, gaps, foundation coordinates, and stock behavior must match exactly; only cosmetics differ.

- [ ] **Step 7: Commit**

```bash
git add src/game/view/BoardView.ts src/theme/ThemeRuntime.ts tests/theme-board-wiring.test.mjs tests/visual-theme.test.mjs tests/card-assets.test.ts
git commit -m "feat: apply theme visuals to board"
```

---

### Task 5: Apply Theme Environment, Accent Tokens, and Cursor to Shared DOM UI

**Files:**
- Create: `src/theme/ThemeDom.ts`
- Modify: `src/game/scenes/BootScene.ts`
- Modify: `src/game/view/AppShellView.ts`
- Modify: `src/styles.css`
- Create: `tests/theme-shell-wiring.test.mjs`

**Interfaces:**
- Consumes: active `ThemeDefinition` selected in BootScene.
- Produces: one shared host token boundary (`data-theme`, `--ui-bronze`, `--ui-bronze-dark`, `--theme-cursor`) and shell environment variables. Rules/Statistics inherit this; they receive no theme-specific branches.

- [ ] **Step 1: Write failing shell-theme wiring tests**

Create `tests/theme-shell-wiring.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);
const rulesSource = readFileSync(
  new URL('../src/game/view/RulesView.ts', import.meta.url),
  'utf8',
);
const statisticsSource = readFileSync(
  new URL('../src/game/view/StatisticsPageView.ts', import.meta.url),
  'utf8',
);

test('AppShell environment comes from the active theme instead of a fixed wood constant', () => {
  assert.match(shellSource, /getActiveTheme\(/);
  assert.match(shellSource, /theme\.shellEnvironment/);
  assert.doesNotMatch(shellSource, /const MENU_WOOD_TEXTURE|const MENU_WOOD_DETAIL/);
});

test('shared theme CSS variables drive accents and cursor without page-specific theme branches', () => {
  assert.match(stylesSource, /--theme-cursor/);
  assert.match(stylesSource, /var\(--theme-cursor/);
  assert.doesNotMatch(rulesSource, /green_felt_club|walnut_study/);
  assert.doesNotMatch(statisticsSource, /green_felt_club|walnut_study/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
node --test tests/theme-shell-wiring.test.mjs
```

Expected: FAIL because AppShell still hard-codes `MENU_WOOD_TEXTURE` and no shared theme cursor variable exists.

- [ ] **Step 3: Add one DOM token application function**

Create `src/theme/ThemeDom.ts`:

```ts
import type { ThemeDefinition } from './ThemeDefinition.ts';

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

export function applyThemeToHost(host: HTMLElement, theme: ThemeDefinition): void {
  host.dataset.theme = theme.id;
  host.style.setProperty('--ui-bronze', theme.colors.shellAccent);
  host.style.setProperty('--ui-bronze-dark', theme.colors.shellAccentDark);

  if (theme.cursor === undefined) {
    host.style.setProperty('--theme-cursor', 'default');
    return;
  }

  const cursorUrl = resolveAssetUrl(theme.cursor.url);
  host.style.setProperty(
    '--theme-cursor',
    `url("${cursorUrl}") ${theme.cursor.hotspotX} ${theme.cursor.hotspotY}, default`,
  );
}
```

- [ ] **Step 4: Apply the shared host tokens once in BootScene**

After setting `ACTIVE_THEME_REGISTRY_KEY` in `BootScene.create()`, apply the theme to the game host:

```ts
const host = this.game.canvas.parentElement;
if (host !== null) {
  applyThemeToHost(host, this.selectedTheme);
}
```

Theme application must not read/write game state or save state.

- [ ] **Step 5: Make AppShellView derive environment assets from the active theme**

In `AppShellView.ts`, keep paper/frame/ornament/decor constants shared, but remove both fixed `MENU_WOOD_TEXTURE` and `MENU_WOOD_DETAIL` ownership. Resolve the active theme:

```ts
import { getActiveTheme } from '../../theme/ThemeRuntime.ts';

constructor(scene: Phaser.Scene, actions: AppShellActions) {
  const theme = getActiveTheme(scene);
  ...
  this.root.style.setProperty('--app-shell-wood', toCssUrl(theme.shellEnvironment));
  this.root.style.setProperty(
    '--app-shell-wood-detail',
    toCssUrl(theme.shellDetail ?? theme.boardSurface.url),
  );
  ...
}
```

Do not add Green-specific branches to `PlayPageView`, `RulesView`, or `StatisticsPageView`.

- [ ] **Step 6: Consume the cursor token without changing control geometry**

In `src/styles.css`, add the default at `:root`:

```css
--theme-cursor: default;
```

Apply it to the gameplay canvas and non-button shell surface:

```css
canvas {
  cursor: var(--theme-cursor, default) !important;
}

.app-shell-dom {
  cursor: var(--theme-cursor, default);
}
```

Keep existing `cursor: pointer` on buttons/interactive controls so affordances remain clear. Do not change hit sizes, padding, layout, or nav structure.

- [ ] **Step 7: Verify shell integration and full regression**

```bash
node --test tests/theme-shell-wiring.test.mjs tests/visual-theme.test.mjs
pnpm test
pnpm build
```

Expected: all exit 0. Rules and Statistics compile unchanged and contain no theme IDs.

- [ ] **Step 8: Commit**

```bash
git add src/theme/ThemeDom.ts src/game/scenes/BootScene.ts src/game/view/AppShellView.ts src/styles.css tests/theme-shell-wiring.test.mjs
git commit -m "feat: apply theme tokens to app shell"
```

---

### Task 6: Prove Preview Override Is Non-Persistent and Gameplay/Layout Neutral

**Files:**
- Create: `tests/theme-isolation.test.ts`
- Modify: `tests/theme-selection.test.ts`
- Modify: `tests/session-persistence-wiring.test.ts` only if needed to express the boundary more clearly; do not alter save schemas.

**Interfaces:**
- Consumes: pure selector and existing game/session/layout APIs.
- Produces: regression evidence that theme selection never enters gameplay/session persistence and cannot change deal/layout output.

- [ ] **Step 1: Write isolation tests before any persistence integration is attempted**

Create `tests/theme-isolation.test.ts` using existing exported deal/layout helpers from the project. The test must compare identical game inputs while resolving two different themes and prove the game/layout results are identical. Use the actual signatures currently exported by `dealSeed.ts`, `SolitaireGame.ts`, and `ViewportLayout.ts`; do not add a theme parameter to them.

The core assertions must be equivalent to:

```ts
const walnut = resolveThemeId('?theme=walnut_study');
const green = resolveThemeId('?theme=green_felt_club');
assert.notEqual(walnut, green);

const first = createTheSameSeededGameAndLayout();
const second = createTheSameSeededGameAndLayout();
assert.deepEqual(second.gameSnapshot, first.gameSnapshot);
assert.deepEqual(second.layout, first.layout);
```

Also source-check `MetaSave.ts` and `ActiveGameSave.ts`:

```ts
assert.doesNotMatch(metaSaveSource, /theme|green_felt_club|walnut_study/i);
assert.doesNotMatch(activeGameSaveSource, /theme|green_felt_club|walnut_study/i);
```

This pilot deliberately does not extend either persistence schema.

- [ ] **Step 2: Run the isolation tests and verify they initially expose any accidental coupling**

```bash
node --test tests/theme-isolation.test.ts tests/theme-selection.test.ts
```

Expected: these are verification-only tests and should PASS if Tasks 1–5 respected the boundary. If they fail because theme IDs entered model/layout/save code, remove that coupling rather than weakening the test. No production code is introduced in this task unless the test exposes an accidental dependency that must be removed.

- [ ] **Step 3: Verify query precedence explicitly without writes**

Extend `tests/theme-selection.test.ts` with a spy-free pure assertion that the function only returns an ID and has no repository dependency. Keep `ThemeSelection.ts` free of imports from `src/meta/`, `src/persistence/`, and `src/platform/`.

- [ ] **Step 4: Run full verification**

```bash
pnpm test
pnpm build
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/theme-isolation.test.ts tests/theme-selection.test.ts
git commit -m "test: protect cosmetic theme isolation"
```

---

### Task 7: Full Visual QA, Art Refinement, and Runtime Payload Check

**Files:**
- Modify if visual review requires it: `public/assets/themes/green-felt-club/board-surface.jpg`
- Modify if visual review requires it: `public/assets/themes/green-felt-club/card-back.png`
- Modify if visual review requires it: `public/assets/themes/green-felt-club/cursor.svg`
- Modify if token tuning requires it: `src/theme/ThemeRegistry.ts`
- Do not modify layout/model/input files for cosmetic complaints.

**Interfaces:**
- Consumes: complete pilot from Tasks 1–6.
- Produces: visually accepted final Green Felt assets/tokens at practical web payload sizes.

- [ ] **Step 1: Capture the same real deal in Walnut and Green Felt at desktop**

Run the app in two tabs with the same seed/mode and these preview URLs:

```text
/?theme=walnut_study
/?theme=green_felt_club
```

At approximately `1920 × 1080`, verify all ten pilot acceptance criteria from the spec. Specifically check that Green Felt is immediately different, face cards dominate the texture, burgundy stock is obvious, and every board coordinate is unchanged.

- [ ] **Step 2: Repeat visual QA at `1280 × 720` and compact landscape**

Inspect:

```text
1280 × 720
current minimum supported compact landscape
```

Use a deal with both short and long tableau piles. Theme changes must not trigger any responsive workaround.

- [ ] **Step 3: Inspect all important board states**

Manually reach or restore these states under Green Felt:

```text
stock visible
stock exhausted / free-cell active
all four foundations empty
partially filled foundations
long tableau columns
Home shell open over an active board
Rules page
Statistics / Leaderboard page
```

Reject/refine only cosmetic assets/tokens if contrast is weak. Do not alter layout to make a theme fit.

- [ ] **Step 4: Refine art through replacement, not extra layers**

If felt is noisy, regenerate/reprocess `board-surface.jpg`; if stock blends in, regenerate/reprocess `card-back.png`; if cursor is distracting, simplify `cursor.svg`; if slot contrast is wrong, tune only the Green Felt registry colour values. Do not add per-screen Green Felt CSS selectors.

After every art replacement run:

```bash
node --test tests/theme-assets.test.mjs tests/theme-registry.test.ts
pnpm test
pnpm build
```

- [ ] **Step 5: Check payload and shipped paths**

Run:

```bash
find public/assets/themes/green-felt-club -maxdepth 1 -type f -printf '%f %k KB\n'
find public -type f | grep -Ei 'concept|mockup|reference|comparison' && exit 1 || true
```

Expected: exactly the three intended Green Felt runtime assets are present in that folder and no concept/mockup image is accidentally shipped as runtime art.

- [ ] **Step 6: Commit accepted art/token tuning**

```bash
git add public/assets/themes/green-felt-club src/theme/ThemeRegistry.ts
git commit -m "art: polish green felt club theme"
```

Skip the commit if no files changed in this QA task.

---

### Task 8: Yandex Smoke, Acceptance Docs, and Pilot Handoff

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`
- Keep: `docs/superpowers/specs/2026-09-07-theme-system-green-felt-pilot-design.md`
- Keep: `docs/superpowers/plans/2026-09-07-theme-system-green-felt-pilot.md`

**Interfaces:**
- Consumes: visually accepted theme pilot.
- Produces: final documented project state and evidence needed before designing Collection/economy.

- [ ] **Step 1: Run fresh automated verification**

```bash
pnpm test
pnpm build
```

Expected: both commands exit 0 with zero failing tests.

- [ ] **Step 2: Run the Yandex/proxy smoke path with Green Felt active**

```bash
pnpm yandex:dev
```

Open the preview with `?theme=green_felt_club` in the supported proxy/draft path and verify:

```text
F5 keeps the application playable
saved Standard/Classic session resumes normally
theme preview does not change seed/deal
Daily availability still follows trusted time only
leaderboard/platform fallback behavior is unchanged
returning from Home does not click through into stock
```

- [ ] **Step 3: Update CURRENT_STATE only after the visual/Yandex gate passes**

Add a concise section recording:

```markdown
## Theme pilot

- Registry-driven cosmetic themes are implemented with `walnut_study` as the default/fallback and `green_felt_club` as the first complete pilot.
- `?theme=green_felt_club` is a non-persistent QA preview override; it does not unlock, own, or save a theme.
- Green Felt changes only board surface, card back, slot/symbol palette, shared shell environment/accent tokens, and cursor treatment.
- Missing optional Green Felt assets fall back safely without changing gameplay/session data.
- Collection, XP, Coins, Shop pricing, purchases, and long-term reward pacing remain intentionally unimplemented until the pilot's production cost is evaluated.
```

- [ ] **Step 4: Update TECH with the stable architecture boundary**

Add concise bullets describing:

```markdown
- `src/theme/ThemeRegistry.ts` owns theme definitions and the Walnut fallback.
- `src/theme/ThemeSelection.ts` owns preview/persisted/default precedence and has no persistence dependency.
- `src/theme/ThemeRuntime.ts` resolves the scene-active theme and per-asset texture fallbacks.
- `src/theme/ThemeDom.ts` applies shared CSS variables to the game host; pages must not branch on theme IDs.
- Gameplay/layout/model code remains theme-neutral; only BoardView consumes board cosmetic tokens.
```

- [ ] **Step 5: Generate the normal ChatGPT handoff context**

```bash
pnpm context
```

Expected: generated context lists the new binary assets by path but does not embed their bytes, matching the existing handoff contract.

- [ ] **Step 6: Final commit**

```bash
git add CURRENT_STATE.md TECH.md docs/superpowers/specs/2026-09-07-theme-system-green-felt-pilot-design.md docs/superpowers/plans/2026-09-07-theme-system-green-felt-pilot.md
git commit -m "docs: record green felt theme pilot"
```

- [ ] **Step 7: Record the product decision after the pilot**

Do not implement economy in this task. After the user evaluates the final theme and production effort, make one explicit next decision in a new design conversation:

```text
Theme pipeline accepted -> design Profile/XP/Daily/Collection around measured cosmetic capacity.
Theme pipeline too expensive/weak -> reduce cosmetic scope before building economy.
```

