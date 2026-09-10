# Verified Deal Catalog and Hidden Difficulty Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 512-seed shared winnable pool with a proof-verified catalog of at least 50,000 Standard deals plus a unique long-horizon Daily schedule, then serve Standard deals through a hidden win-based difficulty director with loss softening and repeat avoidance.

**Architecture:** Build and verify deals entirely offline. The C++ solver emits exact proof actions with stable tableau identities; TypeScript replays those actions through the production `SolitaireGame`; verified candidates receive difficulty metrics and are partitioned into generated Standard buckets and a date-indexed Daily schedule. Runtime code only loads a compact generated catalog, selects a Standard seed through pure `StandardDifficultyDirector` logic, and persists minimal hidden director state through the existing `MetaJournal`/`MetaSession` pipeline.

**Tech Stack:** TypeScript 5.9, Node.js 22 test runner, C++20 solver, Phaser 3.90, Vite 7, existing `MetaSession`/`MetaJournal` persistence, binary uint32 runtime asset plus JSON manifest.

**Spec:** `docs/superpowers/specs/2026-09-10-verified-deal-difficulty-design.md`

## Global Constraints

- Standard release minimum: **50,000 unique verified seeds** split into `onboarding=5,000`, `easy=15,000`, `medium=17,500`, `hard=12,500`.
- Daily release minimum: **25,000 unique verified seeds**; preferred committed schedule: **36,525 UTC days** starting `2026-01-01`.
- Standard and Daily seed sets must be disjoint and every production seed must be a positive uint32.
- A seed is `VERIFIED` only after the C++ solver emits an exact solution proof and TypeScript replays that proof successfully through production `SolitaireGame` rules to `isWon === true`.
- Fast solver budget: `250_000` nodes; unresolved candidates may retry at `2_000_000` nodes. `UNDETERMINED` never enters a catalog.
- Difficulty score v1 weights: `30% solverNodes`, `25% rearrangementMoves`, `15% freeCellTouches`, `15% stockInterleaves`, `10% decisionActions`, `5% earlyProgressActions`, using population percentiles and `log1p(solverNodes)` before percentile ranking.
- Standard uses hidden difficulty only; no player-facing difficulty selector or difficulty label is added.
- Standard onboarding remains active until the **third Standard win**, not third attempt.
- Standard base probabilities after onboarding are exactly the table in the approved spec; at `41+` wins easy remains `25%`.
- Exactly two consecutive Standard failures soften the rolled tier one step with `70%` probability; three or more force easy until a Standard win; a Standard win resets failure streak.
- Hard may never be served twice in succession.
- Standard avoids the most recent **256 served seeds**.
- A failure is recorded only when a started, unfinished Standard attempt is deliberately replaced by another deal or mode. Restarting the same seed, pausing, refreshing, restoring, or opening the menu is not a failure.
- Daily is identical for all players for the same UTC date and uses the approved Monday→Sunday percentile bands. The highest 5% difficulty tail is never scheduled.
- Classic (`original`) randomness and rules remain unchanged.
- Full proofs/raw solver metrics live only under ignored `artifacts/deals/`; production ships compact seed data, manifest, and a small committed proof sample.
- Regular `pnpm test` must remain fast; full-catalog proof verification is a separate release gate.

---

## File Structure

### New production/runtime files

- `src/game/model/DealProof.ts` — game-level proof action types plus pure proof replay/verification against `SolitaireGame`.
- `src/game/model/VerifiedDealCatalog.ts` — runtime decoder and read-only catalog API; owns binary layout knowledge.
- `src/game/model/StandardDifficultyDirector.ts` — pure Standard tier/seed selection logic; no Phaser or platform dependency.
- `public/assets/deals/verified-deals.bin` — generated little-endian uint32 seed payload.
- `public/assets/deals/verified-deals-manifest.json` — generated catalog/version/count/offset/schedule metadata.
- `tests/fixtures/deals/verified-proof-sample.json` — committed 64–128 proof fixtures spanning every Standard tier and all seven Daily weekday bands.

### New development tooling

- `tools/deals/build-solver.mjs` — portable C++ compiler discovery/build wrapper.
- `tools/deals/solver-client.mjs` — spawn/parse one proof-producing solver invocation.
- `tools/deals/verify-proof.mjs` — CLI wrapper around production TypeScript proof replay.
- `tools/deals/difficulty.mjs` — metric aggregation, percentile calculation, v1 composite score, onboarding eligibility.
- `tools/deals/catalog-format.mjs` — deterministic binary/manifest writer and integrity checks.
- `tools/deals/daily-schedule.mjs` — deterministic UTC schedule assignment by weekday percentile band.
- `tools/deals/generate.mjs` — resumable two-range candidate scan, two-pass solve/verify, quota filling, checkpoints, final asset emission.
- `tools/deals/verify-all.mjs` — release gate that proof-verifies every production catalog seed against current rules.
- `tools/deals/report.mjs` — human-readable catalog counts/difficulty/rejection summary.

### Existing files modified

- `tools/sawayama_solver.cpp` — stable tableau identity, proof path reconstruction, explicit normalized foundation actions, structured JSON output.
- `src/game/model/GameSession.ts` — explicit verified Standard/Daily start paths; remove generic shared winnable-pool selection.
- `src/game/model/GameFlow.ts` — accept externally selected verified Standard seed while Classic still selects random internally.
- `src/game/scenes/BootScene.ts` — preload binary catalog + manifest and register decoded `VerifiedDealCatalog`.
- `src/game/scenes/GameScene.ts` — orchestration only: call director, dispatch served/failure/win meta operations, pass selected seed into flow.
- `src/meta/DailyCalendar.ts` — date-offset lookup in generated Daily schedule; remove hashing into shared pool.
- `src/meta/MetaSave.ts` — migrate V3→V4, add `standardDifficulty`, bump Daily algorithm to 2.
- `src/meta/MetaOperations.ts` — journaled `standard-served`, `standard-failed`, and win-reset effects.
- `src/meta/MetaJournal.ts` — validate the new operation shapes when restoring pending operations.
- `src/persistence/ActiveGameSave.ts` — retain Daily algorithm-version restore guard and expose enough state to distinguish same-seed restart from replacement; no difficulty duplication.
- `package.json` — replace old `generate:winnable-pool` with stable deal-factory commands.
- `.gitignore` — keep `artifacts/` ignored; no production catalog path ignored.
- `CURRENT_STATE.md`, `TECH.md` — document generated-catalog workflow and runtime director responsibilities.

