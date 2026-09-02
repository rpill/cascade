import { createDeck } from './cards.ts';
import type { Card, Deal } from './types.ts';

function seedToUint32(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  let hash = 2166136261;

  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;

  return () => {
    value += 0x6d2b79f5;

    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(cards: readonly Card[], random: () => number): Card[] {
  const result = [...cards];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function dealTableau(deck: Card[]): { tableau: Card[][]; stock: Card[] } {
  const tableau = Array.from({ length: 7 }, () => [] as Card[]);
  let cursor = 0;

  for (let row = 0; row < 7; row += 1) {
    for (let pile = row; pile < 7; pile += 1) {
      tableau[pile].push(deck[cursor]);
      cursor += 1;
    }
  }

  // The top of every model pile is its final array element.
  const stock = deck.slice(cursor).reverse();

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
export function createSawayamaDeal(
  seed: number | string = Date.now(),
): Deal {
  const normalizedSeed = seedToUint32(seed);
  const random = mulberry32(normalizedSeed);
  const deck = createDeck();

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const candidate = dealTableau(shuffle(deck, random));

    if (hasOriginalOpeningConstraint(candidate.tableau)) {
      return {
        seed: normalizedSeed,
        ...candidate,
      };
    }
  }

  throw new Error('Could not generate a valid Sawayama opening.');
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
