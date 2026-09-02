import {
  SUITS,
  type Card,
  type Suit,
} from './types.ts';

const RED_SUITS = new Set<Suit>([
  'diamonds',
  'hearts',
]);

export function createCard(
  suit: Suit,
  rank: number,
): Card {
  if (!SUITS.includes(suit)) {
    throw new Error(`Unknown suit: ${suit}`);
  }

  if (!Number.isInteger(rank) || rank < 1 || rank > 13) {
    throw new RangeError(`Invalid card rank: ${rank}`);
  }

  return Object.freeze({
    id: `${suit}-${rank}`,
    suit,
    rank,
    color: RED_SUITS.has(suit) ? 'red' : 'black',
  });
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    Array.from(
      { length: 13 },
      (_, index) => createCard(suit, index + 1),
    ),
  );
}
