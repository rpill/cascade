# Cascade Trifold Product Shell — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cascade's entire non-table product/UI layer with Trifold's responsive UI system and product progression semantics while leaving Cascade's card-table gameplay intact.

**Architecture:** Cascade remains the source of truth for solitaire rules, deal generation data, game saves, Yandex SDK integration, ads, auth/profile merge, and the live table scene. Trifold contributes the reusable UI runtime/components/layout/icons plus the selected-difficulty, mastery-rank, and idempotent coin-reward semantics. This phase creates a clean product/UI boundary and transplants Home, Daily, Mastery, Themes, Leaderboards, Settings, How to Play, victory UI, and product modals without rewriting the table.

**Tech Stack:** Phaser 3.90, TypeScript 5.9, Vite 7, Node test runner.

**Source references:** `cascade(20260915-213053).zip` and `trifold(3).zip`.

## Global Constraints

- Do not change Cascade solitaire rules, legal moves, tableau/foundation/free-cell logic, or card animation model. Save schemas may be changed freely because the game is not published yet.
- Preserve Yandex SDK, ads, GameplayAPI lifecycle, auth/profile merge behavior, leaderboard service, analytics, and menu-pause fixes already present in Cascade. Auth merge only needs to support the new schema; no legacy profile migration is required.
- Desktop and mobile-landscape Home geometry should follow Trifold's `HomeLayout.ts` and `UiViewport.ts` as closely as possible.
- Reuse Trifold SVG UI icons directly in Phase 1.
- Trifold Japanese artwork is temporary scaffolding only; the Phase 1 code must isolate artwork keys so Cascade-specific European/botanical assets can replace it later without layout changes.
- Remove XP/Level completely from the new product model and save schema. Do not carry `totalXp`, legacy level fields, or compatibility shims forward.
- New standard difficulty selection is explicit: `easy | medium | hard`. Onboarding remains a separate verified partition for new players.
- Mastery ranks and requirements are copied from Trifold: novice → player → tactician → expert → master → grandmaster; rank rewards 100/150/200/300/500 coins.
- Theme price remains 300 coins.
- Standard first-completion rewards use Trifold values: easy 5, medium 7, hard 10 coins. Daily first completion uses 15 coins on-time and 5 coins for archived completion.
- Reward settlement must be idempotent; replaying/resyncing the same seed/date/rank cannot grant coins twice.
- Because Cascade has not been published, prefer deleting obsolete fields and code over compatibility adapters. A clean reset of old draft/local/cloud saves is acceptable during this revamp.
- Every behavior change gets a failing test before production code.

---

### Task 1: Import the Trifold UI foundation into Cascade

**Files:**
- Copy/adapt: `src/ui/assets/UiAssets.ts`
- Copy: `src/ui/components/ActionCard.ts`
- Copy: `src/ui/components/CoinPill.ts`
- Copy: `src/ui/components/IconButton.ts`
- Copy: `src/ui/components/ModalShell.ts`
- Copy: `src/ui/components/PaperPanel.ts`
- Copy: `src/ui/components/ProgressMeter.ts`
- Copy: `src/ui/components/SceneBackdrop.ts`
- Copy: `src/ui/components/SegmentedControl.ts`
- Copy: `src/ui/components/UiSurface.ts`
- Copy: `src/ui/layout/HomeLayout.ts`
- Copy: `src/ui/layout/UiViewport.ts`
- Copy: `src/ui/style/UiTokens.ts`
- Copy/adapt: `src/ui/scenes/BaseUiScene.ts`
- Copy: `public/assets/ui/icons/*.svg`
- Copy temporarily: `public/assets/ui/art/{material,paper-grain,paper-landscape,table-grain}.webp`
- Create: `src/ui/assets/CascadeUiArt.ts`
- Modify: `src/game/scenes/BootScene.ts`
- Test: `tests/ui-components-contract.test.ts`
- Test: `tests/ui-viewport.test.ts`
- Test: `tests/home-layout.test.ts`
- Test: `tests/ui-asset-wiring.test.ts`

