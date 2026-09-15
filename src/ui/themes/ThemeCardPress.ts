export interface PointerPoint {
  readonly x: number;
  readonly y: number;
}

export const THEME_CARD_PRESS_DRAG_THRESHOLD = 10;

export function isPressGesture(
  start: PointerPoint,
  end: PointerPoint,
  threshold = THEME_CARD_PRESS_DRAG_THRESHOLD,
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dx * dx + dy * dy <= threshold * threshold;
}
