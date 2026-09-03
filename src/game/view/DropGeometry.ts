export interface RectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const DEFAULT_MINIMUM_OVERLAP_RATIO = 0.25;

function isValidRectangle(rectangle: RectLike): boolean {
  return [
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
  ].every(Number.isFinite)
    && rectangle.width > 0
    && rectangle.height > 0;
}

export function isCommittedCardDrop(
  moving: RectLike,
  target: RectLike,
  minimumOverlapRatio = DEFAULT_MINIMUM_OVERLAP_RATIO,
): boolean {
  if (
    !isValidRectangle(moving)
    || !isValidRectangle(target)
    || !Number.isFinite(minimumOverlapRatio)
    || minimumOverlapRatio < 0
    || minimumOverlapRatio > 1
  ) {
    return false;
  }

  const overlapWidth = Math.max(
    0,
    Math.min(moving.x + moving.width, target.x + target.width)
      - Math.max(moving.x, target.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(moving.y + moving.height, target.y + target.height)
      - Math.max(moving.y, target.y),
  );
  const overlapArea = overlapWidth * overlapHeight;
  const referenceArea = Math.min(
    moving.width * moving.height,
    target.width * target.height,
  );

  return overlapArea / referenceArea >= minimumOverlapRatio;
}
