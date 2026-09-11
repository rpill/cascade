export const MAX_RENDER_SCALE = 2;

export interface HiDpiCanvasPlan {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly renderScale: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly cssZoom: number;
}

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, Math.round(value));
}

function normalizeDevicePixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 1;
  return Math.min(MAX_RENDER_SCALE, value);
}

export function planHiDpiCanvas(
  width: number,
  height: number,
  devicePixelRatio: number,
): HiDpiCanvasPlan {
  const logicalWidth = normalizeDimension(width);
  const logicalHeight = normalizeDimension(height);
  const renderScale = normalizeDevicePixelRatio(devicePixelRatio);
  const backingWidth = Math.max(1, Math.round(logicalWidth * renderScale));
  const backingHeight = Math.max(1, Math.round(logicalHeight * renderScale));

  return {
    logicalWidth,
    logicalHeight,
    renderScale,
    backingWidth,
    backingHeight,
    cssZoom: 1 / renderScale,
  };
}
