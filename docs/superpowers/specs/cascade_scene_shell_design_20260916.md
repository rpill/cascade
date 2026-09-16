# Cascade Secondary Scene Shell Design

Date: 2026-09-16
Status: proposed for implementation

## Goal

Standardize the outer layout of Cascade's secondary UI scenes so they share one visual system instead of each scene inventing its own title style, back button, margins, content width, and top spacing.

Target scenes:

- Daily
- Themes
- Mastery
- Leaderboards
- Settings
- How To Play

Home and the gameplay table are intentionally excluded because they have custom compositions.

## Current problem

The six target scenes currently compute their outer layout independently. This has produced visible drift:

- titles use different casing, font sizing rules, and vertical positions;
- back controls differ in type, size, and placement;
- left/right outer margins vary by scene;
- header-to-content spacing varies by scene;
- some scenes cap width while others fill the screen;
- Settings and How To Play use bottom/back actions rather than the same top navigation pattern;
- desktop and mobile-landscape behavior is duplicated scene-by-scene.

The fix should remove those decisions from individual scenes.

## Design decision

Introduce a shared `SceneShell` component backed by one pure layout function. The shell owns the entire outer frame of a secondary scene:

- back button;
- centered scene title;
- optional right-side slot (coin pill or future action);
- standardized outer margins;
- standardized header height and top position;
- standardized gap below the header;
- standardized `contentBounds` passed to the scene.

Individual scenes own only the content inside `contentBounds`.

## Viewport profiles

Cascade supports exactly two shell profiles:

1. `desktop`
2. `mobile-landscape`

No portrait layout branch will be added.

The shell consumes the existing `ResolvedUiViewport` so HiDPI/backing-scale behavior remains centralized in `BaseUiScene` / `UiViewport`.

## Layout contract

Add a pure function such as:

```ts
computeSceneShellLayout(viewport, options): SceneShellLayout
```

It returns at minimum:

```ts
interface SceneShellLayout {
  readonly outerBounds: UiRect;
  readonly headerBounds: UiRect;
  readonly backBounds: UiRect;
  readonly titleBounds: UiRect;
  readonly rightSlotBounds: UiRect;
  readonly contentBounds: UiRect;
}
```

### Shared geometry rules

For a given viewport profile, all six scenes receive identical values for:

- left/right outer edge;
- top edge;
- header height;
- back-button square size;
- title vertical center;
- right-slot vertical alignment;
- gap between header and content;
- bottom edge.

The title is centered on the screen/content shell itself, not centered in the leftover space between the back button and right slot.

### Recommended metrics

Exact values may be tuned during implementation, but there should be one token set rather than per-scene magic numbers.

Desktop:

- outer margin: derived from `safeMargin`, with one shared minimum;
- header height: about 52-56 CSS px;
- square back button: same as header height;
- header/content gap: about 12-16 CSS px;
- title size: about 28-32 CSS px.

Mobile landscape:

- outer margin: derived from `safeMargin`, with one shared minimum;
- header height: about 44 CSS px;
- square back button: same as header height;
- header/content gap: about 8-10 CSS px;
- title size: about 20-24 CSS px.

All fixed CSS-space values must pass through the existing viewport/backing-scale system rather than introducing a second DPR scaling path.

## `SceneShell` responsibilities

`SceneShell` should own and expose:

- `IconButton` for back navigation;
- title `Phaser.GameObjects.Text`;
- optional right-slot layout hook or bounds;
- `layout(viewport)`;
- `setTitle(text)`;
- `destroy()`.

The shell should not own scene-specific content, tabs, calendars, cards, or panels.

The shell should use the existing UI components and tokens rather than invent a parallel button implementation.

## Typography and casing

All six shell titles use the same typography:

- Georgia/serif bold, matching the existing menu aesthetic;
- same color token;
- same sizing rule per viewport profile;
- natural localized casing rather than arbitrary all-caps.

Russian examples:

- `Daily`
- `Темы`
- `Мастерство`
- `Таблица лидеров`
- `Настройки`
- `Как играть`

