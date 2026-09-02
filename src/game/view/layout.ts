export const GAME_WIDTH = 1152;
export const GAME_HEIGHT = 768;

export const CARD_WIDTH = 108;
export const CARD_HEIGHT = 151;

export const FOUNDATION_X = 28;
export const FOUNDATION_Y = [24, 205, 386, 567] as const;

export const STOCK_X = 194;
export const STOCK_Y = 62;
export const WASTE_X = 328;
export const TABLEAU_Y = 260;
export const TABLEAU_X = Array.from(
  { length: 7 },
  (_, index) => STOCK_X + index * 134,
);

export const TABLEAU_GAP = 36;
export const WASTE_GAP = 26;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function tableauCardY(cardCount: number, index: number): number {
  const available = GAME_HEIGHT - TABLEAU_Y - CARD_HEIGHT - 18;
  const gap = cardCount <= 1
    ? TABLEAU_GAP
    : Math.min(TABLEAU_GAP, available / (cardCount - 1));

  return TABLEAU_Y + index * gap;
}

export function wasteCardX(cardCount: number, index: number): number {
  const available = GAME_WIDTH - WASTE_X - CARD_WIDTH - 20;
  const gap = cardCount <= 1
    ? WASTE_GAP
    : Math.min(WASTE_GAP, available / (cardCount - 1));

  return WASTE_X + index * gap;
}