**Interfaces:**
- Produces: `preloadUiAssets(scene: Phaser.Scene): void`
- Produces: `computeHomeLayout(viewport: ResolvedUiViewport): HomeLayout`
- Produces: `UI_ICON_KEYS` identical to Trifold keys.
- Produces: `CASCADE_UI_ART_KEYS` for replaceable Cascade artwork; no screen may hard-code Japanese art filenames.

- [ ] Write/port UI foundation tests and verify they fail because Cascade has no `src/ui` foundation yet.
- [ ] Copy the Trifold component/layout code with only import-path and branding-key changes.
- [ ] Copy all Trifold UI SVG icons into Cascade unchanged.
- [ ] Add `CascadeUiArt.ts` so Home artwork is addressed semantically (`homeBackdrop`, `homeHero`, `paperPanel`, `rank.*`) rather than by Trifold filenames.
- [ ] Wire `preloadUiAssets()` into Cascade `BootScene` without changing game-card preload behavior.
- [ ] Run the focused UI tests, then the full Cascade test suite.
- [ ] Commit: `feat: import trifold ui foundation`

---

### Task 2: Add explicit standard difficulty and Trifold mastery state to Cascade saves

**Files:**
- Modify: `src/meta/MetaSave.ts`
- Modify: `src/meta/ProfileMerge.ts`
- Create: `src/meta/mastery/Mastery.ts`
- Create: `src/meta/economy/CoinRewards.ts`
- Modify: `src/meta/MetaOperations.ts`
- Test: `tests/meta-save.test.ts`
- Test: `tests/profile-merge.test.ts`
- Create: `tests/mastery.test.ts`
- Create: `tests/coin-rewards.test.ts`

**Interfaces:**
- Add `type StandardDifficulty = 'easy' | 'medium' | 'hard'`.
- Add `type MasteryRank = 'novice' | 'player' | 'tactician' | 'expert' | 'master' | 'grandmaster'`.
- Add persisted fields: `selectedStandardDifficulty`, `mastery`, `masteryCreditedStandardSeeds`, `completedStandard`, `claimedRewardKeys`, and `futurePrestige` equivalents needed by Trifold mastery.
- Use the Trifold-style product progression shape as the new canonical Cascade profile model. Existing unpublished draft saves may be discarded rather than migrated.
- Remove legacy XP/Level fields entirely from the new normalized save shape.

- [ ] Write fresh-schema tests proving a new Cascade profile initializes with the Trifold-style difficulty, mastery, coin, themes, Daily, stats, and reward-ledger fields.
- [ ] Write merge tests proving auth merge unions two current-schema profiles without duplicating coins/reward claims.
- [ ] Port Trifold mastery requirements and rank transitions exactly.
- [ ] Port `claimCoinRewardOnce` semantics against Cascade's coin field.
- [ ] Replace the unpublished legacy save shape with the new schema, bump `META_SAVE_VERSION`, and intentionally treat older draft saves as resettable/unsupported.
- [ ] Run save/merge/mastery/economy tests and full suite.
- [ ] Commit: `feat: add mastery progression to cascade profile`

---

