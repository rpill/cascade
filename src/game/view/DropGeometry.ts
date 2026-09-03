export interface RectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const DEFAULT_INSET = 8;

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
  inset = DEFAULT_INSET,
): boolean {
  if (
    !isValidRectangle(moving)
    || !isValidRectangle(target)
    || !Number.isFinite(inset)
    || inset < 0
    || target.width <= inset * 2
    || target.height <= inset * 2
  ) {
    return false;
  }

  const centerX = moving.x + moving.width / 2;
  const centerY = moving.y + moving.height / 2;

  return centerX > target.x + inset
    && centerX < target.x + target.width - inset
    && centerY > target.y + inset
    && centerY < target.y + target.height - inset;
}
