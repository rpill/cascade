import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import { GameHistory } from '../src/game/model/GameHistory.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';

function emptyGame(stock = [] as ReturnType<typeof createCard>[]): SolitaireGame {
  return new SolitaireGame({
    seed: 1n,
    mode: 'original',
    tableau: [[], [], [], [], [], [], []],
    stock,
  });
}

test('snapshot restore replaces every mutable gameplay zone', () => {
  const ace = createCard('clubs', 1);
  const stockCard = createCard('hearts', 4);
  const wasteCard = createCard('spades', 7);
  const freeCard = createCard('diamonds', 9);
  const game = new SolitaireGame({
    seed: 7n,
    mode: 'winnable',
    tableau: [[createCard('hearts', 10)], [], [], [], [], [], []],
    stock: [stockCard],
    waste: [wasteCard],
    freeCell: freeCard,
    foundations: { clubs: [ace] },
  });
  const snapshot = game.snapshot();

  game.tableau[0].pop();
  game.stock.pop();
  game.waste.pop();
  game.foundations.clubs.pop();
  game.freeCell = null;
  game.restore(snapshot);

  assert.deepEqual(game.tableau[0].map((card) => card.id), ['hearts-10']);
  assert.deepEqual(game.stock.map((card) => card.id), [stockCard.id]);
  assert.deepEqual(game.waste.map((card) => card.id), [wasteCard.id]);
  assert.deepEqual(game.foundations.clubs.map((card) => card.id), [ace.id]);
  assert.equal(game.snapshot().freeCell?.id, freeCard.id);
  assert.equal(game.seed, 7n);
  assert.equal(game.mode, 'winnable');
});

test('history records changed actions but ignores failed moves and empty draws', () => {
  const game = emptyGame();
  const history = new GameHistory();

  const failed = history.execute(
    game,
    () => game.move(
      { zone: 'tableau', pile: 0, index: 0 },
      { zone: 'tableau', pile: 1 },
    ),
    Boolean,
  );
  const emptyDraw = history.execute(game, () => game.draw(), (cards) => cards.length > 0);

  assert.equal(failed, false);
  assert.deepEqual(emptyDraw, []);
  assert.equal(history.canUndo, false);
});

test('history undoes multiple draws in last-in-first-out order', () => {
  const cards = [
    createCard('clubs', 4),
    createCard('diamonds', 6),
    createCard('hearts', 8),
    createCard('spades', 10),
    createCard('clubs', 12),
    createCard('diamonds', 13),
  ];
  const game = emptyGame(cards);
  const history = new GameHistory();
  const draw = () => history.execute(game, () => game.draw(), (result) => result.length > 0);

  draw();
  draw();
  assert.deepEqual([game.stock.length, game.waste.length], [0, 6]);

  assert.equal(history.undo(game), true);
  assert.deepEqual([game.stock.length, game.waste.length], [3, 3]);
  assert.equal(history.undo(game), true);
  assert.deepEqual([game.stock.length, game.waste.length], [6, 0]);
  assert.equal(history.undo(game), false);
});

test('one undo restores a player move and its complete automatic chain', () => {
  const ace = createCard('hearts', 1);
  const two = createCard('hearts', 2);
  const blocker = createCard('clubs', 5);
  const destination = createCard('diamonds', 6);
  const game = new SolitaireGame({
    seed: 2n,
    mode: 'original',
    tableau: [[ace, blocker], [destination], [], [], [], [], []],
    stock: [],
    waste: [two],
  });
  const history = new GameHistory();

  history.execute(
    game,
    () => game.move(
      { zone: 'tableau', pile: 0, index: 1 },
      { zone: 'tableau', pile: 1 },
    ),
    Boolean,
  );
  while (game.autoMoveToFoundation() !== null) {}

  assert.deepEqual(game.foundations.hearts.map((card) => card.rank), [1, 2]);
  assert.equal(history.undo(game), true);
  assert.deepEqual(game.tableau[0].map((card) => card.id), [ace.id, blocker.id]);
  assert.deepEqual(game.tableau[1].map((card) => card.id), [destination.id]);
  assert.deepEqual(game.waste.map((card) => card.id), [two.id]);
  assert.deepEqual(game.foundations.hearts, []);
});

test('clearing history disables undo', () => {
  const game = emptyGame([createCard('clubs', 4)]);
  const history = new GameHistory();
  history.execute(game, () => game.draw(), (cards) => cards.length > 0);

  history.clear();

  assert.equal(history.canUndo, false);
  assert.equal(history.undo(game), false);
});
