# Cascade Secondary Scene Shell Design

## Goal

Standardize the six secondary Cascade screens so they share the same outer geometry, header, title treatment, back button, and content edges on desktop and mobile landscape.

## Scope

Apply the shared shell to:

- Daily
- Themes
- Mastery
- Leaderboards
- Settings
- How to Play

Do not convert Home or the gameplay table. They intentionally use bespoke compositions.

## Viewport profiles

Only two profiles exist:

- `desktop`
- `mobile-landscape`

Do not add portrait behavior.

## Shared shell contract

A shared `SceneShell` and pure layout helper own the outer screen contract:

- same top margin;
- same left and right screen margins;
- same square back button at the same position and size;
- same centered title position, font family, weight, color, and size;
- same header height;
- same gap from header to content;
- same bottom margin;
- same `contentBounds` for full-width secondary screens;
- a right header slot for coins or scene-specific actions without shifting the centered title.

Scenes must consume `contentBounds`; they must not invent their own page-level outer x/y/width or page-level maximum width.

## Header typography and copy

Use Georgia bold for secondary-scene titles. Titles use natural casing:

- `Daily`
- `Темы`
- `Мастерство`
- `Таблица лидеров`
- `Настройки`
- `Как играть`

English localization follows the same natural casing.

The title is centered on the physical viewport, not merely centered between left and right controls.

## Scene-specific content

`Daily`, `Themes`, `Mastery`, and `Leaderboards` use the full shell `contentBounds` for their primary content.

`Settings` and `HowToPlay` use the same shell and header but may center a narrower paper panel inside `contentBounds` using one shared narrow-panel rule. Their outer page geometry still comes exclusively from the shell.

`Settings` removes its bottom `Назад` action. Navigation uses the shell back button.

`HowToPlay` removes its bottom `Назад` action. Bottom controls retain only page navigation and the contextual primary action (`Играть`/`Закрыть`).

## Right-slot behavior

The shell reserves a right-side header area while keeping the title viewport-centered.

- Daily: coin pill.
- Themes: reward coin action plus coin pill.
- Mastery: coin pill.
- Leaderboards: empty.
- Settings: empty.
- HowToPlay: empty.

## Testing

Add pure layout tests for both viewport profiles and regression tests proving all six scenes consume the shared shell instead of maintaining independent page-level header/margin geometry.

The project must pass `pnpm test` for the affected UI suites and `pnpm build` before the migration is considered complete.