---

### Task 1: Add production proof action contract and TypeScript verifier

**Files:**
- Create: `src/game/model/DealProof.ts`
- Create: `tests/deal-proof-verifier.test.ts`

**Interfaces:**
- Produces:

```ts
export type DealProofSource =
  | { readonly zone: 'tableau'; readonly pile: number }
  | { readonly zone: 'waste' }
  | { readonly zone: 'free' };

export type DealProofAction =
  | { readonly kind: 'draw'; readonly cardIds: readonly string[] }
  | { readonly kind: 'tableau-to-tableau'; readonly sourcePile: number; readonly startCardId: string; readonly destinationPile: number }
  | { readonly kind: 'waste-to-tableau'; readonly cardId: string; readonly destinationPile: number }
  | { readonly kind: 'free-to-tableau'; readonly cardId: string; readonly destinationPile: number }
  | { readonly kind: 'to-free'; readonly source: Exclude<DealProofSource, { readonly zone: 'free' }>; readonly cardId: string }
  | { readonly kind: 'to-foundation'; readonly source: DealProofSource; readonly cardId: string; readonly suit: Suit; readonly automatic?: true };

export interface DealProofVerification {
  readonly seed: bigint;
  readonly actionCount: number;
  readonly foundationCount: number;
}

export function replayDealProof(deal: Deal, actions: readonly DealProofAction[]): DealProofVerification;
export function verifySeedProof(seed: bigint, actions: readonly DealProofAction[]): DealProofVerification;
```

- `verifySeedProof()` must create `createDealForMode('winnable', seed)` and call `replayDealProof()`.
- Every failure message includes both seed and zero-based action index.

- [ ] **Step 1: Write failing verifier tests**

Use a synthetic near-win `Deal` with 51 cards already in foundations and the remaining king exposed on tableau so the test does not depend on solver output yet. Build it from canonical cards:

```ts
function createNearWinDeal(): Deal {
  const deck = createDeck();
  const byId = new Map(deck.map((card) => [card.id, card]));
  const pile = (suit: Suit, throughRank: number) =>
    Array.from({ length: throughRank }, (_, index) => byId.get(`${suit}-${index + 1}`)!);

  return {
    seed: 1n,
    mode: 'winnable',
    tableau: [[byId.get('spades-13')!], [], [], [], [], [], []],
    stock: [],
    waste: [],
    freeCell: null,
    foundations: {
      clubs: pile('clubs', 13),
      diamonds: pile('diamonds', 13),
      hearts: pile('hearts', 13),
      spades: pile('spades', 12),
    },
  };
}

const nearWinDeal = createNearWinDeal();
const verification = replayDealProof(nearWinDeal, [{
  kind: 'to-foundation',
  source: { zone: 'tableau', pile: 0 },
  cardId: 'spades-13',
  suit: 'spades',
}]);
assert.equal(verification.foundationCount, 52);

assert.throws(
  () => replayDealProof(nearWinDeal, [{ kind: 'draw', cardIds: ['clubs-2'] }]),
  /seed=.*action=0.*draw/iu,
);
```

