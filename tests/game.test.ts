import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import {
  createSawayamaDeal,
  hasOriginalOpeningConstraint,
} from '../src/game/model/deal.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';

test('deal contains a full unique deck and 1..7 tableau columns', () => {
  const deal = createSawayamaDeal(42);
  const cards = [...deal.tableau.flat(), ...deal.stock];

  assert.deepEqual(deal.tableau.map((pile) => pile.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map((card) => card.id)).size, 52);
  assert.equal(hasOriginalOpeningConstraint(deal.tableau), true);
});

test('tableau accepts descending alternating runs', () => {
  const game = new SolitaireGame({
    seed: 1,
    tableau: [
      [createCard('spades', 10)],
      [createCard('hearts', 9), createCard('clubs', 8)],
      [], [], [], [], [],
    ],
    stock: [],
  });

  assert.equal(game.move(
    { zone: 'tableau', pile: 1, index: 0 },
    { zone: 'tableau', pile: 0 },
  ), true);
  assert.deepEqual(game.tableau[0].map((card) => card.rank), [10, 9, 8]);
});

test('drawing exposes three cards and unlocks the stock free cell at the end', () => {
  const game = new SolitaireGame({
    seed: 1,
    tableau: [[], [], [], [], [], [], []],
    stock: [
      createCard('clubs', 2),
      createCard('diamonds', 3),
      createCard('hearts', 4),
      createCard('spades', 5),
    ],
  });

  assert.equal(game.draw().length, 3);
  assert.equal(game.stock.length, 1);
  assert.equal(game.freeCellAvailable, false);
  assert.equal(game.draw().length, 1);
  assert.equal(game.freeCellAvailable, true);
});

test('foundations build by suit from ace and remain one-way', () => {
  const ace = createCard('hearts', 1);
  const two = createCard('hearts', 2);
  const game = new SolitaireGame({
    seed: 1,
    tableau: [[ace], [two], [], [], [], [], []],
    stock: [],
  });

  assert.equal(game.moveToFoundation({ zone: 'tableau', pile: 1, index: 0 }), false);
  assert.equal(game.moveToFoundation({ zone: 'tableau', pile: 0, index: 0 }), true);
  assert.equal(game.moveToFoundation({ zone: 'tableau', pile: 1, index: 0 }), true);
  assert.equal(game.foundationCount, 2);
});

test('automatic foundation moves chain from an exposed ace into its two', () => {
  const ace = createCard('hearts', 1);
  const two = createCard('hearts', 2);
  const game = new SolitaireGame({
    seed: 1,
    tableau: [[], [], [], [], [], [], []],
    stock: [],
    waste: [two, ace],
  });

  assert.equal(game.autoMoveToFoundation()?.id, ace.id);
  assert.equal(game.autoMoveToFoundation()?.id, two.id);
  assert.equal(game.autoMoveToFoundation(), null);
  assert.deepEqual(game.foundations.hearts.map((card) => card.rank), [1, 2]);
  assert.equal(game.waste.length, 0);
});

test('automatic foundation holds a three until both opposite-colour twos are safe', () => {
  const clubAce = createCard('clubs', 1);
  const clubTwo = createCard('clubs', 2);
  const clubThree = createCard('clubs', 3);
  const heartAce = createCard('hearts', 1);
  const heartTwo = createCard('hearts', 2);
  const diamondAce = createCard('diamonds', 1);
  const diamondTwo = createCard('diamonds', 2);
  const blockingCard = createCard('hearts', 5);
  const game = new SolitaireGame({
    seed: 1,
    tableau: [
      [clubThree],
      [diamondTwo, blockingCard],
      [], [], [], [], [],
    ],
    stock: [],
    foundations: {
      clubs: [clubAce, clubTwo],
      hearts: [heartAce, heartTwo],
      diamonds: [diamondAce],
    },
  });

  assert.equal(game.autoMoveToFoundation(), null);
  assert.equal(game.move(
    { zone: 'tableau', pile: 1, index: 1 },
    { zone: 'tableau', pile: 2 },
  ), true);
  assert.equal(game.autoMoveToFoundation()?.id, diamondTwo.id);
  assert.equal(game.autoMoveToFoundation()?.id, clubThree.id);
  assert.equal(game.autoMoveToFoundation(), null);
});
