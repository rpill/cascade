# Cascade Solitaire — Theme Factory

> **Purpose:** production contract for creating many gameplay themes without degrading the visual quality of the approved concepts.
>
> **Source of truth:** the current repository and `docs/THEMES.md`. If this file ever conflicts with the runtime theme API, the current code and `docs/THEMES.md` win; update this document before continuing production.

## 0. Non-negotiable goal

A theme is not finished because it loads, tests pass, or the colors changed.

A theme is finished only when the **runtime game preserves the visual quality and atmosphere of its approved concept**.

The production chain is:

**concept → approved visual direction → separately rendered assets → asset QA → runtime integration → runtime screenshots → concept-vs-runtime QA → accept/reject**

Do not skip directly from an idea to runtime assets.

---

## 1. Hard scope

A gameplay theme may change:

- board/table surface;
- card back;
- foundation/tableau/stock-free-cell slot appearance;
- gameplay control palette.

A gameplay theme must not change:

- card faces;
- card geometry;
- card scale;
- tableau/foundation/stock coordinates;
- `ViewportLayout`;
- deal/game rules;
- drag/drop behavior;
- HUD geometry;
- approved Tabler gameplay icons;
- shell/menu/rules/statistics layout;
- typography unless a separate task explicitly changes it.

The existing theme architecture must be reused. Do not create theme-specific gameplay logic.

---

## 2. Current runtime contract

Read these files before touching a theme:

- `docs/THEMES.md`
- `src/theme/ThemeDefinition.ts`
- `src/theme/ThemeRegistry.ts`
- `src/theme/ThemeAssets.ts`
- `src/theme/ThemeLoader.ts`
- `src/theme/SlotArtwork.ts`
- `src/game/view/TableAppearanceView.ts`
- `src/game/view/BoardTexture.ts`

Current theme bundle:

```ts
{
  id,
  name,
  boardSurface,
  surfaceScale: 'cover' | 'tile',
  cardBack,
  slots,
  controls,
  boardTint?
}
```

`ThemeId`, `isThemeId()` and `getThemes()` derive from `THEMES`. Add one registry entry; do not create a parallel theme-id list.

Texture keys must be unique across every theme.

### Surface modes

Use `cover` for an authored full-table composition. It preserves aspect ratio and crops centrally.

Use `tile` only for a genuinely seamless material that is meant to repeat at its native scale.

**Default for premium authored themes: `cover`.**

---

## 3. The core lesson from failed theme passes

Do not reduce a concept to:

> flat color texture + generic frame + improvised AI card back.

That destroys the atmosphere that made the concept attractive.

The approved concept is a **composition**. If it contains books, brass objects, cards, pens, leaves, coins, paper, lamp parts, or other props around the periphery, those are part of the theme language and may belong in the final board surface.

The gameplay area must remain readable, but the table does **not** need to be a featureless texture.

### Current Burgundy Club

The current runtime `burgundy_club` is allowed to remain in the game, but it is a **negative production example**, not the visual quality bar.

Known problems to avoid in future themes:

- generated slot art has internal padding, making frames look smaller than actual cards;
- AI-generated suit icons have dirty/aliased edges;
- card back has extraction/background artifacts;
- card back does not separate strongly enough from the board;
- board contains accidental dark bands/lighting artifacts;
- board lost the peripheral props and atmosphere visible in the concept;
- tests passing did not mean the theme was visually acceptable.

The **Burgundy concept sheet** is the positive reference; the current runtime Burgundy implementation is not.

---

## 4. Production unit: one approved theme

Every theme begins with one `THEME CONCEPT SHEET`.

The concept sheet must show, at minimum:

1. representative gameplay table;
2. board/background language;
3. card back;
4. foundation slot treatment;
5. stock/free-cell treatment;
6. gameplay controls in context.

The concept is **not** an asset to crop apart.

It is the visual reference used to re-render each production asset separately at proper resolution.

### Concept approval gate

Before making runtime assets, answer:

- Is the board attractive even without cards?
- Does the theme have a clear identity beyond a color swap?
- Is the card back visibly distinct from the board?
- Can the foundation slots be seen without dominating the cards?
- Are the peripheral props atmospheric rather than obstructive?
- Does the concept look like the same game as Walnut Study?