Also assert after each action that exactly 52 unique card IDs exist across tableau, stock, waste, free cell, and foundations.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/deal-proof-verifier.test.ts
```

Expected: FAIL because `src/game/model/DealProof.ts` does not exist.

- [ ] **Step 3: Implement the minimal replay engine**

Resolve tableau indices by `startCardId`, verify exposed waste/free cards before moves, call only public `SolitaireGame` methods, compare `draw()` card IDs exactly, and reject any action whose requested move returns `false`. After the final action require `game.isWon === true` and `game.foundationCount === 52`.

- [ ] **Step 4: Run focused and model regression tests**

```bash
node --test tests/deal-proof-verifier.test.ts tests/game.test.ts tests/deal-original.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/model/DealProof.ts tests/deal-proof-verifier.test.ts
git commit -m "feat: add production deal proof verifier"
```

---

### Task 2: Make the C++ solver emit replayable exact proofs

**Files:**
- Modify: `tools/sawayama_solver.cpp`
- Create: `tests/deal-solver-proof-format.test.mjs`

**Interfaces:**
- Solver single-seed command:

```text
tools/sawayama_solver --seed 123 --budget 250000 --proof-json
```

- Successful stdout is one JSON object:

```json
{"status":"SOLVED","seed":123,"nodes":9876,"proof":[{"kind":"draw","cardIds":["clubs-4","hearts-9","spades-2"]}]}
```

- Unsolvable/undetermined output uses the same object shape without `proof` and exits `3` / `4` respectively.
- Card IDs must use the production convention `${suit}-${rank}` with suit names `clubs|diamonds|hearts|spades`.

- [ ] **Step 1: Write a failing CLI-format regression test**

`tests/deal-solver-proof-format.test.mjs` invokes an already-built solver path from `CASCADE_SOLVER` when present; when not present it uses `tools/sawayama_solver.exe` on Windows or `tools/sawayama_solver` elsewhere. The test asserts that a known solved seed returns JSON with `status`, numeric `seed`, numeric `nodes`, a non-empty `proof`, and only the six approved action kinds.

Run with a deliberately unmodified solver first:

```bash
node --test tests/deal-solver-proof-format.test.mjs
```

Expected: FAIL because current solver prints text, not proof JSON.

- [ ] **Step 2: Add stable tableau identity**

Replace `State::columns` element type with:

```cpp
struct Column {
  std::vector<Card> cards;
  std::uint8_t stable_pile_id;
};
```

Initialize `stable_pile_id` to `0..6` in `create_deal()`. Canonical sorting reorders full `Column` values but `state_hash()` hashes only `column.cards`, deliberately ignoring `stable_pile_id`.

- [ ] **Step 3: Carry proof edges through search**

Introduce a parent-linked proof chain so the 250k/2M-node search does not copy an ever-growing vector for every child:

```cpp
enum class ProofKind { draw, tableau_to_tableau, waste_to_tableau, free_to_tableau, to_free, to_foundation };
enum class ProofZone { none, tableau, waste, free_cell };
struct ProofAction {
  ProofKind kind;
  ProofZone source_zone = ProofZone::none;
  std::uint8_t source_pile = 255;
  std::uint8_t destination_pile = 255;
  Card card = NO_CARD;
  std::array<Card, 3> drawn{NO_CARD, NO_CARD, NO_CARD};
  std::uint8_t drawn_count = 0;
  bool automatic = false;
};
struct PathNode {
  std::shared_ptr<const PathNode> previous;
  std::vector<ProofAction> edge_actions;
};
struct SearchNode { State state; std::shared_ptr<const PathNode> path; };
struct Child { State state; std::vector<ProofAction> actions; };
```

Each child creates one `PathNode` pointing at its parent path. On victory, unwind the chain once and reverse the edge groups to build stdout JSON. Every manual child records its explicit action. `normalize()` returns the ordered list of safe foundation actions it performed, and `add_child()` appends those normalization actions after the triggering action. Initial-state normalization actions are prepended to the root proof.

For tableau moves, emitted source/destination values are `stable_pile_id`, never current canonical-array indices.

- [ ] **Step 4: Serialize exact card IDs and verify CLI output**

Add `--proof-json` parsing and deterministic JSON serialization with no logging on stdout other than the JSON object. Progress/debug messages remain on stderr.

Run:

```bash
node --test tests/deal-solver-proof-format.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/sawayama_solver.cpp tests/deal-solver-proof-format.test.mjs
git commit -m "feat: emit replayable solver proofs"
```

---

### Task 3: Add portable solver build wrapper and proof client

**Files:**
- Create: `tools/deals/build-solver.mjs`
- Create: `tools/deals/solver-client.mjs`
- Create: `tests/deal-tooling.test.mjs`
- Modify: `package.json`

**Interfaces:**

```js
export function resolveCompiler(env, platform, existsSync): { command: string; argsPrefix: string[] };
export function solverOutputPath(platform = process.platform): string;
export async function solveSeed({ seed, budget, solverPath }): Promise<SolverResult>;
```

Compiler precedence:
1. non-empty `CXX` environment variable;
2. on Windows, existing `D:\\msys64\\ucrt64\\bin\\g++.exe`;
3. `g++` from PATH;
4. `clang++` from PATH.

`CASCADE_SOLVER` overrides the executable used by `solver-client.mjs`.

- [ ] **Step 1: Write failing compiler-selection and parser tests**

Cover explicit `CXX`, MSYS2 Windows fallback, POSIX PATH fallback, malformed solver JSON, and solved/undetermined result parsing.

```bash
node --test tests/deal-tooling.test.mjs
```

Expected: FAIL because tooling modules do not exist.

- [ ] **Step 2: Implement compiler resolution and build command**

`build-solver.mjs` compiles with:

```text
-std=c++20 -O3 -pthread tools/sawayama_solver.cpp -o <platform output>
```

and prints the resolved compiler and output path. It exits non-zero if every compiler candidate fails.

- [ ] **Step 3: Implement structured solver client**

Use `spawn()` with argument arrays, never shell-concatenated seed/budget strings. Parse stdout JSON and return:

```js
{ status: 'SOLVED'|'UNSOLVABLE'|'UNDETERMINED', seed, nodes, proof }
```

Validate positive uint32 seed and non-negative safe-integer nodes before returning.

- [ ] **Step 4: Add package command and verify tests**

Set:

```json
"deals:build-solver": "node tools/deals/build-solver.mjs"
```

Run:

```bash
node --test tests/deal-tooling.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/build-solver.mjs tools/deals/solver-client.mjs tests/deal-tooling.test.mjs package.json
git commit -m "build: add portable deal solver tooling"
```

---

### Task 4: Build the resumable solve → TypeScript verify candidate pipeline

**Files:**
- Create: `tools/deals/verify-proof.mjs`
- Create: `tools/deals/generate.mjs`
- Create: `tests/deal-generation-resume.test.mjs`

**Interfaces:**

```js
export async function verifyProofRecord(record): Promise<{ ok: true; verification: object } | { ok: false; reason: string }>;
export function readCheckpoint(path): GenerationCheckpoint;
export function appendCandidate(path, record): void;
export async function scanRange(options): Promise<GenerationCheckpoint>;
```

Checkpoint contains source range, next seed, accepted counts, rejected verification count, and unresolved retry queue. Candidate JSONL records include seed, solver status, nodes, proof, verification result, and later difficulty metrics.

- [ ] **Step 1: Write a failing resume test**

Use a fake `solveSeed` dependency and a temporary directory. Stop after three candidates, reload checkpoint, resume, and assert the first three seeds are not solved a second time and output JSONL contains each scanned seed once.

```bash
node --test tests/deal-generation-resume.test.mjs
```

Expected: FAIL because generation pipeline does not exist.

- [ ] **Step 2: Implement proof verification bridge**

`verify-proof.mjs` imports `verifySeedProof()` from `src/game/model/DealProof.ts`. It rejects solver `SOLVED` records whose proof fails replay and returns the exact verifier error as a rejection reason.

- [ ] **Step 3: Implement two-pass resumable scanning**

For each seed:
1. call solver with `250000`;
2. if `UNDETERMINED`, retry with `2000000`;
3. if `SOLVED`, replay proof through TypeScript;
4. append accepted/rejected record immediately;
5. atomically replace checkpoint (`.tmp` then rename) after each bounded batch.

Use Standard source range beginning at `1` and Daily source range beginning at `1_000_000_001`; assert every candidate is `1..0xffffffff`.

- [ ] **Step 4: Verify resume and rejection behavior**

```bash
node --test tests/deal-generation-resume.test.mjs tests/deal-proof-verifier.test.ts
```

Expected: PASS, including a case where a syntactically valid but corrupt solver proof is rejected rather than counted.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/verify-proof.mjs tools/deals/generate.mjs tests/deal-generation-resume.test.mjs
git commit -m "feat: add resumable verified deal pipeline"
```

