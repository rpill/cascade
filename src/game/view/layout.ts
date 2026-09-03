import type { LayoutMetrics } from './LayoutMetrics.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type BoardSlotKind = 'foundation' | 'stock' | 'tableau';

export interface BoardSlot extends Point {
  readonly kind: BoardSlotKind;
  readonly alpha: number;
}

export function getBoardSlots(metrics: LayoutMetrics): BoardSlot[] {
  return [
    ...metrics.foundationY.map((y) => ({
      kind: 'foundation' as const,
      x: metrics.foundationX,
      y,
      alpha: 0.32,
    })),
    {
      kind: 'stock' as const,
      x: metrics.stock.x,
      y: metrics.stock.y,
      alpha: 0.32,
    },
    ...metrics.tableauX.map((x) => ({
      kind: 'tableau' as const,
      x,
      y: metrics.tableauY,
      alpha: 0.16,
    })),
  ];
}

export function tableauCardY(
  metrics: LayoutMetrics,
  cardCount: number,
  index: number,
): number {
  const available = metrics.viewportHeight
    - metrics.tableauY
    - metrics.cardHeight
    - metrics.bottomMargin;
  const gap = cardCount <= 1
    ? metrics.tableauCardGap
    : Math.min(
      metrics.tableauCardGap,
      Math.max(0, available / (cardCount - 1)),
    );

  return metrics.tableauY + index * gap;
}

export function wasteCardX(
  metrics: LayoutMetrics,
  cardCount: number,
  index: number,
): number {
  const compositionRight = metrics.compositionBounds.x
    + metrics.compositionBounds.width;
  const available = compositionRight - metrics.waste.x - metrics.cardWidth;
  const gap = cardCount <= 1
    ? metrics.wasteGap
    : Math.min(metrics.wasteGap, Math.max(0, available / (cardCount - 1)));

  return metrics.waste.x + index * gap;
}
