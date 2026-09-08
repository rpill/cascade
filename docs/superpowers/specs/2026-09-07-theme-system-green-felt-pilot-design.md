# Cascade Solitaire — Theme System & Green Felt Club Pilot Design

**Date:** 2026-09-07  
**Status:** Approved  
**Scope:** Production theme contract plus one complete Green Felt Club pilot. This spec does not add XP, Coins, Shop pricing, purchases, or a finished Collection screen.

## 1. Purpose

Cascade Solitaire needs cosmetic progression only if cosmetics can be produced repeatedly at a quality high enough to feel like meaningful rewards.

The first step is therefore not to build the economy. It is to prove a repeatable **Theme Pack pipeline** by producing one complete alternative theme — **Green Felt Club** — and integrating it into the real game without changing gameplay geometry, card faces, or application structure.

The pilot must answer four product questions:

1. Can one theme change the feel of the game enough to be worth unlocking?
2. Can the required assets be generated and polished consistently rather than found as one-off packs?
3. Can theme changes be applied through a small reusable technical contract instead of per-screen rewrites?
4. Is the production cost low enough that several launch themes are realistic?

Until the pilot answers those questions positively, XP reward pacing, Coins, Shop inventory, and long-term Collection counts remain intentionally unfixed.

---

## 2. Relationship to existing specs

This spec refines the cosmetic direction in:

- `docs/superpowers/specs/2026-09-04-retention-meta-progression-design.md`;
- `docs/superpowers/specs/2026-09-05-ui-system-hybrid-shell-design.md`.

Where they conflict, this document supersedes the older cosmetic structure.

Specifically:

- a **Theme Pack** becomes the primary meaningful cosmetic unit;
- table surface, card back, slot treatment, and visual accent are not treated as unrelated primary products for the first release;
- standalone card backs, cursors, profile frames, badges, and similar small cosmetics may exist later as secondary rewards, but they are not required by this pilot;
- the old assumption that a soft-currency Shop must exist in the first meta release is no longer approved merely by the older retention spec;
- Coins, Shop pricing, rewarded-ad currency, and real-money cosmetic pricing must be reconsidered only after the theme-content pipeline is proven;
- the existing Hybrid Shell remains one application UI system. A theme may change its environment and limited accent tokens, but must not redesign Play, Rules, Statistics, or other pages separately.

The existing rule that progression gives **no gameplay advantage** remains unchanged.

---

## 3. Product definition: Theme Pack

A Theme Pack is a curated visual preset that changes the atmosphere of Cascade while preserving the game itself.

For the first production contract, every complete theme has four required visual pillars:

1. **Board surface** — the dominant tabletop material behind gameplay.
2. **Card back** — the stock/back-face artwork chosen to contrast with that surface.
3. **Board slot treatment** — foundation, stock/free-cell, and relevant empty-slot colours/line treatment.
4. **Theme accent tokens** — the small palette used for board symbols, highlights, and limited shell/HUD accents.

A complete theme also supports:

5. **Cursor treatment** — a theme-compatible pointer where browser/platform behavior allows it, with a native cursor fallback.
6. **Shell environment** — the environmental background around the parchment shell, derived from the same theme atmosphere.
7. **Collection preview composition** — a deterministic preview assembled from actual theme assets, not a separately illustrated marketing picture.

The theme is equipped as one coherent preset. The first release must not allow arbitrary combinations such as Green Felt board + Burgundy card back + Midnight slots unless such mixing is explicitly designed and tested later.

---

## 4. Hard invariants

Themes are cosmetic only.

A theme must never change:

- solitaire rules;
- RNG/deal identity;
- Standard, Classic, or Daily semantics;
- stock draw order;
- free-cell behavior;
- undo behavior;
- legal move geometry;
- card positions;
- foundation positions;
- tableau positions;
- responsive layout calculations;
- card width/height rules;
- hit areas;
- gameplay camera zoom or scroll;
- Daily/ordinary timing;
- leaderboard scoring;
- current face-card deck;
- UI navigation hierarchy;
- shell page structure.