---

### Task 5: Score human-facing difficulty and classify verified candidates

**Files:**
- Create: `tools/deals/difficulty.mjs`
- Create: `tests/deal-difficulty.test.mjs`

**Interfaces:**

```js
export function measureProof(proof, initialStockCount): {
  decisionActions: number;
  rearrangementMoves: number;
  freeCellTouches: number;
  stockInterleaves: number;
  earlyProgressActions: number;
};
export function scorePopulation(records): ScoredDeal[];
export function isOnboardingCandidate(record): boolean;
export function partitionStandard(records, quotas): StandardPartitions;
```

`scorePopulation()` computes percentiles across the accepted population and returns `difficultyScore` in `[0,100]` using the exact v1 weights from Global Constraints.

- [ ] **Step 1: Write failing metric/percentile tests**

Build small explicit proof sequences and assert exact raw metrics. Build a five-record population with monotonic metrics and assert ordering plus the weighted score calculation. Include `solverNodes` values `10`, `100`, `1000` to prove ranking uses `log1p` before percentile placement.

```bash
node --test tests/deal-difficulty.test.mjs
```

Expected: FAIL because difficulty module does not exist.

- [ ] **Step 2: Implement raw proof metrics**

Count normalization-generated `to-foundation` actions as non-decision actions only when the solver marks them with `automatic: true`; Task 1 already permits that flag and TypeScript replay semantics remain identical.

`stockInterleaves` increments for a non-draw decision occurring after at least one draw while cumulative drawn-card count is still below `initialStockCount`. The factory passes the actual initial stock size from `createDealForMode(...).stock.length` (24 under the current rules), so this metric is not hard-coded to a magic number.

- [ ] **Step 3: Implement percentile scoring and onboarding filter**

Use average rank for tied values. `isOnboardingCandidate()` requires all of:

```text
difficultyScore <= 20
freeCellTouches percentile <= 35
rearrangementMoves percentile <= 35
earlyProgressActions percentile <= 25
```

These are generation filters, not runtime rules. If fewer than 5,000 onboarding candidates are found, generation continues scanning; it never widens verification criteria.

- [ ] **Step 4: Implement deterministic Standard partitioning and verify**

Score the Standard candidate population independently from the Daily candidate population. Exclude candidates above the 95th percentile before filling Standard. Select the first 5,000 onboarding-eligible candidates by `(difficultyScore, seed)`, remove them, sort the remaining eligible candidates by `(difficultyScore, seed)`, then take the lowest 15,000 as `easy`, the next 17,500 as `medium`, and the next 12,500 as `hard`. If any quota cannot be filled, generation continues scanning instead of weakening filters. Assert no duplicate seed across partitions.

```bash
node --test tests/deal-difficulty.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/difficulty.mjs tests/deal-difficulty.test.mjs tools/sawayama_solver.cpp src/game/model/DealProof.ts
git commit -m "feat: score verified deal difficulty"
```

---

### Task 6: Generate deterministic Monday→Sunday Daily schedule

**Files:**
- Create: `tools/deals/daily-schedule.mjs`
- Create: `tests/daily-schedule-generator.test.mjs`

**Interfaces:**

```js
export const DAILY_BANDS = Object.freeze({
  1: [0, 15], 2: [10, 30], 3: [25, 45], 4: [40, 60],
  5: [55, 72], 6: [68, 85], 0: [80, 95],
});
export function generateDailySchedule(records, {
  startDailyId: '2026-01-01',
  length: 36525,
  shuffleSeed: 0x43415343,
}): DailyScheduleRecord[];
```

Each output row is `{ dailyId, seed, difficultyScore }` during generation. Production output later stores only seed order plus manifest start/length.

- [ ] **Step 1: Write failing schedule tests**

Provide synthetic candidates covering score 0..99, generate several weeks, and assert:
- same input + shuffle seed gives byte-for-byte same schedule;
- every date uses the correct UTC weekday band;
- no seed repeats;
- no selected score exceeds 95;
- insufficient candidates throws with weekday/date context.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/daily-schedule-generator.test.mjs
```

Expected: FAIL because generator does not exist.

- [ ] **Step 3: Implement deterministic band queues**

Create one deterministic shuffled candidate queue per weekday band, remove a seed globally as soon as it is assigned, walk dates by UTC day offset, and never fall back outside the approved band.

- [ ] **Step 4: Verify GREEN**

```bash
node --test tests/daily-schedule-generator.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/daily-schedule.mjs tests/daily-schedule-generator.test.mjs
git commit -m "feat: generate weekday-scaled daily schedule"
```

---

### Task 7: Define compact production catalog format and runtime loader

**Files:**
- Create: `tools/deals/catalog-format.mjs`
- Create: `src/game/model/VerifiedDealCatalog.ts`
- Create: `tests/verified-deal-catalog.test.ts`
- Create after generation: `public/assets/deals/verified-deals.bin`
- Create after generation: `public/assets/deals/verified-deals-manifest.json`

**Interfaces:**

Binary layout is deliberately simple: a flat little-endian uint32 sequence in this exact order:

```text
onboarding seeds
 easy seeds
 medium seeds
 hard seeds
 daily schedule seeds (one uint32 per UTC day)
```

Manifest contains byte offsets/counts for each segment and all audit fields from spec section 16.

Runtime API:

```ts
export type StandardTier = 'onboarding' | 'easy' | 'medium' | 'hard';

