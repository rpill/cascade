export type CardMotionKind = 'stock' | 'foundation' | 'player' | 'undo';

const CARD_MOTION_DURATION: Record<CardMotionKind, number> = {
  stock: 260,
  foundation: 230,
  player: 110,
  undo: 110,
};

const FOUNDATION_STEP_DELAY = 250;

export function getCardMotionDuration(kind: CardMotionKind): number {
  return CARD_MOTION_DURATION[kind];
}

export function getFoundationStepDelay(): number {
  return FOUNDATION_STEP_DELAY;
}

export function getStockFlightOriginY(
  stockY: number,
  layerOffsets: readonly number[],
): number {
  return stockY + (layerOffsets[layerOffsets.length - 1] ?? 0);
}
