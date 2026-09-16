# European salon visual redesign

**Goal:** Replace the mixed Trifold/Cascade presentation with a coherent European card salon on desktop and landscape phones.

**Authorization:** User requested immediate implementation, a preliminary checkpoint, freedom to change all UI, and preservation of game logic and card faces. Checkpoint: e3a94a2. Work stays in the existing revamp/product-visual checkout.

**Visual direction:** Deep emerald, ivory, restrained brass; European lake illustration, botanical engraved ornament, dimensional collectible medals. Crisp native frames and typography; no Japanese landscapes, cat/library motif, distressed paper behind text, or schematic destination artwork.

**Architecture:** Retain Phaser scenes, callbacks, view models, theme IDs, economy and save formats. Replace shared visual primitives and semantic art assets. All registered themes receive matching new surfaces and backs; the collection renders real theme previews.

- [x] Preserve current UI in a checkpoint commit (leave user archive cascade.zip untouched).
- [x] Inspect reference art, scene structure and baseline checks.
- [ ] Produce and integrate European background, hero banner and rank medals.
- [ ] Replace stretched paper surfaces with crisp vector chrome; harmonize all secondary screens, HUD and overlays through shared components.
- [ ] Recompose home, make landscape phones use the available width, improve destination icons and text hierarchy.
- [ ] Replace all theme surfaces and card backs, synchronize collection previews, retain products and prices.
- [ ] Verify production build, compare test failures with baseline, inspect live desktop and landscape UI and interactions.
- [ ] Record asset provenance and verification results.

**Verification:** Baseline test run is stored in artifacts/redesign-baseline-tests.log: 840 tests, 752 passed, 88 failed before changes, largely contracts for retired DOM UI. New changes must introduce no unexplained regressions. Build and browser checks cover the active Phaser implementation. Protect src/game/model, src/meta, platform and card-face assets from modification. Test rendered scenes at desktop and compact landscape sizes, including navigation, settings, collection, mastery, rules and gameplay.
