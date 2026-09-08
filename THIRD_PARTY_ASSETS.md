# Third-party assets

## Veilworks Studio — Vintage playing cards

- Runtime location: `public/assets/cards/`
- Source used for this project: Veilworks Studio vintage playing-card demo supplied for evaluation.
- License copy: `public/assets/licenses/vintage-demo-license.txt`
- The supplied license permits use in free and commercial projects and permits modification. It prohibits redistributing or reselling the raw assets as standalone files/stock graphics/asset packs and prohibits claiming the raw files as your own. Attribution is appreciated but not required.

## Poly Haven — Fine Grained Wood

- Runtime location: `public/assets/theme/fine-grained-wood.jpg`
- Source texture: Fine Grained Wood color/albedo map from Poly Haven.
- License: CC0.
- Used by the menu/detail treatment; normal, roughness, and AO maps are not shipped.


## Poly Haven — Dark Wooden Planks

- Runtime location: `public/assets/theme/menu-dark-wood.jpg`
- Source material: `Dark Wooden Planks` diffuse map by Amal Kumar, supplied in the project asset bundle.
- Source page: Poly Haven asset `dark_wooden_planks`.
- License: CC0.
- The runtime JPG is a size/quality-optimized derivative of the supplied diffuse map; no normal, roughness, AO, or displacement maps are shipped.

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

- Runtime location: `public/assets/ui/decor/decor-card-back-red.png`
- Source: red card back from The Public Domain Deck supplied in the project asset bundle.
- License copy: `public/assets/licenses/public-domain-deck-cc0.txt`
- License: CC0 1.0 Universal.
- The runtime PNG is downscaled for menu decoration only; gameplay cards remain the Veilworks deck above.

## Font Awesome Free 6.7.2 — Home presentation icons

- Runtime locations: `public/assets/ui/icons/crown.svg`, `calendar.svg`, `trophy.svg`, `question.svg`, `gear.svg`.
- Source: Font Awesome Free 6.7.2, locally vendored SVG assets.
- License copy: `public/assets/licenses/fontawesome-free-license.txt`.
- Icon license: Creative Commons Attribution 4.0 International (CC BY 4.0).
- These SVGs are used only for Home/menu presentation; the accepted gameplay HUD glyphs remain the project's own compact icon set.

## The Public Domain Deck — Home suit emblems and matching decorative queen

- Runtime locations: `public/assets/ui/icons/spade-ornate.png`, `heart-suit.png`, `public/assets/ui/decor/decor-card-queen-spades.png`.
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

## Walnut Study theme refinement (2026-09-08)

- `public/assets/themes/walnut-study/board-surface.webp`: generated with the built-in ImageGen tool, then encoded as WebP. The final prompt and provenance are recorded in `public/assets/themes/walnut-study/README.md`.
- `public/assets/themes/walnut-study/card-back.svg` and the slot paths in `src/theme/SlotArtwork.ts`: original project vector artwork, no external font or icon dependency.
- Existing public-domain card faces and the Green Felt Club assets are unchanged.

## Burgundy Club refinement (2026-09-08)

- `public/assets/themes/burgundy-club/board-surface-refined.webp`: ImageGen edit of the user-supplied scene, encoded as WebP. Both prompts and geometry are recorded in the theme README. The provenance/license of the imported source is not independently established here.
- The user-supplied `card-back.png` ornament is unchanged; a runtime texture frame excludes transparent padding.
- Separate slot frames, shared suit/stock glyphs and paper-edge SVGs are project vector artwork in `src/theme/SlotArtwork.ts` and `src/theme/ThemeAssets.ts`.