The existing gameplay screenshot/layout is the structural source of truth. Theme concept art is allowed to change only cosmetics; generated concept images must not move foundations, stock, tableau columns, HUD actions, or other gameplay elements.

---

## 5. Shared vs themed UI

The Hybrid Shell remains recognizable across all themes.

### 5.1 Shared across themes

The following remain globally shared unless a future spec deliberately changes them:

- parchment shell concept;
- page layout;
- typography hierarchy;
- component geometry;
- navigation structure;
- button sizes;
- icon geometry;
- Rules carousel layout;
- Statistics/Leaderboard layout;
- result-screen information hierarchy.

### 5.2 Allowed theme influence

A theme may change:

- the environment visible around the shell;
- a limited set of CSS colour/accent tokens;
- subtle shell/HUD accent colours where readability remains unchanged;
- the board surface and board-specific Phaser colours;
- card-back asset;
- cursor asset;
- preview composition.

No theme receives bespoke Play, Rules, Statistics, or Collection page artwork. If a future theme needs a unique page layout to look good, the Theme Pack contract has failed.

---

## 6. Green Felt Club art direction

Green Felt Club is the first full production pilot because it is visually far from the current wood baseline while remaining a natural card-table environment.

### 6.1 Fantasy

A restrained private card club:

- deep green felt;
- warm ivory;
- antique brass / muted gold;
- burgundy card back;
- calm, classic, slightly vintage atmosphere;
- premium through material and restraint rather than decorative clutter.

It must not look like:

- a neon casino;
- poker broadcast graphics;
- glossy mobile-casino UI;
- a photorealistic 3D room;
- a decorative diorama with lamps, glasses, books, chips, or other objects competing with the cards.

### 6.2 Working palette

The implementation may tune exact values after real-board testing, but the art direction begins around:

| Role | Working value |
|---|---|
| Felt base | `#315B46` |
| Felt dark | `#203F33` |
| Felt light | `#47745B` |
| Antique brass | `#A78349` |
| Dark brass | `#6D5632` |
| Warm ivory | `#E9DFC7` |
| Dark ink | `#29251F` |
| Burgundy card-back family | `#733D3C` |

Exact hex values are implementation tuning, not permanent content identifiers.

---

## 7. Green Felt Club asset contract

The pilot produces the isolated production assets below. Generated concept images are references only and must not ship as flattened gameplay screenshots.

### 7.1 Board surface

**Target:** `2048 × 2048` raster texture.

Requirements:

- top-down, perspective-free surface;
- seamless or visually tile-safe at normal game scale;
- subtle felt fibre/variation;
- no large stains, folds, scratches, seams, borders, text, logos, cards, or props;
- no baked vignette tied to one viewport size;
- cards remain the highest-contrast objects on the board;
- file size should stay in the same practical range as the current 2048² board textures rather than becoming a multi-megabyte art dump without visible benefit.

Preferred final format is a web-friendly opaque raster (`.jpg` or equivalent supported by the existing pipeline) after visual comparison in-game.

### 7.2 Card back

**Target:** `360 × 480` transparent-capable PNG, matching the current runtime card asset canvas.

Direction:

- burgundy / wine base rather than green-on-green;
- warm ivory and/or muted brass ornament;
- strong outer frame so the stock remains distinct against green felt;
- vertically symmetrical or convincingly two-way;
- bold enough to read at the minimum gameplay card width;
- no borrowed logos, trademarks, or recognizable copied card-back design;
- no tiny narrative illustration that disappears at gameplay scale.

The existing face cards stay unchanged.

### 7.3 Cursor

Preferred source: simple theme-compatible SVG with explicit dimensions and a defined hotspot when applied through CSS.

Direction:

- warm ivory main shape;
- dark outline;
- restrained brass detail;
- simple silhouette readable over both felt and parchment;
- native cursor fallback is mandatory if custom cursor loading/support fails.

The cursor must not become a large decorative object or obscure card corners.

### 7.4 Slots and symbols

