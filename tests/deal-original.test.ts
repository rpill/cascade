import test from 'node:test';
import assert from 'node:assert/strict';

import { OriginalRandom } from '../src/game/model/OriginalRandom.ts';
import { createOriginalDeal } from '../src/game/model/deal.ts';

test('original xorshift128+ reproduces the reverse-engineered sequence', () => {
  const random = new OriginalRandom(1n);

  assert.deepEqual(
    Array.from({ length: 5 }, () => random.nextUint64()),
    [
      0x3491_3d26_a7e2_cd2fn,
      0x62ac_15b8_5e3e_c0can,
      0xd8ae_ece7_8eac_c5f8n,
      0x5931_f371_585f_5891n,
      0xf41b_2a7b_e06c_7e13n,
    ],
  );
});

test('seed 1 reproduces the original accepted shuffle and deal direction', () => {
  const deal = createOriginalDeal(1n);
  const exposed = deal.tableau.map((pile) => pile.at(-1));
  const nextStockCards = deal.stock.slice(-3).reverse();
  const identities = (cards: typeof exposed) => cards.map((card) =>
    card === undefined ? 'missing' : `${card.suit}-${card.rank}`,
  );

  assert.equal(deal.seed, 1n);
  assert.deepEqual(identities(exposed), [
    'hearts-9',
    'clubs-7',
    'spades-2',
    'diamonds-13',
    'hearts-13',
    'spades-4',
    'hearts-7',
  ]);
  assert.deepEqual(identities(nextStockCards), [
    'diamonds-3',
    'hearts-1',
    'clubs-2',
  ]);
});
