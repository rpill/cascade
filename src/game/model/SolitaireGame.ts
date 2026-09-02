import {
  SUITS,
  type Card,
  type CardSource,
  type Deal,
  type Foundations,
  type MoveTarget,
  type Suit,
} from './types.ts';
import { createSawayamaDeal } from './deal.ts';

function isRedSuit(suit: Suit): boolean {
  return suit === 'diamonds' || suit === 'hearts';
}

function cloneFoundations(source?: Partial<Foundations>): Foundations {
  return Object.fromEntries(
    SUITS.map((suit) => [suit, [...(source?.[suit] ?? [])]]),
  ) as Foundations;
}

export class SolitaireGame {
  readonly seed: number;
  readonly tableau: Card[][];
  readonly stock: Card[];
  readonly waste: Card[];
  readonly foundations: Foundations;

  freeCell: Card | null;

  constructor(deal: Deal = createSawayamaDeal()) {
    this.seed = deal.seed;
    this.tableau = deal.tableau.map((pile) => [...pile]);
    this.stock = [...deal.stock];
    this.waste = [...(deal.waste ?? [])];
    this.freeCell = deal.freeCell ?? null;
    this.foundations = cloneFoundations(deal.foundations);
  }

  get freeCellAvailable(): boolean {
    return this.stock.length === 0;
  }

  get foundationCount(): number {
    return SUITS.reduce(
      (total, suit) => total + this.foundations[suit].length,
      0,
    );
  }

  get isWon(): boolean {
    return this.foundationCount === 52;
  }

  draw(): Card[] {
    if (this.stock.length === 0) {
      return [];
    }

    const drawn: Card[] = [];

    for (let count = 0; count < 3 && this.stock.length > 0; count += 1) {
      const card = this.stock.pop();

      if (card !== undefined) {
        drawn.push(card);
      }
    }

    // This small reversal is present in Hikone: when none of the next three
    // cards is currently playable, the first card stays accessible on top.
    if (!drawn.some((card) => this.canPlayCardAnywhere(card))) {
      drawn.reverse();
    }

    this.waste.push(...drawn);

    return drawn;
  }

  cardsFromSource(source: CardSource): Card[] {
    if (source.zone === 'tableau') {
      const pile = this.tableau[source.pile];

      if (
        pile === undefined
        || !Number.isInteger(source.index)
        || source.index < 0
        || source.index >= pile.length
      ) {
        return [];
      }

      const cards = pile.slice(source.index);
      return this.isOrderedRun(cards) ? cards : [];
    }

    if (source.zone === 'waste') {
      const card = this.waste.at(-1);
      return card === undefined ? [] : [card];
    }

    return this.freeCell === null ? [] : [this.freeCell];
  }

  canMove(source: CardSource, target: MoveTarget): boolean {
    const cards = this.cardsFromSource(source);

    if (cards.length === 0) {
      return false;
    }

    if (
      source.zone === 'tableau'
      && target.zone === 'tableau'
      && source.pile === target.pile
    ) {
      return false;
    }

    if (target.zone === 'tableau') {
      const destination = this.tableau[target.pile];

      if (destination === undefined) {
        return false;
      }

      const topCard = destination.at(-1);

      return topCard === undefined
        || this.canStackOnTableau(cards[0], topCard);
    }

    if (target.zone === 'foundation') {
      return cards.length === 1
        && this.canStackOnFoundation(cards[0], target.suit);
    }

    return this.freeCellAvailable
      && this.freeCell === null
      && cards.length === 1;
  }

  move(source: CardSource, target: MoveTarget): boolean {
    if (!this.canMove(source, target)) {
      return false;
    }

    const cards = this.extract(source);

    if (target.zone === 'tableau') {
      this.tableau[target.pile].push(...cards);
    } else if (target.zone === 'foundation') {
      this.foundations[target.suit].push(cards[0]);
    } else {
      this.freeCell = cards[0];
    }

    return true;
  }

  moveToFoundation(source: CardSource): boolean {
    const card = this.cardsFromSource(source)[0];

    return card !== undefined
      && this.move(source, { zone: 'foundation', suit: card.suit });
  }

  autoMoveToFoundation(): Card | null {
    const source = this.findAutoFoundationSource();

    if (source === null) {
      return null;
    }

    const card = this.cardsFromSource(source)[0];

    return card !== undefined && this.moveToFoundation(source)
      ? card
      : null;
  }

  private isOrderedRun(cards: readonly Card[]): boolean {
    if (cards.length === 0) {
      return false;
    }

    for (let index = 1; index < cards.length; index += 1) {
      const lower = cards[index - 1];
      const upper = cards[index];

      if (!this.canStackOnTableau(upper, lower)) {
        return false;
      }
    }

    return true;
  }

  private canStackOnTableau(card: Card, destination: Card): boolean {
    return destination.rank === card.rank + 1
      && destination.color !== card.color;
  }

  private canStackOnFoundation(card: Card, suit: Suit): boolean {
    return card.suit === suit
      && card.rank === this.foundations[suit].length + 1;
  }

  private canPlayCardAnywhere(card: Card): boolean {
    return SUITS.some((suit) => this.canStackOnFoundation(card, suit))
      || this.tableau.some((pile) => {
        const destination = pile.at(-1);
        return destination === undefined
          || this.canStackOnTableau(card, destination);
      });
  }

  private findAutoFoundationSource(): CardSource | null {
    for (let pile = 0; pile < this.tableau.length; pile += 1) {
      const index = this.tableau[pile].length - 1;

      if (index >= 0) {
        const source = { zone: 'tableau', pile, index } as const;
        const card = this.cardsFromSource(source)[0];

        if (card !== undefined && this.isAutoFoundationEligible(card)) {
          return source;
        }
      }
    }

    const wasteCard = this.waste.at(-1);

    if (wasteCard !== undefined && this.isAutoFoundationEligible(wasteCard)) {
      return { zone: 'waste' };
    }

    if (this.freeCell !== null && this.isAutoFoundationEligible(this.freeCell)) {
      return { zone: 'free' };
    }

    return null;
  }

  private isAutoFoundationEligible(card: Card): boolean {
    if (!this.canStackOnFoundation(card, card.suit)) {
      return false;
    }

    if (card.rank <= 2) {
      return true;
    }

    const nextOppositeRanks = SUITS
      .filter((suit) => isRedSuit(suit) !== isRedSuit(card.suit))
      .filter((suit) => this.foundations[suit].length < 13)
      .map((suit) => this.foundations[suit].length + 1);

    return nextOppositeRanks.length === 0
      || card.rank <= Math.min(...nextOppositeRanks);
  }

  private extract(source: CardSource): Card[] {
    if (source.zone === 'tableau') {
      return this.tableau[source.pile].splice(source.index);
    }

    if (source.zone === 'waste') {
      const card = this.waste.pop();
      return card === undefined ? [] : [card];
    }

    const card = this.freeCell;
    this.freeCell = null;
    return card === null ? [] : [card];
  }
}