Foundation/stock/free-cell treatment should be rendered from theme data/tokens where practical rather than shipping a separate bitmap for every slot.

Green Felt direction:

- thin antique-brass frame;
- low visual weight;
- suit symbols remain distinguishable;
- red suits may retain a muted red family where needed for semantic recognition;
- empty slots should recede behind actual cards;
- valid-target/highlight treatment uses warm brass/ivory, not bright green.

### 7.5 Shell environment

The selected theme may change the environmental background around the parchment application shell.

For Green Felt Club this should reuse the same felt/material family or a closely related club environment treatment, but it must remain quieter than gameplay and the parchment content surface.

No separate bespoke background is required if the board-surface asset can be reused convincingly through crop, scale, overlay, and tint.

### 7.6 Collection preview

The Theme Pack does not require a hand-painted marketing thumbnail.

A future Collection card should compose a preview from real theme data/assets, for example:

- theme surface;
- theme card back;
- one shared face card;
- one representative slot/accent.

This keeps previews truthful and makes the pipeline repeatable.

---

## 8. Theme data contract

The implementation should converge on a registry-driven definition rather than theme-specific conditionals scattered through Phaser and CSS.

Conceptual shape:

```ts
interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly boardSurface: string;
  readonly cardBack: string;
  readonly cursor?: string;
  readonly colors: {
    readonly boardTint: number;
    readonly slotFill: number;
    readonly slotStroke: number;
    readonly foundationSymbol: string;
    readonly redFoundationSymbol: string;
    readonly highlight: number;
    readonly shellAccent: string;
  };
}
```

The exact TypeScript shape may change during implementation, but these responsibilities must stay centralized.

The initial registry contains at least:

- `walnut_study` — current/default visual baseline;
- `green_felt_club` — pilot theme.

The current/default theme remains Walnut Study for ordinary players until Collection/progression explicitly equips another theme.

---

## 9. Theme selection and pilot preview

The pilot must be testable before the Collection screen exists.

Selection precedence for the pilot:

1. a non-persistent explicit preview override, such as `?theme=green_felt_club`, when valid;
2. a valid persisted equipped theme once that value is supported by the runtime;
3. `walnut_study` fallback.

The preview override:

- exists only to test/theme-review the pilot;
- must not write back to `MetaSave`;
- must not unlock or grant ownership;
- must not alter gameplay state;
- may remain as a harmless developer/QA mechanism after Collection exists.

Unknown theme IDs fall back safely to Walnut Study.

---

## 10. Asset loading and failure behavior

Cosmetic failure must never prevent solitaire from loading.

Requirements:

- the default Walnut assets remain a guaranteed fallback;
- a missing/failed Green Felt board surface falls back to the default board surface;
- a missing/failed card back falls back to the default red back;
- a missing/failed cursor falls back to the normal browser pointer;
- invalid theme data never corrupts `MetaSave` or active-game checkpoints;
- theme loading failure does not disable Standard, Classic, or Daily;
- switching/applying theme must not reset the active board or attempt timer.

The implementation should avoid loading the full asset payload of every future theme at startup. The pilot may preload the two known themes if implementation simplicity requires it, but the architecture must keep theme assets addressable per definition so later lazy loading is possible without redesigning the domain contract.

---

## 11. Production pipeline

The goal is a repeatable conveyor, not a one-off Green Felt art pass.

Each future theme should follow the same sequence:

1. **Full-screen concept on the real Cascade screenshot** — layout is locked; only cosmetics change.
2. **Board surface isolation** — generate/select the surface separately.
3. **Real-board check** — place the current face cards on it before producing the rest.
4. **Card-back generation** — produce candidates designed specifically against that surface.
5. **Gameplay-scale check** — verify stock readability at minimum and normal card sizes.
6. **Slot/accent token pass** — derive from the theme palette rather than inventing a new component system.
7. **Cursor pass** — small and theme-compatible; simplify manually if generated output is noisy.
8. **Shell environment application** — reuse the theme asset/tokens, no per-page redesign.
9. **Responsive visual QA** — desktop plus compact landscape.
10. **Package/provenance check** — final assets only, predictable paths, no accidental concept/reference images shipped as runtime art.

