import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';

function gameWith(tableau: ReturnType<typeof createCard>[][]): SolitaireGame {
  return new SolitaireGame({
    seed: 99n,
    mode: 'original',
    tableau,
    stock: [createCard('spades', 2)],
  });
}

function hintMoves(game: SolitaireGame): Array<{
  source: { zone: string; pile?: number; index?: number };
  target: { zone: string; pile?: number; suit?: string };
}> {
  const candidate = game as SolitaireGame & { findHintMoves?: () => Array<any> };
  assert.equal(typeof candidate.findHintMoves, 'function', 'SolitaireGame.findHintMoves must exist');
  return candidate.findHintMoves!();
}

test('hint moves suppress sub-run reshuffles from an already ordered tableau stack', () => {
  const game = gameWith([
    [
      createCard('clubs', 9),
      createCard('hearts', 8),
      createCard('clubs', 7),
      createCard('hearts', 6),
    ],
    [createCard('diamonds', 8)],
    [createCard('diamonds', 10)],
    [], [], [], [],
  ]);

  const legal = game.findLegalMoves();
  assert.ok(legal.some((move) =>
    move.source.zone === 'tableau'
    && move.source.pile === 0
    && move.source.index === 2
    && move.target.zone === 'tableau'
    && move.target.pile === 1
  ), 'scenario must contain the noisy legal sub-run move');

  const hints = hintMoves(game);

  assert.ok(!hints.some((move) =>
    move.source.zone === 'tableau'
    && move.source.pile === 0
    && move.source.index === 2
    && move.target.zone === 'tableau'
  ));

  assert.ok(hints.some((move) =>
    move.source.zone === 'tableau'
    && move.source.pile === 0
    && move.source.index === 0
    && move.target.zone === 'tableau'
    && move.target.pile === 2
  ), 'the maximal useful run should still be suggested');
});

test('hint moves keep a run that exposes a blocked card and deduplicate equivalent destinations', () => {
  const game = gameWith([
    [
      createCard('clubs', 12),
      createCard('clubs', 9),
      createCard('hearts', 8),
      createCard('clubs', 7),
    ],
    [createCard('hearts', 10)],
    [createCard('diamonds', 10)],
    [], [], [], [],
  ]);

  const hints = hintMoves(game).filter((move) =>
    move.source.zone === 'tableau'
    && move.source.pile === 0
    && move.source.index === 1
    && move.target.zone === 'tableau'
    && (move.target.pile === 1 || move.target.pile === 2)
  );

  assert.equal(hints.length, 1);
  assert.ok(hints[0]?.target.pile === 1 || hints[0]?.target.pile === 2);
});

test('hint moves never hide a legal foundation move from the top of an ordered run', () => {
  const game = gameWith([
    [createCard('hearts', 2), createCard('clubs', 1)],
    [], [], [], [], [], [],
  ]);

  const hints = hintMoves(game);

  assert.ok(hints.some((move) =>
    move.source.zone === 'tableau'
    && move.source.pile === 0
    && move.source.index === 1
    && move.target.zone === 'foundation'
    && move.target.suit === 'clubs'
  ));
});
