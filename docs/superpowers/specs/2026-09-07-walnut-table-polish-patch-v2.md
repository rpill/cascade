# Cascade Solitaire — Walnut Table Polish Patch Brief v2

**Date:** 2026-09-07  
**Status:** Approved correction pass  
**Scope:** Fix only the four rejected visual parts from the latest real runtime screenshot.

## 1. Board background

Replace/refine the gameplay wood so it visually belongs to the **same family as the main menu wood**.

Requirements:
- dark warm walnut / brown wood;
- quieter and more even than the current gameplay texture;
- less noisy grain and fewer harsh vertical streaks;
- no dirty/photo-scanned feeling;
- no green felt;
- no baked border, vignette, symbols, lines, card zones or ornaments;
- cards must remain the highest-contrast objects.
- use a dedicated gameplay-board asset so this correction does not silently restyle the already accepted menu wood details.

The current gameplay wood is rejected.

## 2. Stock / temporary free-cell affordance

The current `small card + downward arrow` glyph is rejected as ambiguous.

The icon must communicate **“place a card here”**, not simply “down”.

Use:
- the existing card-sized outer placeholder;
- a clearly visible small card silhouette;
- an arrow whose end visibly terminates **inside / into the destination slot**;
- one compact composition readable at actual gameplay size.

Do not use:
- a lone arrow;
- a floating arrow with no destination;
- decorative symbols;
- text.

When the slot is just an ordinary empty card destination and does not require the special placement hint, show the shared frame with no center glyph.

## 3. Gameplay control buttons

The current dark gameplay buttons are rejected because they look like a separate UI kit.

Gameplay controls must be visually derived from the **existing main-menu UI**:
- same parchment / warm ivory family;
- same brown/brass border language;
- same restrained shadow/bevel language;
- same icon stroke/fill weight;
- same overall visual softness.

Keep unchanged:
- top-right position;
- button order;
- button size / hit area;
- actions;
- spacing/layout contract.

Do not create a separate “premium dark wood HUD” style.

## 4. New Game icon

The current New Game icon is rejected.

Replace it from scratch with the simplest readable symbol at small size.

Preferred direction:
- **two overlapping/fanned card outlines + small plus sign**.

Requirements:
- immediately reads as “new cards / new deal”;
- no tiny internal details;
- no confusing box-with-plus appearance;
- visually consistent with Undo, Restart and Home icons;
- remains readable at the actual HUD size.

## Hard lock

This patch must NOT change:
- card size;
- card positions;
- tableau spacing;
- stock/foundation/tableau coordinates;
- responsive `ViewportLayout`;
- card faces;
- rules;
- input/hit areas;
- mode-label position unless it overlaps after the button skin change;
- already accepted removal of the outer gameplay frame;
- already accepted shared placeholder geometry.

## Runtime acceptance

Validate only in the real game.

The patch is accepted when:
1. gameplay wood feels visually related to the menu wood;
2. stock/free-cell hint is instantly understandable as “place card here”;
3. gameplay buttons look like the same UI family as the menu;
4. New Game icon is readable without tooltip;
5. cards and all gameplay geometry remain pixel-for-pixel in the same layout.
