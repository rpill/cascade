# Third-party assets

## Veilworks Studio — Vintage playing cards

- Runtime location: `public/assets/cards/`
- Source used for this project: Veilworks Studio vintage playing-card demo supplied for evaluation.
- License copy: `public/assets/licenses/vintage-demo-license.txt`
- The supplied license permits use in free and commercial projects and permits modification. It prohibits redistributing or reselling the raw assets as standalone files/stock graphics/asset packs and prohibits claiming the raw files as your own. Attribution is appreciated but not required.

## ambientCG — Paper 001 and Paper 004

- Runtime locations: `public/assets/ui/paper-001-color.jpg`, `public/assets/ui/paper-004-color.jpg`
- Source materials: ambientCG `Paper 001` and `Paper 004` 2K JPG color maps supplied for this project.
- License: CC0.
- The runtime JPGs are size/quality-optimized derivatives of the supplied color maps. PBR normal, roughness, displacement, and scene files are not shipped.

## Wikimedia Commons — public-domain ornament sources

- Runtime locations:
  - `public/assets/ui/ornaments/art-nouveau-flourish.svg`
  - `public/assets/ui/ornaments/redmond-corner.svg`
  - `public/assets/ui/ornaments/harpels-flourish.svg`
- Sources supplied for this project:
  - `Art Nouveau flourish.svg` — ornament from a 1909 French graphic-design publication.
  - `Ornamental corner by S. H. Redmond 01.svg` — ornament from an 1895 pattern book.
  - `Harpel’s flourish 5.svg` — typographic ornament from an 1870 specimen book.
- These source works are public-domain historical ornament material distributed through Wikimedia Commons. Runtime use recolors/scales them through CSS masks; the SVG source geometry is preserved.

## The Public Domain Deck — decorative card back

- Runtime location: `public/assets/ui/decor/decor-card-back-red.webp`
- Source: red card back from The Public Domain Deck supplied in the project asset bundle.
- License copy: `public/assets/licenses/public-domain-deck-cc0.txt`
- License: CC0 1.0 Universal.
- The runtime PNG is downscaled for menu decoration only; gameplay cards remain the Veilworks deck above.

## Font Awesome Free 6.7.2 — menu and Daily presentation icons

- Runtime locations: `public/assets/ui/icons/fire.svg` (solid `fire-flame-curved`), `crown.svg`, `calendar.svg`, `trophy.svg`, `question.svg`, `gear.svg`.
- Source: Font Awesome Free 6.7.2, locally vendored SVG assets.
- License copy: `public/assets/licenses/fontawesome-free-license.txt`.
- Icon license: Creative Commons Attribution 4.0 International (CC BY 4.0).
- These SVGs are used only for Home/menu/Daily presentation; the accepted gameplay HUD glyphs remain the project's own compact icon set.

## The Public Domain Deck — Home suit emblems and matching decorative queen

- Runtime locations: `public/assets/ui/icons/spade-ornate.webp`, `heart-suit.webp`, `public/assets/ui/decor/decor-card-queen-spades.webp`.
- Source: ace-of-spades / ace-of-hearts suit artwork and queen of spades from The Public Domain Deck supplied in the project asset bundle.
- License copy: `public/assets/licenses/public-domain-deck-cc0.txt`.
- License: CC0 1.0 Universal.
- The suit PNGs are cropped/downscaled derivatives used as mask assets; the decorative queen is resized to the exact dimensions of the matching CC0 card back so the background cards share one physical size.


## Integrated Home frame derivatives

- Files: `public/assets/ui/frames/home-shell-frame.svg`, `public/assets/ui/frames/home-mode-card-frame.svg`.
- These are layout derivatives assembled for Cascade from the already listed public-domain `Art Nouveau flourish.svg` source; the historical ornament is mirrored into four corners and joined with simple rule lines so the ornament and frame render as one unit.
- No additional third-party artwork is introduced by these derivative files.

## v6.3 compact ornamental frame source

- Source: Wikimedia Commons, `Corner Ornament Black Up Right.svg` (antique floral corner ornament; Universal Public Domain Dedication on the source page).
- Cascade runtime derivatives:
  - `public/assets/ui/frames/home-shell-frame-9slice.png`
  - `public/assets/ui/frames/home-mode-card-frame-9slice.png`
- The source corner is mirrored into the four fixed nine-slice corners and joined by simple straight rules. The central atlas region is transparent; only the edge slices carry the straight frame lines.

## Tabler Icons 3.46.0 — Gameplay HUD action icons

- Runtime implementation: `src/game/view/ui/UiIcons.ts`.
- Selected outline glyphs: `arrow-back-up` (Undo), `refresh` (Restart), `cards` (New Deal), `home` (Home).
- Source: Tabler Icons 3.46.0, https://tabler.io/icons / https://github.com/tabler/tabler-icons.
- License: MIT.
- License copy: `public/assets/licenses/tabler-icons-license.txt`.
- The four gameplay actions intentionally use the same 24×24 outline family and 2px stroke language.

## Kenney — live tabletop SFX (2026-09-10)

- Runtime directory: `public/assets/audio/sfx/`.
- Card handling and reward foley source: **Casino Audio 1.1** by Kenney Vleugels (Kenney.nl), supplied as `kenney_casino-audio.zip`. License: CC0 1.0; license copy: `public/assets/licenses/kenney-casino-audio-cc0.txt`.
- Menu click source: **UI SFX Set** by Kenney Vleugels (Kenney.nl), supplied as `UI_SFX_Set.zip`. The bundled readme grants use in personal and commercial projects and says credit is optional; copy: `public/assets/licenses/kenney-ui-sfx-readme.txt`.
- Runtime OGG files are trimmed/level-adjusted derivatives of those live recordings. No synthesized/MIDI placeholder SFX remain in the runtime directory.
- `card-touch-*` uses one stable short real card-shove/rustle transient; `deal-*` uses short cropped rustle transients from Kenney's real `card-shuffle.ogg` recording, one per dealt card; `card-place-*` uses card placement recordings for every successful landing including foundations; `undo-*` uses card slides. Victory uses a card fan and rank-up feedback uses the shared live foley set.