export interface VerifiedDealManifest {
  readonly catalogVersion: number;
  readonly difficultyModelVersion: 1;
  readonly dailyAlgorithmVersion: 2;
  readonly solverSourceHash: string;
  readonly gameRulesSourceHash: string;
  readonly standardCounts: Readonly<Record<StandardTier, number>>;
  readonly dailyScheduleStart: string;
  readonly dailyScheduleLength: number;
  readonly fastNodeBudget: 250000;
  readonly slowNodeBudget: 2000000;
  readonly verifiedCount: number;
  readonly rejectedVerificationCount: number;
  readonly crossPoolDuplicateCount: 0;
  readonly productionAssetHash: string;
  readonly offsets: Readonly<Record<StandardTier | 'daily', { readonly byteOffset: number; readonly count: number }>>;
}

export class VerifiedDealCatalog {
  static decode(buffer: ArrayBuffer, manifest: unknown): VerifiedDealCatalog;
  getStandardSeeds(tier: StandardTier): readonly bigint[];
  hasStandardSeed(seed: bigint): boolean;
  getDailySeedByOffset(dayOffset: number): bigint;
  hasDailySeed(seed: bigint): boolean;
  get metadata(): VerifiedDealManifest;
}
```

- [ ] **Step 1: Write failing binary decoder integrity tests**

Create an in-memory tiny binary with known uint32 values. Assert exact bucket decoding, membership, daily offset lookup, duplicate rejection, Standard/Daily overlap rejection, count/offset bounds, and positive uint32 rules. Separately test the Node-side writer helper against a deliberately wrong SHA-256 so generation refuses to publish an asset whose manifest hash does not match. The browser decoder stays synchronous and does not recompute SHA-256.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/verified-deal-catalog.test.ts
```

Expected: FAIL because runtime catalog does not exist.

- [ ] **Step 3: Implement deterministic writer and decoder**

`catalog-format.mjs` writes with `Buffer.writeUInt32LE`, computes SHA-256 of the completed binary with Node `crypto`, and stores that digest as `productionAssetHash`. `VerifiedDealCatalog.decode()` validates byte lengths/offsets/counts and copies decoded seeds into frozen bigint arrays once at load time so callers cannot mutate catalog state; cryptographic hash verification remains a build/test responsibility.

- [ ] **Step 4: Verify GREEN**

```bash
node --test tests/verified-deal-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit code before the expensive production generation**

```bash
git add tools/deals/catalog-format.mjs src/game/model/VerifiedDealCatalog.ts tests/verified-deal-catalog.test.ts
git commit -m "feat: add verified deal catalog format"
```

---

### Task 8: Persist hidden Standard difficulty state in MetaSave V4

**Files:**
- Modify: `src/meta/MetaSave.ts`
- Modify: `src/meta/MetaOperations.ts`
- Modify: `src/meta/MetaJournal.ts`
- Modify: `tests/meta-save.test.ts`
- Modify: `tests/meta-journal.test.ts`
- Create: `tests/standard-difficulty-meta.test.ts`

**Interfaces:**

```ts
export interface StandardDifficultyState {
  readonly failureStreak: 0 | 1 | 2 | 3;
  readonly lastServedTier: '' | StandardTier;
  readonly recentSeeds: string[];
}

export interface MetaSaveV4 extends Omit<MetaSaveV3, 'version'> {
  readonly version: 4;
  readonly standardDifficulty: StandardDifficultyState;
}
```

New `MetaOperation` variants:

```ts
| { readonly kind: 'standard-served'; readonly seed: string; readonly tier: StandardTier }
| { readonly kind: 'standard-failed'; readonly attemptId: string }
```

A normal `complete` operation with `mode:'winnable'` resets `failureStreak` to `0`; do not add a second win operation.

- [ ] **Step 1: Write failing V3→V4 migration and operation tests**

Assert V3 saves preserve all existing stats/progression and receive:

```ts
standardDifficulty: { failureStreak: 0, lastServedTier: '', recentSeeds: [] }
```

Assert `standard-served` appends a positive uint32 seed, caps history to 256, updates tier, and does not alter win count. Assert `standard-failed` caps streak at 3. Assert a completed Standard win resets streak but Daily/Classic wins do not.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/meta-save.test.ts tests/meta-journal.test.ts tests/standard-difficulty-meta.test.ts
```

Expected: FAIL because V4 state/operations are absent.

- [ ] **Step 3: Implement V4 normalization and operations**

Set `META_SAVE_VERSION = 4`. Normalize only `1..0xffffffff` decimal seed strings, dedupe while retaining most-recent order, and keep the newest 256. Invalid tier becomes `''`; failure streak clamps to integer `0..3`.

Extend `MetaJournal.isMetaOperation()` to validate new operation shapes so pending state survives refresh safely.

- [ ] **Step 4: Verify GREEN plus existing meta suite**

```bash
node --test tests/meta-save.test.ts tests/meta-journal.test.ts tests/meta-session.test.ts tests/meta-repository.test.ts tests/standard-difficulty-meta.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta/MetaSave.ts src/meta/MetaOperations.ts src/meta/MetaJournal.ts tests/meta-save.test.ts tests/meta-journal.test.ts tests/standard-difficulty-meta.test.ts
git commit -m "feat: persist standard difficulty state"
```

---

### Task 9: Implement pure StandardDifficultyDirector

**Files:**
- Create: `src/game/model/StandardDifficultyDirector.ts`
- Create: `tests/standard-difficulty-director.test.ts`

**Interfaces:**

```ts
export interface StandardDirectorInput {
  readonly wins: number;
  readonly failureStreak: number;
  readonly lastServedTier: '' | StandardTier;
  readonly recentSeeds: readonly string[];
}

export interface StandardSelection {
  readonly tier: StandardTier;
  readonly seed: bigint;
}

export type NextEntropy = () => number; // uint32 0..0xffffffff

export class StandardDifficultyDirector {
  constructor(catalog: VerifiedDealCatalog, nextEntropy: NextEntropy);
  select(input: StandardDirectorInput): StandardSelection;
}
```

Base distributions:

```ts
0..2 wins   => onboarding 100%
3..5        => easy 85, medium 15
6..10       => easy 65, medium 35
11..20      => easy 45, medium 45, hard 10
21..40      => easy 30, medium 50, hard 20
41+         => easy 25, medium 45, hard 30
```

