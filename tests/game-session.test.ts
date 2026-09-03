import test from 'node:test';
import assert from 'node:assert/strict';

import { GameSession } from '../src/game/model/GameSession.ts';

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
