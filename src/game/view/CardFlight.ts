import type { Point } from './layout.ts';

const MIDPOINT_ARC_OFFSET = 18;

export function getCardFlightPoint(
  start: Point,
  end: Point,
  progress: number,
): Point {
  const clamped = Math.max(0, Math.min(1, progress));
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return { ...end };
  }

  let normalX = deltaY / length;
  let normalY = -deltaX / length;

  if (normalY > 0) {
    normalX *= -1;
    normalY *= -1;
  }

  const controlOffset = MIDPOINT_ARC_OFFSET * 2;
  const control = {
    x: (start.x + end.x) / 2 + normalX * controlOffset,
    y: (start.y + end.y) / 2 + normalY * controlOffset,
  };
  const inverse = 1 - clamped;

  return {
    x: inverse * inverse * start.x
      + 2 * inverse * clamped * control.x
      + clamped * clamped * end.x,
    y: inverse * inverse * start.y
      + 2 * inverse * clamped * control.y
      + clamped * clamped * end.y,
  };
}