Localization should own the displayed text; scenes should not hard-code all-caps variants solely for styling.

## Width policy

The shell standardizes the **outer content area**, not every inner panel width.

### Full-width content scenes

These use the full `contentBounds` supplied by the shell:

- Daily
- Themes
- Mastery
- Leaderboards

They may divide or scroll inside that area, but they may not introduce a second unrelated page-level margin/max-width.

### Focused-panel scenes

Settings and How To Play use the same shell and the same `contentBounds`, but may place a centered inner panel within that area.

That inner panel width comes from one shared focused-panel sizing helper/token, not independent hard-coded widths in each scene.

This preserves compact Settings/How To Play content without reintroducing inconsistent page edges.

## Scene migrations

### Daily

- replace local header/back/title/coin geometry with `SceneShell`;
- keep calendar and left Daily card content logic;
- calendar/content uses shell `contentBounds`.

### Themes

- replace local header/back/title/coin geometry with `SceneShell`;
- keep reward action in the right/top area using shell-provided bounds or a secondary action row inside content;
- theme grid starts from shell `contentBounds`.

### Mastery

- replace its custom margin/header calculations with `SceneShell`;
- keep the current Mastery content composition inside shell `contentBounds` so Astra can further style it without changing page geometry.

### Leaderboards

- remove the local desktop `1180px` page-level cap;
- shell defines page edges;
- table/panel may have internal padding but not a separate scene margin system.

### Settings

- replace bottom `НАЗАД` ActionCard with the common top-left back button;
- use the common shell title;
- controls live in a standard centered focused panel inside `contentBounds`.

### How To Play

- replace bottom `НАЗАД` with the common top-left back button;
- keep page prev/next and final Play/Close controls at the bottom of the tutorial panel;
- use the common shell title/header area;
- tutorial panel uses the shared focused-panel width rule.

## Navigation behavior

The shell receives the back callback from each scene. It does not decide destination semantics.

Examples:

- Daily/Themes/Mastery/Leaderboards -> Home;
- Settings -> existing close/return behavior;
- How To Play -> existing exit behavior.

This preserves behavior while standardizing presentation.

## Testing strategy

Add pure layout regression tests first.

Required assertions for both desktop and mobile-landscape:

1. all six target scenes use the same shell layout function/component;
2. same viewport => identical `backBounds`, header Y/height, title center Y, content left/right/top/bottom;
3. back control is square;
4. title remains centered on screen even when right slot is present/absent;
5. `contentBounds` stays inside safe margins;
6. no portrait-specific branch is introduced;
7. Settings no longer creates a bottom Back action;
8. How To Play no longer creates a bottom Back action;
9. targeted scenes no longer keep their own page-level margin/max-width constants that duplicate the shell contract.

Existing scene-specific tests continue to cover calendar, theme grid, mastery, leaderboard, settings, and tutorial behavior.

## Migration order

Implement in one branch but in small verifiable steps:

1. add pure `SceneShellLayout` and tests;
2. add `SceneShell` component and tests;
3. migrate Daily + Themes;
4. migrate Mastery + Leaderboards;
5. migrate Settings + How To Play;
6. run the complete relevant UI test suite and TypeScript build.

The branch should not mix unrelated visual redesigns into this migration. The purpose is structural consistency; Astra or later passes can refine individual scene artwork inside the standardized shell.

## Non-goals

This change does not:

- redesign Home;
- redesign the gameplay HUD/table;
- redesign Mastery artwork again;
- standardize every inner card/button style in the game;
- add portrait support;
- change game/meta logic;
- change navigation destinations.

## Success criteria

After migration, switching between Daily, Themes, Mastery, Leaderboards, Settings, and How To Play should feel like moving between screens of one product:

- the title does not jump vertically or change style;
- the back button stays the same size and position;
- page edges line up;
- content starts at the same vertical baseline;
- desktop and mobile-landscape each have one predictable geometry system;
- scene-specific code no longer controls the page shell.