- [ ] **Step 1: Write exhaustive failing boundary tests**

Test wins exactly `0,2,3,5,6,10,11,20,21,40,41,100`. Inject entropy values at probability boundaries so each tier can be asserted deterministically. Also cover:
- failure streak 2 + soften entropy below/above 70%;
- failure streak 3 forcing easy;
- onboarding precedence over failure streak;
- `lastServedTier='hard'` prevents hard and normalizes easy/medium weights;
- recent-seed rejection;
- fallback progressively drops oldest history when every bucket member is recent.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/standard-difficulty-director.test.ts
```

Expected: FAIL because director does not exist.

- [ ] **Step 3: Implement pure selection logic**

Convert uint32 entropy to `[0,1)` with `value / 0x1_0000_0000`. Use one entropy draw for base tier, a second only when the two-failure soften rule is evaluated, and one or more entropy draws for seed index/retry. Never use `Math.random()` inside the director.

- [ ] **Step 4: Verify GREEN**

```bash
node --test tests/standard-difficulty-director.test.ts tests/verified-deal-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/model/StandardDifficultyDirector.ts tests/standard-difficulty-director.test.ts
git commit -m "feat: add hidden standard difficulty director"
```

---

### Task 10: Switch DailyCalendar to the generated unique schedule and algorithm version 2

**Files:**
- Modify: `src/meta/DailyCalendar.ts`
- Modify: `src/meta/MetaSave.ts`
- Modify: `tests/daily-calendar.test.ts`
- Modify: `tests/daily-restore-wiring.test.ts`
- Modify: `src/game/scenes/GameScene.ts` only for the current-version call site and restore rejection; no Standard selection yet.

**Interfaces:**

```ts
export function getDailySeed(
  dailyId: string,
  catalog: VerifiedDealCatalog,
): bigint;
```

The function converts `dailyId` to UTC midnight, subtracts manifest `dailyScheduleStart`, divides by `86_400_000`, requires an exact integer offset inside `[0, dailyScheduleLength)`, then returns `catalog.getDailySeedByOffset(offset)`.

- [ ] **Step 1: Write failing Daily schedule lookup tests**

Use a tiny fake catalog with start `2026-01-01` and three daily seeds. Assert exact date→offset mapping, deterministic same-date result, invalid date rejection, and clear errors before/after schedule bounds.

Update restore wiring expectation so a checkpoint with `daily.algorithmVersion !== DAILY_ALGORITHM_VERSION` is not resumed as the current Daily.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/daily-calendar.test.ts tests/daily-restore-wiring.test.ts
```

Expected: FAIL because current code hashes into `WINNABLE_SEEDS` and algorithm version is 1.

- [ ] **Step 3: Replace hash selection and bump version**

Set `DAILY_ALGORITHM_VERSION = 2`. For new Daily starts always use the code constant/current catalog version, not the stale `metaState.daily.algorithmVersion` from a migrated profile. Preserve historical Daily records.

- [ ] **Step 4: Verify GREEN**

```bash
node --test tests/daily-calendar.test.ts tests/daily-progress.test.ts tests/daily-restore-wiring.test.ts tests/daily-scene-wiring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta/DailyCalendar.ts src/meta/MetaSave.ts src/game/scenes/GameScene.ts tests/daily-calendar.test.ts tests/daily-restore-wiring.test.ts
git commit -m "feat: serve daily deals from verified schedule"
```

---

### Task 11: Load the catalog at boot and make GameSession use explicit verified starts

**Files:**
- Modify: `src/game/scenes/BootScene.ts`
- Modify: `src/game/model/GameSession.ts`
- Modify: `src/game/model/GameFlow.ts`
- Modify: `tests/game-session.test.ts`
- Create: `tests/game-flow-verified-seeds.test.ts`
- Create: `tests/verified-catalog-boot-wiring.test.mjs`

**Interfaces:**

Boot keys:

```ts
const VERIFIED_DEALS_BINARY_KEY = 'verified-deals-binary';
const VERIFIED_DEALS_MANIFEST_KEY = 'verified-deals-manifest';
const VERIFIED_DEALS_REGISTRY_KEY = 'verified-deal-catalog';
```

`BootScene.preload()` loads:

```ts
this.load.binary(VERIFIED_DEALS_BINARY_KEY, './assets/deals/verified-deals.bin');
this.load.json(VERIFIED_DEALS_MANIFEST_KEY, './assets/deals/verified-deals-manifest.json');
```

`BootScene.create()` decodes and stores the catalog in Phaser registry before starting `GameScene`.

`GameSession` becomes:

```ts
constructor(options: { nextSeed?: () => bigint; catalog: VerifiedDealCatalog });
startOriginal(): Deal;
startStandard(seed: bigint): Deal;
startDaily(seed: bigint): Deal;
```

`startStandard()` requires `catalog.hasStandardSeed(seed)`. `startDaily()` requires `catalog.hasDailySeed(seed)`. `restart()` preserves the active seed and mode without revalidation/selection.

- [ ] **Step 1: Write failing explicit-start tests**

Assert Standard rejects Daily-only seed, Daily rejects Standard-only seed, Classic still avoids immediate random repeat, and restart preserves exact verified Standard/Daily seed.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/game-session.test.ts tests/verified-catalog-boot-wiring.test.mjs
```

Expected: FAIL because session still owns `WINNABLE_SEEDS` and boot does not load catalog assets.

- [ ] **Step 3: Refactor GameSession/GameFlow without changing Classic behavior**

Remove imports of `WINNABLE_SEEDS`. `GameFlow.playSelectedMode()` accepts a seed for Standard/Daily and uses `startOriginal()` only for Classic. `startNewInCurrentMode()` accepts a new Standard seed when current mode is Standard, restarts fixed seed for Daily, and creates a fresh random Classic deal for Classic.

- [ ] **Step 4: Add boot decoding and verify focused suite**

```bash
node --test tests/game-session.test.ts tests/game-flow-verified-seeds.test.ts tests/verified-catalog-boot-wiring.test.mjs tests/game-bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/BootScene.ts src/game/model/GameSession.ts src/game/model/GameFlow.ts tests/game-session.test.ts tests/game-flow-verified-seeds.test.ts tests/verified-catalog-boot-wiring.test.mjs
git commit -m "refactor: use explicit verified deal starts"
```

---

### Task 12: Orchestrate Standard serving, abandonment, restart, and win reset in GameScene

**Files:**
- Create: `src/game/model/StandardAttemptPolicy.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Create: `tests/standard-attempt-policy.test.ts`
- Create: `tests/standard-difficulty-scene-wiring.test.ts`
- Modify: `tests/session-persistence-wiring.test.ts`
- Modify: `tests/ordinary-stats-wiring.test.ts`