AI generation is an allowed production method for original assets. Generated outputs are still subject to manual selection, cleanup, contrast checks, sizing, compression, and consistency review before shipping.

---

## 12. Collection and economy implications

The pilot deliberately separates **content feasibility** from **economy design**.

If Green Felt Club proves the pipeline works, the likely product structure becomes:

- large milestone rewards: complete Theme Packs;
- smaller intermediate rewards later: card backs, cursors, profile badges/frames, titles, or other cheap cosmetics;
- no gameplay-power rewards.

However, this spec does **not** approve:

- a Coins balance;
- Shop prices;
- rewarded-ad currency amounts;
- XP curve values;
- level reward cadence;
- a required number of launch themes;
- real-money theme prices.

Those decisions should be made only after measuring the actual cost and quality of this pilot.

---

## 13. Testing strategy

Tests protect the theme system contract without freezing temporary artwork.

Automated tests should cover:

- valid theme lookup;
- invalid ID fallback to Walnut Study;
- preview query override without persistence mutation;
- board surface/card-back asset wiring by theme;
- theme application does not alter responsive layout outputs;
- theme application does not alter model/gameplay state;
- fallback behavior when optional theme assets are unavailable;
- CSS/DOM shell receives only shared theme tokens rather than separate page-specific theme branches.

Tests must **not**:

- hash-lock image bytes;
- freeze exact Green Felt colour values as permanent product rules;
- freeze exact decorative coordinates;
- require a specific AI-generated artwork version forever;
- make future visual reskins difficult.

Manual visual QA is required because theme quality cannot be proven by unit tests.

At minimum, inspect:

- desktop landscape around `1920 × 1080`;
- smaller desktop / laptop landscape around `1280 × 720`;
- compact phone/tablet landscape in the currently supported range;
- gameplay board with short and long tableau columns;
- stock visible with the Green Felt card back;
- stock exhausted/free-cell state;
- foundation slots both empty and partially filled;
- Home shell over the selected theme environment;
- Rules and Statistics to ensure the shared shell still reads correctly;
- F5/resume in the Yandex environment after theme integration.

---

## 14. Pilot acceptance criteria

Green Felt Club is accepted as a successful production pilot only when all of the following are true:

1. **Immediate differentiation:** a Walnut Study ↔ Green Felt Club comparison clearly reads as two different themes without changing card faces or layout.
2. **Card readability:** current face cards remain easier to notice than the felt texture at all supported card sizes.
3. **Stock readability:** the burgundy card back separates clearly from the green table at a glance.
4. **Layout integrity:** foundation rail, stock/waste, tableau columns, HUD, card sizes, and gaps are unchanged by theme selection.
5. **Cross-screen coherence:** Gameplay, Home, Rules, and Statistics still look like one Cascade application rather than separately skinned screens.
6. **Asset consistency:** surface, back, slot treatment, cursor, and accents look like one art direction.
7. **Safe fallback:** missing or invalid theme data cannot prevent a playable game.
8. **Repeatable structure:** the next theme can be added by supplying the same classes of assets/tokens plus one registry entry rather than modifying gameplay layout or duplicating page code.
9. **Reasonable payload:** final theme assets are compressed to practical web sizes and do not require shipping concept/reference images.
10. **Manual Yandex smoke:** F5/session resume and normal platform flow still work with the theme active.

---

## 15. Explicit non-goals for this pilot

Do not add during this pilot:

- a finished Collection page;
- a Shop catalog;
- Coins;
- XP or mastery levels;
- Daily XP bonuses;
- streak rewards;
- achievements;
- purchases;
- rewarded-ad payouts;
- alternative 52-card face decks;
- theme-specific gameplay animations;
- theme-specific sound packs;
- arbitrary mixing of theme components;
- production art for additional themes.

The only product goal is to prove that one complete alternative Theme Pack can be produced, integrated, and repeated cleanly.
