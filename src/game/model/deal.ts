import { createDeck } from './cards.ts';
import type { Card, Deal, GameMode } from './types.ts';
import {
  normalizeDealSeed,
  OriginalRandom,
  type DealSeedInput,
} from './OriginalRandom.ts';

function shuffleInPlace(cards: Card[], random: OriginalRandom): void {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
}

function dealTableau(deck: readonly Card[]): { tableau: Card[][]; stock: Card[] } {
  const tableau = Array.from({ length: 7 }, () => [] as Card[]);
  let cursor = deck.length - 1;

  for (let row = 0; row < 7; row += 1) {
    for (let pile = row; pile < 7; pile += 1) {
      tableau[pile].push(deck[cursor]);
      cursor -= 1;
    }
  }

  // The top of every model pile is its final array element.
  const stock = deck.slice(0, cursor + 1);

  return { tableau, stock };
}

export function hasOriginalOpeningConstraint(tableau: readonly Card[][]): boolean {
  const exposed = tableau.map((pile) => pile.at(-1));

  if (exposed.some((card) => card === undefined || card.rank === 1)) {
    return false;
  }

  for (let left = 0; left < exposed.length; left += 1) {
    for (let right = left + 1; right < exposed.length; right += 1) {
      const first = exposed[left];
      const second = exposed[right];

      if (
        first !== undefined
        && second !== undefined
        && first.color !== second.color
        && Math.abs(first.rank - second.rank) === 1
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Reproduces Hikone's opening constraint: the seven exposed cards contain
 * no aces and no immediately compatible opposite-colour pair.
 */
export function createOriginalDeal(
  seed: DealSeedInput = BigInt(Date.now()),
  mode: GameMode = 'original',
): Deal {
  const normalizedSeed = normalizeDealSeed(seed);
  const random = new OriginalRandom(normalizedSeed);
  const deck = createDeck();

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    shuffleInPlace(deck, random);
    const candidate = dealTableau(deck);

    if (hasOriginalOpeningConstraint(candidate.tableau)) {
      return {
        seed: normalizedSeed,
        mode,
        ...candidate,
      };
    }
  }

  throw new Error('Could not generate a valid Sawayama opening.');
}

export const createSawayamaDeal = createOriginalDeal;

export function createDealForMode(mode: GameMode, seed: DealSeedInput): Deal {
  return createOriginalDeal(seed, mode);
}

export function getTableauDealSequence(tableau: readonly Card[][]): Card[] {
  const sequence: Card[] = [];

  for (let row = 0; row < 7; row += 1) {
    for (let pile = row; pile < 7; pile += 1) {
      const card = tableau[pile][row];

      if (card !== undefined) {
        sequence.push(card);
      }
    }
  }

  return sequence;
}
