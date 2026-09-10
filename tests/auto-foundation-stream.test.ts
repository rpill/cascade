import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';

test('automatic foundation skips a suit that is still animating', () => {
  const clubAce = createCard('clubs', 1);
  const heartAce = createCard('hearts', 1);
  const game = new SolitaireGame({
    seed: 1n,
    mode: 'original',
    tableau: [[clubAce], [heartAce], [], [], [], [], []],
    stock: [],
  });

  assert.equal(
    game.autoMoveToFoundation(new Set(['clubs']))?.id,
    heartAce.id,
  );
  assert.deepEqual(game.foundations.clubs, []);
  assert.deepEqual(game.foundations.hearts.map((card) => card.id), [heartAce.id]);
});
