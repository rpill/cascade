import type { ViewportLayout } from './ViewportLayout.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type BoardSlotKind = 'foundation' | 'stock' | 'tableau';

export interface BoardSlot extends Point {
  readonly kind: BoardSlotKind;
  readonly alpha: number;
}

export function getBoardSlots(layout: ViewportLayout): BoardSlot[] {
  return [
    ...layout.foundations.map((point) => ({
      kind: 'foundation' as const,
      x: point.x,
      y: point.y,
      alpha: 0.48,
    })),
    {
      kind: 'stock' as const,
      x: layout.stock.x,
      y: layout.stock.y,
      alpha: 0.48,
    },
    ...layout.tableauX.map((x) => ({
      kind: 'tableau' as const,
      x,
      y: layout.tableauY,
      alpha: 0.30,
    })),
  ];
}


export function getSlotFrameAlpha(
  layout: Pick<ViewportLayout, 'profile'>,
  slot: Pick<BoardSlot, 'alpha'>,
): number {
  return layout.profile === 'compact-landscape' ? 0.78 : slot.alpha;
}

export function tableauCardY(
  layout: ViewportLayout,
  cardCount: number,
  index: number,
): number {
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;
  const available = boardBottom
    - layout.tableauY
    - layout.cardHeight
    - layout.bottomMargin;
  const gap = cardCount <= 1
    ? layout.tableauCardGap
    : Math.min(
      layout.tableauCardGap,
      Math.max(0, available / (cardCount - 1)),
    );

  return layout.tableauY + index * gap;
}

export function wasteCardX(
  layout: ViewportLayout,
  cardCount: number,
  index: number,
): number {
  const available = Math.max(0, layout.wasteLaneBounds.width - layout.cardWidth);
  const gap = cardCount <= 1
    ? layout.wasteGap
    : Math.min(layout.wasteGap, available / (cardCount - 1));

  return layout.wasteLaneBounds.x + index * gap;
}
