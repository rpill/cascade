import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { createCard } from '../src/game/model/cards.ts';
import { GameSession } from '../src/game/model/GameSession.ts';
import {
  VerifiedDealCatalog,
  type StandardTier,
  type VerifiedDealManifest,
} from '../src/game/model/VerifiedDealCatalog.ts';
import type { Deal } from '../src/game/model/types.ts';

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function entropySequence(values: bigint[]): () => bigint {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function tinyCatalog(): VerifiedDealCatalog {
  const standard: Record<StandardTier, number[]> = {
    onboarding: [11],
    easy: [22],
    medium: [33],
    hard: [44],
  };
  const daily = [101, 102];
  const values = [...TIERS.flatMap((tier) => standard[tier]), ...daily];
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  const standardCounts = {} as Record<StandardTier, number>;
  const offsets = {} as Record<StandardTier | 'daily', { byteOffset: number; count: number }>;
  let byteOffset = 0;
  for (const tier of TIERS) {
    standardCounts[tier] = standard[tier].length;
    offsets[tier] = { byteOffset, count: standard[tier].length };
    byteOffset += standard[tier].length * 4;
  }
  offsets.daily = { byteOffset, count: daily.length };
  const manifest: VerifiedDealManifest = {
    catalogVersion: 1,
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 2,
    solverSourceHash: 'solver-hash',
    gameRulesSourceHash: 'rules-hash',
    standardCounts,
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: daily.length,
    fastNodeBudget: 250000,
    slowNodeBudget: 2000000,
    sourceScanRanges: [],
    verifiedCount: values.length,
    rejectedVerificationCount: 0,
    crossPoolDuplicateCount: 0,
    productionAssetHash: '0'.repeat(64),
    offsets,
  };
  return VerifiedDealCatalog.decode(buffer, manifest);
}

test('original new games use fresh non-zero entropy and avoid the current seed', () => {
  const session = new GameSession({
    nextSeed: entropySequence([11n, 11n, 12n]),
    catalog: tinyCatalog(),
  });

  assert.equal(session.startOriginal().seed, 11n);
  assert.equal(session.startOriginal().seed, 12n);
  assert.equal(session.currentMode, 'original');
});

test('Standard starts only from Standard catalog members', () => {
  const session = new GameSession({ catalog: tinyCatalog() });

  assert.equal(session.startStandard(22n).mode, 'winnable');
  assert.equal(session.currentSeed, 22n);
  assert.throws(() => session.startStandard(101n), /verified standard/iu);
  assert.throws(() => session.startStandard(999n), /verified standard/iu);
});

test('Daily starts only from Daily catalog members and rejects Standard-only seeds', () => {
  const session = new GameSession({ catalog: tinyCatalog() });

  assert.equal(session.startDaily(101n).mode, 'daily');
  assert.equal(session.currentSeed, 101n);
  assert.throws(() => session.startDaily(22n), /verified daily/iu);
  assert.throws(() => session.startDaily(999n), /verified daily/iu);
});

test('resume installs an exact cloned saved deal without re-dealing', () => {
  const savedDeal: Deal = {
    seed: 77n,
    mode: 'original',
    tableau: [[createCard('clubs', 4)], [], [], [], [], [], []],
    stock: [createCard('hearts', 9)],
    waste: [createCard('spades', 7)],
    freeCell: createCard('diamonds', 6),
    foundations: { clubs: [createCard('clubs', 1)] },
  };
  const session = new GameSession({ nextSeed: () => 999n, catalog: tinyCatalog() });

  const resumed = session.resume(savedDeal);

  assert.equal(resumed.seed, savedDeal.seed);
  assert.equal(resumed.mode, savedDeal.mode);
  assert.deepEqual(resumed.tableau, savedDeal.tableau);
  assert.deepEqual(resumed.stock, savedDeal.stock);
  assert.deepEqual(resumed.waste, savedDeal.waste);
  assert.deepEqual(resumed.foundations, savedDeal.foundations);
  assert.equal(resumed.freeCell?.id, savedDeal.freeCell?.id);
  assert.notEqual(resumed, savedDeal);
  assert.notEqual(resumed.tableau, savedDeal.tableau);
  assert.notEqual(resumed.tableau[0], savedDeal.tableau[0]);
  assert.notEqual(resumed.stock, savedDeal.stock);
  assert.notEqual(resumed.waste, savedDeal.waste);
  assert.notEqual(resumed.foundations, savedDeal.foundations);
  assert.notEqual(resumed.foundations?.clubs, savedDeal.foundations?.clubs);

  savedDeal.tableau[0].length = 0;
  savedDeal.stock.length = 0;
  savedDeal.waste!.length = 0;
  savedDeal.foundations!.clubs!.length = 0;

  assert.equal(session.currentDeal?.tableau[0].length, 1);
  assert.equal(session.currentDeal?.stock.length, 1);
  assert.equal(session.currentDeal?.waste?.length, 1);
  assert.equal(session.currentDeal?.foundations?.clubs?.length, 1);
});

test('restart preserves exact verified Standard and Daily seeds', () => {
  const session = new GameSession({ catalog: tinyCatalog() });

  const standard = session.startStandard(33n);
  const standardRestart = session.restart();
  assert.equal(standardRestart.mode, 'winnable');
  assert.equal(standardRestart.seed, standard.seed);

  const daily = session.startDaily(102n);
  const dailyRestart = session.restart();
  assert.equal(dailyRestart.mode, 'daily');
  assert.equal(dailyRestart.seed, daily.seed);
});

test('restart preserves original mode seed tableau and stock order', () => {
  const session = new GameSession({ nextSeed: () => 42n, catalog: tinyCatalog() });
  const first = session.startOriginal();
  const restarted = session.restart();

  assert.equal(restarted.mode, first.mode);
  assert.equal(restarted.seed, first.seed);
  assert.deepEqual(
    restarted.tableau.map((pile) => pile.map((card) => card.id)),
    first.tableau.map((pile) => pile.map((card) => card.id)),
  );
  assert.deepEqual(
    restarted.stock.map((card) => card.id),
    first.stock.map((card) => card.id),
  );
});

test('restart before a game reports a clear development error', () => {
  const session = new GameSession({ catalog: tinyCatalog() });
  assert.throws(() => session.restart(), /before starting a game/iu);
});

test('solitaire model stays independent from platform and Yandex SDK code', () => {
  const modelDir = new URL('../src/game/model/', import.meta.url);

  for (const entry of readdirSync(modelDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;

    const source = readFileSync(new URL(entry.name, modelDir), 'utf8');
    assert.doesNotMatch(
      source,
      /\bYaGames\b|\bysdk\b|from ['"][^'"]*platform\//,
      `${entry.name} must not depend on platform SDK code`,
    );
  }
});