If any answer is no, revise the concept first.

---

## 5. Board-surface production

### Preferred result

A premium top-down table scene:

- large calm gameplay zone;
- strong material identity;
- controlled peripheral decoration;
- props mainly near corners and outer edges;
- no important object under gameplay cards;
- no text;
- no baked UI;
- no baked foundation/stock rectangles;
- no accidental center stripe;
- no aggressive central vignette;
- no perspective distortion.

### Composition rule

The center must be playable, not empty-looking.

Use subtle material variation across the center. Put richer storytelling around the periphery.

Good examples of peripheral elements:

- leather-bound books;
- brass desk pieces;
- fountain pen;
- coins/tokens;
- leaves;
- stationery;
- small flowers;
- wax seal;
- corner of a card box;
- lamp base;
- compass;
- writing instruments.

Do not use props that look interactive unless they actually are.

### Safe zones

Before generating the final board:

1. inspect current `ViewportLayout`;
2. capture current runtime screenshots at:
   - `1915 × 953`
   - `1366 × 768`
   - `844 × 390`
3. create a temporary overlay showing the union of all card/slot/HUD occupied areas;
4. keep visually strong props outside that union.

If an object must enter the gameplay area, it must be extremely low-contrast and non-interactive-looking.

### Resolution and aspect

For authored `cover` boards, target an approximately **2:1 landscape composition** matching desktop gameplay.

Preferred master sizes:

- `3072 × 1536`, or
- `2560 × 1280`, or
- at minimum `2048 × 1024`.

Generate/render at the highest native resolution available.

**Never take a small square image and upscale/stretch it into the board.**

Cropping is allowed. Non-uniform stretching is not.

If the source model cannot directly output the target ratio, generate at its largest landscape ratio and extend/crop compositionally; do not simply resize the image to fit.

### Board QA

Inspect at:

- 100% zoom;
- actual 1915×953 runtime size;
- compact landscape.

Reject if:

- visible AI smearing;
- repeated malformed patterns;
- accidental dark/light band through the center;
- pixelated/mushy material;
- obvious mirroring seam;
- props collide with cards;
- props look like buttons/interactive objects;
- surface overwhelms card faces.

---

## 6. Card-back production

The card back is a hero asset. Do not treat it as a small decorative afterthought.

### Runtime geometry

Use card ratio `216 × 302`.

Preferred raster export:

- `432 × 604` minimum;
- `864 × 1208` master if practical.

### Generation method

Use the **approved concept card-back crop as a visual reference** and re-render the card back separately.

Do not:

- crop the card back directly out of the concept;
- generate a card lying on a table and then cut it out;
- include external background;
- include cast shadow outside the card;
- include fingers/props;
- improvise a completely different design.

The result should be a flat orthographic card-back artwork, front-facing, filling the canvas.

### Design requirements

- strong outer border;
- readable silhouette at gameplay size;
- two-way/symmetrical composition where practical;
- limited number of large motifs;
- no tiny pseudo-text;
- no micro-detail that turns to noise;
- no AI artifacts at corners;
- no broken repeated ornament.

### Contrast requirement

A card back may share the theme hue, but its **edge must clearly separate from the board**.

Use at least one:

- ivory outer border;
- bright metallic border;
- dark contrasting keyline;
- clearly different value/luminance from the board.

Check the card back at actual runtime size **on top of the final board surface**, not on a neutral preview background.

If it visually disappears into the table, reject it.

---

## 7. Slot production

### Default: vector slots

Prefer `slots.kind: 'vector'`.

Use the shared runtime geometry and clean vector suit paths from `src/theme/SlotArtwork.ts`.

This guarantees:

- exact card-size frame geometry;
- no AI edge artifacts;
- consistent ♣ ♦ ♥ ♠;
- consistent stock icon;
- no accidental internal padding;
- responsive rendering.

For most themes, only change:

```ts
palette: {
  recess,
  edge,
  highlight,
  blackSuit,
  redSuit
}
```

### When authored image slots are justified

Use `slots.kind: 'images'` only if the theme truly needs a distinctive material/frame that cannot be represented well by the shared vector slot.

If using image slots:

