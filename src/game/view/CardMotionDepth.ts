const CARD_MOTION_DEPTH = 3000;

export interface CardDepthTransition {
  readonly active: number;
  readonly resting: number;
}

export function getCardDepthTransition(
  currentDepth: number,
  placementDepth: number,
  animated: boolean,
  positionChanged: boolean,
): CardDepthTransition {
  return {
    active: animated && positionChanged
      ? Math.max(currentDepth, CARD_MOTION_DEPTH)
      : placementDepth,
    resting: placementDepth,
  };
}
