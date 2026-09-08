# Cascade Solitaire — Hybrid UI System Design

**Date:** 2026-09-05  
**Status:** Approved  
**Scope:** Product-wide UI system after responsive board geometry; replaces the rejected Task 3 HUD and the current stacked/modal main-menu architecture.

## 1. Purpose

Cascade Solitaire already has a stable responsive board direction. The next phase is not a collection of isolated UI fixes; it is a coherent application UI system that can support gameplay, Daily, statistics, leaderboards, rules, collection, shop, settings, results, and future meta features without accumulating unrelated modal styles.

The approved visual direction is the **hybrid shell**:

- the wooden table remains the permanent atmospheric background;
- a calm parchment-like working surface provides structure;
- gameplay mode cards and collectible/shop items may feel like physical paper/card objects;
- navigation, utility controls, information hierarchy, spacing, and responsive behavior follow one consistent application shell;
- the UI must feel like one designed game, not HTML widgets individually reskinned with parchment borders.

The visual quality bar is the approved hybrid concept shown in the conversation: warm wooden background, restrained parchment shell, clear hierarchy, three balanced mode cards, compact progress strip, elegant serif typography, light borders, and spacious composition.

## 2. Non-goals

This phase does not change:

- solitaire legality or deal rules;
- Daily seed logic;
- statistics or leaderboard data semantics;
- platform lifecycle behavior;
- board card art;
- the accepted responsive board geometry from Task 2;
- economy balancing or actual shop inventory design beyond the shell/components required to host it.

Portrait gameplay remains outside the first release. Desktop and mobile/tablet landscape are the supported layouts.

## 3. Core product hierarchy

The product should be understood as a small application with persistent destinations rather than a chain of modal dialogs.

Primary destinations:

1. **Play**
2. **Statistics**
3. **Collection**
4. **Shop**

Global utilities:

- **Rules** (`?`)
- **Settings** (gear)

Leaderboard belongs under Statistics rather than occupying a permanent global navigation slot.

Achievements, if added later, do not receive a permanent navigation position until their product role is known.

## 4. Global hybrid shell

### 4.1 Background

The fullscreen wooden table remains visible around the UI and is the shared environmental background between menu and gameplay.

### 4.2 Working surface

The main application content uses one large parchment-like working surface centered within the viewport.

It must not resemble the current oversized modal:

- no heavy double frame around the whole window;
- no decorative border language unique to each child block;
- no giant `ГЛАВНОЕ МЕНЮ` title;
- no stack of unrelated full-width buttons;
- no repeated horizontal rules merely to separate sections.

The shell edge should be visually quiet: one restrained outline / paper edge treatment, subtle shadow, and minimal corner detail.

### 4.3 Persistent header

Desktop structure:

```text
CASCADE                                  ?   ⚙

ИГРАТЬ    СТАТИСТИКА    КОЛЛЕКЦИЯ    МАГАЗИН
──────────────────────────────────────────────

                    CONTENT
```

- `CASCADE` is the brand/title, not `ГЛАВНОЕ МЕНЮ`.
- Global navigation is one visual system.
- Active destination is indicated with one restrained treatment such as underline, weight, or small accent.
- `?` and Settings are icon controls, not full text buttons.

### 4.4 Navigation behavior

Navigation changes the shell's central content instead of opening a new modal over the previous screen.

Back navigation is used only inside secondary/detail pages such as Rules or a future item detail page.

## 5. Play destination

### 5.1 Mode cards

The Play page has three primary mode cards of equal visual weight and size:

- Standard
- Daily Challenge
- Classic

Each card follows one component template:

```text
[ emblem / suit / subtle illustration ]
MODE NAME
short explanation / status
primary play action
```

Daily may receive a restrained accent because it is time-sensitive, but it must not use a separate border system or unrelated component language.

### 5.2 Primary action

The entire mode card may be clickable, but there must also be an obvious primary action state.

The action should not look like the current full-width rectangular mode buttons. It should be smaller, proportionate to the card, and use the shared button treatment.

### 5.3 Weekly progress

The existing debug-like weekly presentation is removed.

Do not show:

- `НЕДЕЛЯ 36`;
- weekday abbreviations as a text data dump;
- milestone values `3 / 5 / 7` until real milestone rewards exist.

