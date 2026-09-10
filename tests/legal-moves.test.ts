import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';

function gameWith(tableau: ReturnType<typeof createCard>[][], options: {
  stock?: ReturnType<typeof createCard>[];
  waste?: ReturnType<typeof createCard>[];
  freeCell?: ReturnType<typeof createCard> | null;
} = {}): SolitaireGame {
  return new SolitaireGame({
    seed: 1n,
    mode: 'original',
    tableau,
    stock: options.stock ?? [],
    waste: options.waste ?? [],
    freeCell: options.freeCell ?? null,
  });
}

test('findLegalMoves enumerates real moves without changing the board', () => {
  const game = gameWith([
    [createCard('spades', 8)],
    [createCard('hearts', 7)],
    [], [], [], [], [],
  ], { waste: [createCard('clubs', 1)] });
  const before = game.snapshot();

  assert.equal(typeof (game as SolitaireGame & { findLegalMoves?: unknown }).findLegalMoves, 'function');
  const moves = (game as SolitaireGame & { findLegalMoves: () => Array<{ source: unknown; target: unknown }> }).findLegalMoves();

  assert.ok(moves.some((move) => JSON.stringify(move) === JSON.stringify({
    source: { zone: 'tableau', pile: 1, index: 0 },
    target: { zone: 'tableau', pile: 0 },
  })));
  assert.ok(moves.some((move) => JSON.stringify(move) === JSON.stringify({
    source: { zone: 'waste' },
    target: { zone: 'foundation', suit: 'clubs' },
  })));
  assert.deepEqual(game.snapshot(), before);
});

test('findLegalMoves includes ordered tableau runs and excludes illegal self moves', () => {
  const game = gameWith([
    [createCard('clubs', 9)],
    [createCard('hearts', 8), createCard('clubs', 7)],
    [], [], [], [], [],
  ], { stock: [createCard('diamonds', 2)] });

  assert.equal(typeof (game as SolitaireGame & { findLegalMoves?: unknown }).findLegalMoves, 'function');
  const moves = (game as SolitaireGame & { findLegalMoves: () => Array<{ source: any; target: any }> }).findLegalMoves();

  assert.ok(moves.some((move) => move.source.zone === 'tableau'
    && move.source.pile === 1
    && move.source.index === 0
    && move.target.zone === 'tableau'
    && move.target.pile === 0));
  assert.ok(!moves.some((move) => move.source.zone === 'tableau'
    && move.target.zone === 'tableau'
    && move.source.pile === move.target.pile));
});