**Interfaces:**

A pure policy helper prevents Phaser code from defining failure semantics:

```ts
export function shouldRecordStandardFailure(input: {
  readonly currentMode: GameMode | null;
  readonly currentSeed: bigint | null;
  readonly replacementMode: GameMode;
  readonly replacementSeed: bigint | null;
  readonly attemptStarted: boolean;
  readonly attemptFinalized: boolean;
}): boolean;
```

`GameScene` reads the catalog from Phaser registry, owns one `StandardDifficultyDirector`, and has orchestration helpers:

```ts
private selectStandardDeal(): { readonly seed: bigint; readonly tier: StandardTier };
private recordStandardFailureIfReplacing(replacementMode: GameMode, replacementSeed: bigint | null): void;
private startSelectedMode(mode: GameMode): Deal;
```

Selection input comes only from:

```ts
{
  wins: this.metaState.stats.winnable.wins,
  failureStreak: this.metaState.standardDifficulty.failureStreak,
  lastServedTier: this.metaState.standardDifficulty.lastServedTier,
  recentSeeds: this.metaState.standardDifficulty.recentSeeds,
}
```

- [ ] **Step 1: Write failing orchestration tests**

First unit-test `shouldRecordStandardFailure()` with current Standard + started + unfinished + different seed/mode returning true, and same-seed restart/menu-style no-replacement cases returning false. Then assert scene wiring guarantees:
- entering Standard calls director then `standard-served` before/when the deal is started;
- pressing New Deal after at least one move in unfinished Standard dispatches `standard-failed`, then selects the next deal from updated meta state;
- switching from a started unfinished Standard game to Classic/Daily dispatches exactly one failure;
- restart calls `flow.restart()` only and dispatches neither `standard-served` nor `standard-failed`;
- opening/closing menu and checkpoint restore dispatch neither failure nor served event;
- completing Standard resets streak through the existing `complete` operation.

Prefer behavior tests around extracted pure orchestration helpers if direct Phaser construction is expensive; source-wiring assertions may supplement but must not be the only coverage.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/standard-attempt-policy.test.ts tests/standard-difficulty-scene-wiring.test.ts tests/session-persistence-wiring.test.ts tests/ordinary-stats-wiring.test.ts
```

Expected: FAIL because GameScene does not use the director/meta operations.

- [ ] **Step 3: Implement orchestration only**

Implement `StandardAttemptPolicy.ts` first, then have GameScene call it. Create director entropy from `createRandomDealSeed()` low uint32 bits. Before replacing a started unfinished Standard deal, dispatch `standard-failed` and refresh meta state. Then select from the director, dispatch `standard-served`, and pass the selected seed to `GameFlow`. If journal append fails, still start the selected deal but surface the existing save-error UI; never silently substitute an unverified seed.

- [ ] **Step 4: Verify GREEN and regression behavior**

```bash
node --test tests/standard-attempt-policy.test.ts tests/standard-difficulty-scene-wiring.test.ts tests/session-persistence-wiring.test.ts tests/ordinary-stats-wiring.test.ts tests/game-session.test.ts tests/meta-session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/model/StandardAttemptPolicy.ts src/game/scenes/GameScene.ts tests/standard-attempt-policy.test.ts tests/standard-difficulty-scene-wiring.test.ts tests/session-persistence-wiring.test.ts tests/ordinary-stats-wiring.test.ts
git commit -m "feat: apply adaptive standard deal selection"
```

---

### Task 13: Emit committed proof sample and full generation/report/release commands

**Files:**
- Modify: `tools/deals/generate.mjs`
- Create: `tools/deals/verify-all.mjs`
- Create: `tools/deals/report.mjs`
- Create: `tests/verified-proof-sample.test.ts`
- Create generated: `tests/fixtures/deals/verified-proof-sample.json`
- Modify: `package.json`
- Modify: `CURRENT_STATE.md`
- Modify: `TECH.md`

**Interfaces:**

Stable commands:

```json
"deals:build-solver": "node tools/deals/build-solver.mjs",
"deals:generate": "node tools/deals/generate.mjs",
"deals:verify-sample": "node --test tests/verified-proof-sample.test.ts",
"deals:verify-all": "node tools/deals/verify-all.mjs",
"deals:report": "node tools/deals/report.mjs"
```

`verified-proof-sample.json` contains 64–128 full proofs chosen deterministically across `onboarding/easy/medium/hard` and all seven Daily weekday bands.

- [ ] **Step 1: Write failing committed-sample test**

The test loads the fixture, asserts required category/day coverage, then calls `verifySeedProof(BigInt(seed), proof)` for every fixture. Create one intentionally corrupt temporary copy in the test and assert it fails with seed/action context.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/verified-proof-sample.test.ts
```

Expected: FAIL because fixture/release tooling is absent.

- [ ] **Step 3: Implement final generation emission**

`deals:generate` only writes `public/assets/deals/verified-deals.bin`, manifest, and committed proof sample after all quotas/invariants pass. It first writes temporary files, validates hashes/counts/no-overlap/no-duplicate/day bands, then atomically renames them. Raw candidate/proof JSONL remains under `artifacts/deals/`.

- [ ] **Step 4: Implement full verifier and report**

