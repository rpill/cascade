# Table theme refinement

Goal: ship a complete Walnut Study table and a reusable theme contract, starting from checkpoint dd496ca.

Design: an uninterrupted walnut playing surface with no perimeter, rim, leather inset or border. Fine wood grain and soft light provide depth. A burgundy card back and recessed card-sized placeholders share muted brass colors. Decoration stays inside card bounds; card faces and layout remain unchanged. The surface uses centered cover scaling without distortion; tile textures keep native scale. The two existing themes share one appearance view and asset loading pipeline.

- [x] Define complete themes (surface presentation, card back, vector or image slots, HUD palette); enumerate assets centrally and test uniqueness, completeness and fallback.
- [x] Create generated Walnut surface and a precise SVG card back. Use a common SVG slot template with theme colors and semantic suit mapping.
- [x] Extract TableAppearanceView from BoardView. Support replacing the complete appearance without touching game state. Pass theme to HUD and load saved equipped theme through the same resolver as previews.
- [x] Replace obsolete source-string styling tests with asset/behavior tests, run the existing gameplay suite and production build.
- [x] Inspect actual gameplay at desktop and compact landscape sizes, including empty stock, empty columns, another theme and theme changes. Document how to add a theme and save the image prompt/provenance.

Validation: Node test runner, TypeScript, Vite, browser screenshots and interaction checks. No extra dependencies or changes to rules, card-face assets, shop economy or collection UI.