- canvas: exactly `432 × 604`;
- transparent background outside the authored slot;
- visible outer frame must reach almost to the card boundary;
- recommended maximum transparent inset: **4–8 px** at 432×604;
- no decorative 10–15% padding;
- no external drop shadow;
- no perspective;
- all six slots must share the exact same master frame.

Never generate six independent frames.

Create:

1. one master frame;
2. clean SVG/vector suit symbols;
3. clean stock glyph;
4. programmatically composite/export the six role images.

### Suit glyph rule

**Do not use AI-generated raster suit icons.**

Use the normalized suit paths already in `SlotArtwork.ts` or another clean SVG source with compatible licensing.

The red suits may change color by theme; do not redraw their shapes.

### Slot contrast

The frame must remain visible on the busiest and darkest part of the board.

At the same time, it must remain visually weaker than a real card.

If a slot disappears in the runtime screenshot, its palette is wrong.

---

## 8. Gameplay controls

Keep the approved gameplay icon set and geometry.

Only theme the colors:

```ts
controls: {
  surface,
  hover,
  ink,
  edge,
  labelSurface,
  labelInk,
  focus
}
```

The controls should belong to the same material family as the board, while remaining readable and obviously interactive.

Do not invent a new icon set per theme.

---

## 9. Asset contact sheet gate

Before registry integration, create a simple contact sheet containing the **real production files**, not concept crops:

- board surface;
- card back at 1× runtime size;
- card back at 0.5× runtime size;
- all four foundation slots;
- tableau-empty;
- stock/free-cell;
- controls palette swatches.

Place the card back and slots directly over a representative crop of the actual board.

Reject before coding if:

- card back merges into board;
- slot frame disappears;
- slot image looks smaller than a card;
- suit edges are dirty;
- ornament collapses at runtime scale;
- board contains generation artifacts.

---

## 10. Runtime integration

Recommended folder:

```text
public/assets/themes/<theme-id-kebab>/
  board-surface.webp
  card-back.png
  README.md
  slots/                  # only for slots.kind: 'images'
    tableau-empty.png
    clubs.png
    diamonds.png
    hearts.png
    spades.png
    stock-free-cell.png
```

Registry id uses snake_case:

```text
burgundy_club
navy_study
black_marble
```

Folder uses kebab-case:

```text
burgundy-club
navy-study
black-marble
```

Add exactly one `THEMES` entry.

Do not refactor theme infrastructure while adding a theme.

Do not modify Walnut Study unless the user explicitly asks.

---

## 11. Theme README / provenance

Every authored theme folder must contain `README.md` with:

- theme id/name;
- status: concept / candidate / accepted;
- concept-sheet filename;
- final board prompt/instructions;
- final card-back prompt/instructions;
- whether slots are vector or image;
- asset dimensions;
- generation source/model if known;
- manual edits performed;
- accepted runtime screenshot filenames;
- known compromises.

Generated first-party artwork is not a third-party license entry.

If an external asset is used, update `THIRD_PARTY_ASSETS.md` with the real source and license.

Never overwrite the whole third-party inventory to add one entry.

---

## 12. Runtime visual QA

For every candidate theme:

```text
/?theme=<id>
```

Capture at least:

- `1915 × 953`
- `1366 × 768`
- `844 × 390`
- a state with an empty tableau column;
- a state with empty stock/free-cell;
- a state showing the card back.

Compare the runtime screenshot side by side with the approved concept.

### Critical acceptance checks

**Board**
- atmosphere survived;
- no stretching;
- no obvious crop failure;
- no dark stripe/artifact;
- props survive crop but do not collide with gameplay.

**Card back**
- immediately distinguishable from the board;
- clean edges;
- no extraction artifacts;
- design still looks premium at gameplay size.

**Slots**
- same apparent dimensions as cards;
- frame visible everywhere;
- icons clean;
- no padding illusion;
- empty tableau is readable but unobtrusive;
- stock/free-cell affordance is understandable.

**Gameplay**
- card faces remain highest-information objects;
- no layout changes;
- no hit-area changes;
- controls remain readable.

---

## 13. Visual acceptance rubric

Score every candidate 1–5.

