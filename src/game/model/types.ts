export const SUITS = [
  'clubs',
  'diamonds',
  'hearts',
  'spades',
] as const;

export type Suit = (typeof SUITS)[number];
export type CardColor = 'black' | 'red';

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: number;
  readonly color: CardColor;
}

export type CardSource =
  | { readonly zone: 'tableau'; readonly pile: number; readonly index: number }
  | { readonly zone: 'waste' }
  | { readonly zone: 'free' };

export type MoveTarget =
  | { readonly zone: 'tableau'; readonly pile: number }
  | { readonly zone: 'foundation'; readonly suit: Suit }
  | { readonly zone: 'free' };

export type Foundations = Record<Suit, Card[]>;

export interface Deal {
  readonly seed: number;
  readonly tableau: Card[][];
  readonly stock: Card[];
  readonly waste?: Card[];
  readonly freeCell?: Card | null;
  readonly foundations?: Partial<Foundations>;
}
