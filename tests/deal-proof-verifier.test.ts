import test from 'node:test';
import assert from 'node:assert/strict';

import { createDeck } from '../src/game/model/cards.ts';
import { replayDealProof } from '../src/game/model/DealProof.ts';
import type { Deal, Suit } from '../src/game/model/types.ts';

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

test('replayDealProof completes a synthetic near-win deal through production move rules', () => {
  const verification = replayDealProof(createNearWinDeal(), [{
    kind: 'to-foundation',
    source: { zone: 'tableau', pile: 0 },
    cardId: 'spades-13',
    suit: 'spades',
  }]);

  assert.equal(verification.seed, 1n);
  assert.equal(verification.actionCount, 1);
  assert.equal(verification.foundationCount, 52);
});

test('replayDealProof rejects a draw proof that does not match the production draw', () => {
  assert.throws(
    () => replayDealProof(createNearWinDeal(), [{ kind: 'draw', cardIds: ['clubs-2'] }]),
    /seed=1.*action=0.*draw/iu,
  );
});

test('replayDealProof rejects card loss or duplication after an otherwise legal action', () => {
  const deal = createNearWinDeal();
  const clubsKing = deal.foundations?.clubs?.at(-1);
  assert.ok(clubsKing);
  deal.foundations!.hearts![12] = clubsKing;

  assert.throws(
    () => replayDealProof(deal, [{
      kind: 'to-foundation',
      source: { zone: 'tableau', pile: 0 },
      cardId: 'spades-13',
      suit: 'spades',
    }]),
    /seed=1.*action=0.*52 unique/iu,
  );
});
