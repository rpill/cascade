import type { SurfaceInsets } from '../../theme/ThemeDefinition.ts';

export interface SurfaceSlice {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Corners scale uniformly. Only quiet material/straight border strips stretch. */
export function getSurfaceSlices(
  width: number, height: number, sourceWidth: number, sourceHeight: number,
  insets: SurfaceInsets,
): SurfaceSlice[] {
  if (insets.left <= 0 || insets.right <= 0 || insets.top <= 0 || insets.bottom <= 0
    || insets.left + insets.right >= sourceWidth || insets.top + insets.bottom >= sourceHeight) {
    throw new Error('Surface slices must leave a positive center region.');
  }
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const sx = [0, insets.left, sourceWidth - insets.right, sourceWidth];
  const sy = [0, insets.top, sourceHeight - insets.bottom, sourceHeight];
  const x = [0, insets.left * scale, width - insets.right * scale, width];
  const y = [0, insets.top * scale, height - insets.bottom * scale, height];
  return Array.from({length: 9}, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      sx: sx[column], sy: sy[row], sw: sx[column+1]-sx[column], sh: sy[row+1]-sy[row],
      x: x[column], y: y[row], width: x[column+1]-x[column], height: y[row+1]-y[row],
    };
  });
}
