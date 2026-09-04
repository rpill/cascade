import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { createCard } from '../src/game/model/cards.ts';
import { GameSession } from '../src/game/model/GameSession.ts';
import type { Deal } from '../src/game/model/types.ts';

function entropySequence(values: bigint[]): () => bigint {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('original new games use fresh non-zero entropy and avoid the current seed', () => {
  const session = new GameSession({
    nextSeed: entropySequence([11n, 11n, 12n]),
    winnableSeeds: [101n, 202n],
  });

  assert.equal(session.startNew('original').seed, 11n);
  assert.equal(session.startNew('original').seed, 12n);
  assert.equal(session.currentMode, 'original');
});

test('winnable new games select only pool members and avoid repeats', () => {
  const pool = [11n, 22n] as const;
  const session = new GameSession({
    nextSeed: entropySequence([2n, 2n, 3n]),
    winnableSeeds: pool,
  });

  assert.equal(session.startNew('winnable').seed, 11n);
  assert.equal(session.startNew('winnable').seed, 22n);
  assert.ok(pool.includes(session.currentSeed as 11n | 22n));
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
  const session = new GameSession({
    nextSeed: () => 999n,
    winnableSeeds: [101n],
  });

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

test('restart preserves mode, seed, tableau, and stock order', () => {
  const session = new GameSession({
    nextSeed: () => 42n,
    winnableSeeds: [11n],
  });
  const first = session.startNew('original');
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
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [1n] });

  assert.throws(() => session.restart(), /before starting a game/iu);
});

test('an empty winnable pool never falls back to an unverified seed', () => {
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [] });

  assert.throws(() => session.startNew('winnable'), /winnable seed pool is empty/iu);
});

test('Daily starts only from a seed in the frozen solver-proven pool', () => {
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [11n, 22n] });

  assert.equal(session.startDaily(22n).mode, 'daily');
  assert.equal(session.currentSeed, 22n);
  assert.throws(() => session.startDaily(99n), /solver-proven/i);
});

test('Daily restart preserves its fixed seed', () => {
  const session = new GameSession({ nextSeed: () => 1n, winnableSeeds: [11n] });
  const first = session.startDaily(11n);
  const restarted = session.restart();

  assert.equal(restarted.mode, 'daily');
  assert.equal(restarted.seed, first.seed);
});

test('Daily cannot accidentally use the ordinary entropy-based new-game path', () => {
  const session = new GameSession({ nextSeed: () => 11n, winnableSeeds: [11n] });

  assert.throws(() => session.startNew('daily'), /startDaily/i);
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