### Task 3: Replace adaptive standard difficulty with player-selected difficulty

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/scenes/BootScene.ts`
- Create: `src/game/model/StandardDealPicker.ts`
- Deprecate/remove runtime use: `src/game/model/StandardDifficultyDirector.ts`
- Modify: `src/meta/MetaOperations.ts`
- Test: `tests/deal-difficulty.test.mjs`
- Create: `tests/standard-deal-picker.test.ts`
- Modify: `tests/first-run-startup-wiring.test.ts`

**Interfaces:**
- `pickStandardDeal(catalog, profile, entropy): StandardSelection`
- New players use the verified `onboarding` pool until the onboarding threshold is met.
- After onboarding, the selected `easy | medium | hard` pool is used exactly; no adaptive random weighting or failure-streak softening.
- Recent-seed avoidance remains intact.

- [ ] Write failing tests for explicit selected difficulty and onboarding behavior.
- [ ] Extract the seed-avoidance logic into `StandardDealPicker` and remove weighting/softening from the active path.
- [ ] Make Home-selected difficulty persist immediately.
- [ ] Ensure current active deals resume at their original tier regardless of later selector changes.
- [ ] Run focused deal tests and full suite.
- [ ] Commit: `feat: use player selected standard difficulty`

---

### Task 4: Port Trifold reward settlement semantics into Cascade

**Files:**
- Create: `src/meta/standard/StandardWinSettlement.ts`
- Create: `src/meta/daily/DailyWinSettlement.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/meta/Economy.ts`
- Modify: `src/meta/MetaOperations.ts`
- Modify: `src/game/view/RewardSummaryView.ts`
- Test: `tests/standard-win-settlement.test.ts`
- Test: `tests/daily-win-settlement.test.ts`
- Modify: `tests/economy.test.ts`

**Interfaces:**
- Standard first-completion coins: easy 5, medium 7, hard 10.
- Daily first-completion coins: 15 on-time, 5 archive.
- Mastery-eligible wins update rank progress and can issue rank rewards.
- Replaying the same seed/date grants no duplicate base or mastery reward.
- XP fields are no longer increased by new completions.

- [ ] Write failing settlement tests copied/adapted from Trifold.
- [ ] Implement standard settlement using Cascade attempt IDs and verified seed strings.
- [ ] Implement daily settlement using Cascade date IDs and existing Daily records.
- [ ] Replace `awardLines()` calls in win paths with the new settlement functions.
- [ ] Update reward summary UI to show coins/rank advancement only; remove Level/XP copy.
- [ ] Run focused settlement tests and full suite.
- [ ] Commit: `feat: port trifold coin and mastery rewards`

---

### Task 5: Build the new Cascade Home from Trifold HomeScene

**Files:**
- Copy/adapt: `src/ui/home/HomeViewModel.ts`
- Copy/adapt: `src/ui/scenes/HomeScene.ts`
- Create: `src/ui/navigation/CascadeNavigationController.ts`
- Create: `src/ui/navigation/CascadeUiRoute.ts`
- Create: `src/ui/bridge/CascadeProductBridge.ts`
- Modify: `src/main.ts`
- Modify: `src/game/scenes/BootScene.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/localization/Localization.ts`
- Modify: `src/localization/English.ts`
- Test: `tests/home-view-model.test.ts`
- Test: `tests/home-scene-contract.test.ts`
- Test: `tests/home-layout.test.ts`
- Test: `tests/main-menu-wiring.test.ts`

**Interfaces:**
- Home layout is structurally identical to Trifold: brand area, utility bar, hero Continue/Play card, difficulty segmented control, New Deal action, Daily/Mastery/Themes cards.
- `CascadeProductBridge` exposes only product actions needed by UI scenes: `resumeStandard()`, `startStandard(difficulty)`, `openDaily()`, `openExistingThemes()`, `openExistingLeaderboards()`, `openExistingHowToPlay()`, `openExistingSettings()`.
- The table scene remains the owner of actual Cascade game state.
- Opening Home from an active table pauses gameplay using the already-fixed menu pause/lifecycle logic; returning resumes the same deal.

- [ ] Port Home view-model tests and adapt them to Cascade's new save/mastery fields.
- [ ] Port Home scene/layout code with CASCADE branding and Cascade artwork keys.
- [ ] Keep desktop/mobile positions from Trifold unless Cascade-specific safe-area constraints require a measured adjustment.
- [ ] Replace old Home entry (`AppShellView` + `PlayPageView`) with `HomeScene` as the default product hub.
- [ ] Route Continue/New Deal/Difficulty through `CascadeProductBridge` into existing `GameScene` behavior.
- [ ] Route Daily/Themes/Leaderboards/HowToPlay/Settings to existing Cascade implementations for Phase 1 so no feature disappears before its screen is transplanted.
- [ ] Add RU/EN strings for the new Home and remove user-facing XP/Level strings from the Home path.
- [ ] Run Home/navigation tests and full suite.
- [ ] Commit: `feat: replace cascade home with trifold shell`

---

### Task 6: Add Phase-1 Mastery destination so Home has no dead card

**Files:**
- Copy/adapt: `src/ui/mastery/MasteryViewModel.ts`
- Copy/adapt: `src/ui/scenes/MasteryScene.ts`
- Modify: `src/ui/navigation/CascadeNavigationController.ts`
- Modify: `src/ui/home/HomeViewModel.ts`
- Test: `tests/mastery-view-model.test.ts`
- Test: `tests/mastery-scene-contract.test.ts`

**Interfaces:**
- Home Mastery card opens a real Mastery screen copied from Trifold.
- Mastery screen displays current rank, current-stage requirements, progress meter, next rank, and rank coin reward.
- Artwork uses copied Trifold rank SVGs temporarily through semantic asset keys; replacement art is a later visual-only task.

- [ ] Port Mastery view-model tests.
- [ ] Port Mastery scene with Cascade localization/import paths only.
- [ ] Wire Home → Mastery → Back navigation.
- [ ] Run mastery UI tests and full suite.
- [ ] Commit: `feat: add cascade mastery screen`

---

### Task 7: Phase-1 acceptance and cleanup

**Files:**
- Modify/delete only if unused: `src/game/view/AppShellView.ts`, `src/game/view/PlayPageView.ts`, related old Home-only CSS/tests.
- Keep existing Statistics/Collection/Rules/Settings views until later phases.
- Update: `README.md` or project notes with the new product architecture.

**Acceptance:**
- Desktop Home visually follows Trifold geometry one-for-one.
- Mobile landscape Home follows Trifold geometry one-for-one and fits without scroll at the project's supported mobile viewport.
- Continue resumes the same Cascade deal.
- New Deal remains directly accessible.
- Easy/Medium/Hard selection persists and determines the next verified pool.
- Daily/Themes/Leaderboards/Rules/Settings remain reachable.
- Mastery is real, not decorative; eligible wins advance it and rank-ups grant coins once.
- No new completion grants XP or Level rewards.
- Yandex integration, ads, auth flow, leaderboard behavior, and active gameplay remain functional. Old unpublished local/cloud progress is allowed to reset; no legacy save migration is required.
- The Cascade gameplay table itself is visually and mechanically unchanged in Phase 1.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Manually verify desktop: first run, Home, Continue, New Deal, all three difficulties, Mastery, every utility route, return to active deal.
- [ ] Manually verify mobile landscape at the production Yandex viewport and one narrow viewport.
- [ ] Verify Yandex debug panel lifecycle while entering/leaving Home and opening an active deal.
- [ ] Commit: `chore: complete phase one product shell migration`

## Expanded scope approved during execution

The user explicitly expanded Phase 1 after the original plan was written. The following are now included in this phase and should visually follow Trifold as closely as possible:

- Full Daily calendar/archive scene and active-Daily replacement modal.
- Full Themes/Collection screen and rewarded-coin entry point.
- Leaderboards, Settings, and How-to-Play product screens.
- Shared Trifold-style victory overlay and rewarded `×2` Standard coin action.
- Trifold-style in-table New Deal confirmation modal.
- Removal of obsolete XP/Level and adaptive-difficulty code because the game is unpublished and legacy save compatibility is not required.

Still excluded: visual/mechanical changes to the actual Cascade card table/HUD. The approved solid-green table concept is the next phase after this product-shell acceptance.