`deals:verify-all` reads the production catalog, re-runs the current proof-producing solver for every production seed (parallel workers, `2_000_000` node ceiling), then replays each freshly reconstructed proof through current `SolitaireGame`. It exits non-zero on the first unsolved/undetermined/replay-failed seed with seed/action context. This makes the release gate independent of ignored `artifacts/deals/` files. `deals:report` prints counts, scan ranges, solved/unsolvable/undetermined/rejected totals, score percentiles, Standard bucket counts, Daily schedule span, and cross-pool duplicates.

- [ ] **Step 5: Verify tooling tests and commit code**

```bash
pnpm test
```

Expected: PASS after a small smoke catalog fixture has been generated.

```bash
git add tools/deals package.json tests/verified-proof-sample.test.ts tests/fixtures/deals CURRENT_STATE.md TECH.md
git commit -m "build: add verified deal generation gates"
```

---

### Task 14: Generate and verify the release-size catalog

**Files:**
- Generate/replace: `public/assets/deals/verified-deals.bin`
- Generate/replace: `public/assets/deals/verified-deals-manifest.json`
- Generate/replace: `tests/fixtures/deals/verified-proof-sample.json`
- Development-only ignored: `artifacts/deals/**`

**Interfaces:**
- No new runtime APIs. This task produces the production data consumed by prior tasks.

- [ ] **Step 1: Build the solver**

```bash
pnpm deals:build-solver
```

Expected: exit 0 and a solver executable path printed.

- [ ] **Step 2: Run resumable production generation**

```bash
pnpm deals:generate -- --standard-total 50000 --daily-days 36525 --jobs 4
```

Expected final invariants printed by the command:

```text
standard onboarding=5000 easy=15000 medium=17500 hard=12500 total=50000
daily length=36525 start=2026-01-01
crossPoolDuplicates=0
rejectedVerification>=0
status=READY_TO_SHIP
```

If generation is interrupted, rerun the same command and confirm it resumes from checkpoint rather than rescanning accepted seeds.

- [ ] **Step 3: Run the full proof replay release gate**

```bash
pnpm deals:verify-all
```

Expected: all `50,000 + 36,525 = 86,525` production seeds are freshly solved by the current C++ solver and each reconstructed proof replays to `SolitaireGame.isWon === true`; exit 0.

- [ ] **Step 4: Run report and inspect exact quotas/bands**

```bash
pnpm deals:report
```

Expected: exact Standard quotas, 36,525 unique Daily dates/seeds, zero Standard/Daily overlap, Monday→Sunday score-band compliance, no Daily score above 95th percentile.

- [ ] **Step 5: Commit generated production assets**

```bash
git add public/assets/deals/verified-deals.bin public/assets/deals/verified-deals-manifest.json tests/fixtures/deals/verified-proof-sample.json
git commit -m "data: ship verified standard and daily deals"
```

Do not add `artifacts/deals/`.

---

### Task 15: Remove the legacy 512-seed pool and run full regression/release checks

**Files:**
- Delete: `src/game/model/winnableSeeds.ts`
- Modify: `tests/winnable-pool.test.ts` into catalog-integrity coverage or delete it after equivalent assertions live in `tests/verified-deal-catalog.test.ts`.
- Modify: `package.json` to remove `generate:winnable-pool`.

**Interfaces:**
- No runtime code may import `WINNABLE_SEEDS` or `WINNABLE_POOL_METADATA` after this task.

- [ ] **Step 1: Prove the legacy pool is still referenced before removal**

```bash
grep -R "WINNABLE_SEEDS\|WINNABLE_POOL_METADATA\|generate:winnable-pool" src tests package.json
```

Expected before cleanup: at least the legacy file/test/script references are printed.

- [ ] **Step 2: Delete legacy pool and update integrity tests**

Move all still-relevant assertions to the generated catalog tests: exact Standard counts, positive uint32, uniqueness, no cross-pool overlap, manifest count consistency.

- [ ] **Step 3: Verify no legacy references remain**

```bash
grep -R "WINNABLE_SEEDS\|WINNABLE_POOL_METADATA\|generate:winnable-pool" src tests package.json
```

Expected: no output and grep exit 1.

- [ ] **Step 4: Run complete project verification**

```bash
pnpm test
pnpm build
pnpm deals:verify-sample
```

Expected: all commands exit 0. Then run the long release gate once more on the exact committed assets:

```bash
pnpm deals:verify-all
```

Expected: 86,525/86,525 production proofs replay successfully.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A -- src/game/model/winnableSeeds.ts tests/winnable-pool.test.ts package.json
git commit -m "refactor: retire legacy winnable seed pool"
```

---

## Execution Order and Review Gates

Execute Tasks 1→7 first and review the solver/proof/catalog pipeline before touching player persistence. A bad proof format or catalog format is expensive to unwind after runtime integration.

Execute Tasks 8→12 second and review Standard/Daily runtime behavior using tiny fixture catalogs. Do not wait for 86,525 production seeds to test difficulty logic.

Execute Tasks 13→15 last. Task 14 is intentionally the only long-running data-production task; all code and runtime behavior should already be green against fixtures before spending hours generating the release catalog.

## Final Acceptance Checklist

- `pnpm test` passes with no failures.
- `pnpm build` succeeds.
- `pnpm deals:verify-sample` passes.
- `pnpm deals:verify-all` verifies every production seed through current `SolitaireGame`.
- Manifest says Standard exactly 50,000 with `5000/15000/17500/12500` tier counts.
- Daily schedule contains 36,525 unique dates/seeds starting 2026-01-01 UTC.
- Standard/Daily overlap is zero.
- Daily Monday→Sunday entries satisfy their approved percentile bands and no Daily uses the top 5% tail.
- Standard wins 0–2 can only receive onboarding deals.
- Two failures soften, three failures force easy, and a Standard win resets the streak.
- Restart/menu/F5/restore do not increment failure streak.
- A deliberate replacement of a started unfinished Standard deal increments failure streak once.
- Hard never follows hard.
- Recent 256 Standard seeds are avoided.
- Classic seed generation remains unchanged.
- No `WINNABLE_SEEDS` legacy reference remains.
- `artifacts/deals/` is not committed.