Use one compact progress component such as:

```text
На этой неделе    ● ● ○ ○ ○ ○ ○    2/7
```

or an equivalent seven-dot visual where the current day/completed days can be distinguished accessibly.

The progress strip is secondary to the three mode cards.

### 5.4 Leaderboard entry point

A small leaderboard affordance may be present on the Play page only if it remains clearly secondary. The canonical location for leaderboard content is Statistics.

## 6. Gameplay HUD

The current rejected Task 3 HUD is replaced.

### 6.1 Actions and order

Right-aligned gameplay actions use this semantic order from left to right:

```text
Undo   Restart   New Deal      Home
```

`Home` is the far-right control and is separated from destructive/current-deal actions by a larger gap.

Rationale:

- Undo is frequent and safe;
- Restart affects the current deal;
- New Deal abandons the current deal for another;
- Home is navigation out of gameplay and therefore visually separated.

Daily omits New Deal.

### 6.2 Icons

Use custom inline SVG icons, not emoji or OS-dependent glyphs.

- Undo: curved back arrow
- Restart: circular replay arrow
- New Deal: card stack plus `+` / new-deal mark; do not use shuffle
- Home: house

All icons share stroke weight, corner language, optical size, and alignment.

### 6.3 Hit areas and labels

- Minimum interactive target: `44 × 44 CSS px`.
- Desktop hover/focus tooltip: e.g. `Отменить ход · Z`.
- `aria-label` is required.
- Native `title` may be included as fallback, not as the primary tooltip experience.
- Touch layouts do not show hover tooltips.

### 6.4 Placement

The HUD occupies the reserved `hudBounds` above the accepted board area. Gameplay cards must never enter HUD space.

## 7. Rules

Rules are a full shell page, not a modal.

Suggested desktop structure:

```text
← Назад                         ПРАВИЛА

[section navigation]    [visual example]
                        [short explanation]
```

Content should be visual first and concise.

Required sections:

- Goal
- Tableau stacking
- Moving runs
- Foundations
- Stock / free cell
- Auto-foundation behavior
- Undo
- Standard / Classic / Daily differences

Use card examples wherever they explain a rule faster than prose, for example alternating colours:

```text
9♠ → 8♥ → 7♣
```

On compact landscape, the side navigation collapses into tabs or a compact section selector.

## 8. Statistics and leaderboards

Statistics are a shell destination, not a modal.

Recommended information hierarchy:

- Standard / Classic tabs or segmented switch;
- games played;
- wins;
- win rate;
- best time;
- leaderboard entry point / integrated leaderboard section.

Leaderboard should reuse the same page system and typography.

The existing no-scroll principle remains for supported landscape viewport sizes; use compact layout, columns, pagination, or tabs instead of a scrolling modal.

## 9. Shop and collection readiness

Shop and Collection must share component language.

Suggested shop page:

```text
← / section title                        currency

Рубашки | Столы | Темы | Эффекты

[item] [item] [item] [item]
[item] [item] [item] [item]
```

Collection uses the same item-card component but shows owned/equipped state instead of purchase state.

The UI system must support these destinations without inventing a new border, new button type, or new panel language.

No actual economy balancing, product list, or reward values are defined by this spec.

## 10. Result screens and true modals

A modal is allowed only when the interaction is truly modal.

Good modal candidates:

- destructive confirmation;
- short authorization prompt;
- blocking error;
- victory/result overlay if keeping the board visible beneath it is desirable.

Normal destinations such as Statistics, Rules, Shop, Collection, or Leaderboard must not stack as dialogs over Home.

Result UI must adopt the same typography, border, icon, spacing, and button system as the shell.

## 11. Component system

The implementation must converge on a small set of reusable visual primitives.

### 11.1 Shell surface

One quiet application working surface.

### 11.2 Mode card

Used for Standard, Daily, Classic.

### 11.3 Navigation item

Used for global destination navigation. Primarily typographic; does not require an enclosing box for every item.

### 11.4 Icon control

Used for gameplay actions, Rules, Settings, Back where appropriate.

### 11.5 Progress strip

Used for Daily/weekly participation state.

### 11.6 Content/item card

Used for shop/collection items and small structured information blocks.

