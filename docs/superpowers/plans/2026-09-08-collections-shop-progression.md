# Collections, shop and progression implementation plan

> For agentic workers: use superpowers:subagent-driven-development; independent UI work runs alongside pure domain and scene integration.

**Goal:** Ship extensible theme collection/shop, persistent rewards and player level in the former weekly footer.
**Architecture:** Pure economy rules and published catalog feed DOM views. A durable local operation journal replays meta mutations against loaded cloud data, using stable receipts to prevent duplicate completion rewards. GameScene coordinates gameplay events and rendering only.
**Tech Stack:** Existing TypeScript, Phaser, DOM/CSS, node:test, Vite.
**Spec:** ../specs/2026-09-08-collections-shop-progression-design.md (approved by user, with level bar replacing weekly footer).

## Global constraints
- Free walnut_study; navy_study and burgundy_club each 300 coins; new themes require catalog data only.
- Standard 100 XP/25 coins; Classic 120/30; Daily first completion 150/75; trusted UTC first win +50/+30; level +50 coins; weekly 3/5/7 +75/150/250.
- Level transition costs 100 + 50*(L-1). Do not reward repeated Daily completion.
- Preserve current board, Undo, timer, local/cloud save boundaries and unpublished user theme changes.
- No-scroll pages, responsive pagination, lightweight previews. Preserve Daily weekly dots only in Daily card.
- Ruling: work in current checkout to include existing uncommitted navy assets and proxy work; do not commit unrelated edits or create a separate copy that omits them.

## Task 1: Pure catalog and economy
Files: src/meta/MetaSave.ts, src/meta/Economy.ts, src/meta/Progression.ts, src/theme/ThemeCatalog.ts, tests/economy.test.ts, tests/meta-save.test.ts.
- [x] Add behavior tests: six Standard wins earn 300 coins/600 XP; repeated receipt gives zero; insufficient balance preserves state; duplicate purchase never debits; legacy V2 equipped theme is retained and granted.
- [x] Run `node --test tests/economy.test.ts` and observe missing behavior.
- [x] Implement MetaSave V3 migration and `getLevelProgress(totalXp)`, `purchaseTheme(state,id)`, `completeRewardedAttempt(state,event)`.
- [x] Run focused domain tests and TypeScript.

## Task 2: Scalable DOM views
Files: src/game/view/ThemeCatalogView.ts, src/game/view/ThemeCatalogView.css, src/game/view/PlayPageView.ts, src/game/view/AppShellView.ts, completion views and RewardSummaryView.ts; relevant DOM tests.
- [x] Add tests for level footer state and synthetic 12-item pagination.
- [x] Implement standalone typed view inputs and callbacks; no mutation of domain state in views.
- [x] Replace weekly footer with level and XP bar, keeping the Daily card indicators.
- [x] Enable navigation, wallet in shell, collection filters, buy/equip states, loading/error/retry states, reward breakdown on both result screens.
- [x] Verify view behavior and responsive layout.

## Task 3: Durable persistence and integration
Files: src/meta/MetaJournal.ts, src/meta/MetaRepository.ts, src/meta/MetaSession.ts, src/persistence/ActiveGameSave.ts, src/game/scenes/GameScene.ts; new persistence/integration tests.
- [x] Tests: loaded state replay, failed reads do not authorize purchases, persisted operation replays exactly once after reload, failed write preserves journal, completion attempt ID survives checkpoint.
- [x] Implement journal of typed start/completion/purchase/equip operations with stable IDs and MetaSave receipts, compact after acknowledged save only.
- [x] Distinguish failed profile load from new profile; retry from UI; keep gameplay and pending rewards available.
- [x] Hook view callbacks, successful equip, lifecycle refresh and result reward summaries into scene.
- [x] Refresh trusted daily context before new Daily and validate week boundaries without changing identity of in-progress Daily.

## Task 4: Verification and review
- [x] Run all node tests and TypeScript/build; account for pre-existing proxy source assertion failure, update stale test to inspect actual extracted launch configuration if still present.
- [x] Browser smoke: purchase/equip both themes, reload, insufficient funds, double click, failed theme load, active board/Undo preservation; 1915x953, 1366x768, 844x390.
- [x] Independent code review, fix material findings, rerun affected checks.
- [x] Update CURRENT_STATE.md, TECH.md and docs/THEMES.md with actual delivered interfaces.

## Execution record
- Baseline: 368/369 tests passed; build passed. The sole failing proxy test checks literals moved to a helper in existing working changes.
- Interface audit: Task 1 produces pure state rules; Task 2 consumes its own view inputs passed by Task 3. Task 2 does not edit GameScene or meta files. Task 3 owns persistent coordination. All tasks preserve latest user assets.
- Completed 2026-09-09. Independent review findings addressed: durable completion deduplication after recent-cache pruning, malformed week normalization, strict storage acknowledgements, profile scope isolation, production preview guard and result retry refresh.
- Final verification: `pnpm test` passed 403/403; `pnpm build` passed with the existing informational chunk-size warning.
- Browser verification passed: `economy-runtime.mjs`, `economy-edgecases.mjs` and `theme-runtime.mjs`. Includes both purchases/equips, F5, live board/Undo preservation, rejected Yandex writes across F5/retry, failed reads/downloads, profile isolation, Daily repeat/date rollover and local journal failure recovery. Yandex SDK is simulated in these tests.
- Responsive screenshots checked at 1915×953, 1366×768 and 844×390. Artifacts and verification logs are in ignored `artifacts/`. Cascade dev server uses `http://127.0.0.1:5181/`; port 5173 belongs to another project. Set `CASCADE_URL` when running browser scripts against another port.
- Architecture decision: keep Phaser canvas for the interactive board and DOM for menus/results/catalog. Shared state and economy rules stay outside both renderers; GameScene coordinates their events. No second rendering system or canvas menu rewrite is needed.