| Category | Minimum |
|---|---:|
| Concept fidelity | 4 |
| Board atmosphere | 4 |
| Card-back quality | 4 |
| Card-back contrast | 4 |
| Slot readability | 4 |
| Asset cleanliness | 4 |
| Runtime readability | 4 |
| Mobile crop | 4 |

A critical score below 4 means **reject/revise**.

Do not average away a failure. A 5 in board atmosphere does not compensate for a 2 in card-back contrast.

Automated tests are separate and cannot override this rubric.

---

## 14. Technical verification

After visual acceptance:

```sh
node --test tests/*.test.ts tests/*.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
```

When the browser test environment is available:

```sh
node tests/browser/theme-runtime.mjs
```

Tests prove integration safety.

They do **not** prove visual quality.

---

## 15. Batch workflow for 20–30+ themes

Do not produce 30 themes in one undifferentiated run.

Default batch size: **5 themes**.

### Human-review mode

For each batch:

1. make 5 concept sheets;
2. present them together;
3. user rejects/approves directions;
4. produce assets only for approved concepts;
5. contact-sheet gate;
6. integrate;
7. runtime screenshots;
8. concept-vs-runtime gate;
9. accept/revise;
10. commit accepted batch.

### Autonomous mode

Use only when the user explicitly asks the model to continue without per-theme approval.

In autonomous mode:

- create 2–3 concept candidates per theme;
- self-score with the rubric;
- keep only candidates with all critical scores ≥4;
- generate production assets;
- run contact-sheet QA;
- integrate;
- run runtime QA;
- discard/rework failures;
- deliver a batch report with screenshots and scores.

Do not count rejected candidates toward the requested number of finished themes.

---

## 16. Suggested theme catalog

This is a starting backlog, not a requirement to implement all of them.

### Classic club / gaming room
1. Burgundy Club
2. Navy Study
3. Green Felt Club
4. Emerald Private Club
5. Royal Purple Velvet
6. Oxford Leather
7. Ivory & Brass
8. Art Deco Black & Gold

### Luxury materials
9. Black Marble
10. White Marble & Brass
11. Dark Onyx
12. Green Marble
13. Slate & Silver
14. Smoked Glass & Brass
15. Copper Patina

### Desk / study
16. Vintage Paper Desk
17. Victorian Library
18. Cartographer's Desk
19. Astronomer's Study
20. Captain's Navigation Desk
21. Botanist's Desk
22. Fountain Pen Atelier

### Cultural/material-inspired
23. Japanese Black Lacquer
24. Japanese Red Lacquer
25. Moroccan Walnut & Brass
26. Mediterranean Inlay
27. Alpine Lodge
28. Parisian Café Table

### Seasonal / collectible
29. Autumn Study
30. Winter Night Club
31. Spring Conservatory
32. Midsummer Garden
33. Midnight Observatory
34. Candlelit Archive

Prefer themes that can be understood from the table alone without changing card faces.

---

## 17. Instructions for GPT-6 Astra / future agent

When receiving this repository:

1. Read `PROJECT.md`, `CURRENT_STATE.md`, `TECH.md`, `docs/THEMES.md`, and this file.
2. Inspect the current theme implementation before generating anything.
3. Treat `walnut_study` as the **technical reference**.
4. Treat approved concept sheets as the **visual reference**.
5. Treat the current runtime Burgundy implementation as a **negative visual example**, not a target.
6. Never infer that “tests pass” means a theme looks good.
7. Never crop final assets out of a concept sheet.
8. Re-render production assets separately using the concept as reference.
9. Default to vector slots; never AI-generate suit glyphs.
10. Preserve props/atmosphere from the concept board instead of flattening every board into a uniform texture.
11. Work in batches of five unless the user requests otherwise.
12. Do not mark a theme complete until it passes both visual and technical gates.
13. Provide runtime screenshots for review.
14. Keep each patch scoped to theme assets, registry entry, provenance, and tests.

### Completion statement

A finished batch should report:

- accepted theme ids;
- rejected/reworked theme ids;
- concept-sheet references;
- final asset dimensions;
- slot mode (`vector` / `images`);
- runtime screenshot references;
- visual rubric scores;
- full test result;
- build result;
- any remaining visual compromises.

---

## 18. One-line rule

> **Do not implement the idea of the concept. Implement the visual quality of the concept.**