No new component type should be introduced solely because a feature is faster to implement with a one-off DOM structure.

## 12. Border and surface rules

This is a hard visual constraint.

Use at most two primary paper/surface levels:

1. base shell surface;
2. emphasized/interactive card surface.

Avoid the current mixture of:

- double borders;
- unrelated red side accents;
- standalone diamonds;
- decorative corner cuts unique to one component;
- separators around every block;
- different frame styles per feature.

All interactive cards use one border family and one selected/hover family.

## 13. Typography

The UI keeps the current classic card-table character but establishes hierarchy intentionally.

Recommended levels:

- Brand / major page title
- Section title
- Mode/item title
- Body/help text
- Small status/meta text

Do not use oversized all-caps text for every heading.

Desktop and compact landscape use the same hierarchy with responsive size compression rather than ad-hoc per-screen font choices.

## 14. Responsive behavior

Supported release layouts:

- desktop landscape;
- tablet landscape;
- phone landscape.

Portrait remains unsupported for gameplay in this phase.

### 14.1 Desktop

- full header labels;
- three mode cards in one row;
- comfortable whitespace;
- tooltips enabled for icon controls.

### 14.2 Compact landscape

- shell uses more of the available viewport;
- global nav may switch from full text to icon + short label or icon-only only when necessary;
- three mode cards should remain recognizable and balanced rather than collapsing into full-width stacked buttons;
- weekly progress stays one compact strip;
- rules side navigation collapses;
- shop/collection grid reduces column count;
- touch targets remain at least 44 px.

### 14.3 Safe area

Shell and HUD respect `env(safe-area-inset-left/right/top/bottom)` where relevant.

## 15. Interaction states

Every interactive component must define:

- default;
- hover (pointer devices);
- active/pressed;
- keyboard focus-visible;
- disabled;
- selected/equipped/current where applicable.

Disabled state must remain readable and must not rely only on low opacity.

## 16. Accessibility and semantics

- Icon controls require `aria-label`.
- Keyboard focus remains visible.
- Hover information must have a keyboard equivalent.
- Important status must not rely on colour alone.
- Touch targets remain at least 44 px.
- Navigation should use semantic button/link behavior appropriate to the implementation.

## 17. Visual quality bar

The approved concept is a **direction and quality bar**, not a promise to reproduce a generated image pixel-for-pixel.

The shipped UI should reproduce its important qualities:

- calm composition;
- consistent margins;
- balanced mode cards;
- restrained parchment-on-wood palette;
- sparse decoration;
- coherent serif typography;
- subtle shadows rather than heavy borders;
- one design language across Play, Rules, Shop, and gameplay HUD;
- enough whitespace that the interface feels deliberate rather than filled.

Do not compensate for missing bespoke art by adding more borders, ornaments, gradients, or decorative separators.

## 18. Migration strategy

The accepted responsive board geometry remains the foundation.

The rejected Task 3 icon HUD must not be committed as final design.

Recommended migration sequence:

1. Establish shared UI tokens/components and new gameplay HUD.
2. Build the hybrid shell and Play destination.
3. Move Rules into the shell.
4. Move Statistics/Leaderboard into shell pages.
5. Create Shop/Collection-ready shell pages/components.
6. Restyle result overlays using the same system.
7. Complete compact-landscape adaptations and Yandex acceptance checks.

Each step should replace an old UI path rather than adding another layer beside it.

## 19. Acceptance criteria

The UI phase is successful when:

1. Gameplay HUD reads clearly at a glance and Home is the far-right separated action.
2. The main menu no longer looks like a stacked modal form.
3. Standard, Daily, and Classic are visually balanced mode cards.
4. Weekly progress is compact and secondary.
5. Rules are accessible from the global shell without opening a modal stack.
6. Statistics/Leaderboard use shell content, not independent large dialogs.
7. Shop and Collection can be added using existing page/item components.
8. Desktop and compact landscape share one design language.
9. No supported viewport requires scrolling the primary shell or gameplay screen.
10. New features cannot introduce arbitrary one-off borders/button styles without extending the shared component system deliberately.
11. The visual result is recognizably close in hierarchy, calmness, polish, and atmosphere to the approved hybrid concept.

