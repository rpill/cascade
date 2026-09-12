export const CARD_ASPECT_RATIO = 151 / 108;
export const COMPACT_MIN_CARD_WIDTH = 50;
export const STANDARD_MIN_CARD_WIDTH = 84;
export const BASE_CARD_WIDTH = 108;
export const MAX_CARD_WIDTH = 180;

const REFERENCE_HEIGHT = 768;
const COMPACT_MAX_HEIGHT = 620;
const STANDARD_HUD_HEIGHT = 56;
const COMPACT_HUD_HEIGHT = 48;
const COMPACT_TOP_HUD_HEIGHT = 8;

export type LayoutProfile = 'standard' | 'compact-landscape';

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface LayoutPoint {
  readonly x: number;
  readonly y: number;
}

export interface LayoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportLayout {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly profile: LayoutProfile;
  readonly safeArea: SafeAreaInsets;
  readonly hudBounds: LayoutBounds;
  readonly boardBounds: LayoutBounds;
  readonly compositionBounds: LayoutBounds;
  readonly foundationRailBounds: LayoutBounds;
  readonly mainPlayBounds: LayoutBounds;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly stock: LayoutPoint;
  readonly wasteLaneBounds: LayoutBounds;
  readonly foundations: readonly LayoutPoint[];
  readonly tableauX: readonly number[];
  readonly tableauY: number;
  readonly tableauColumnGap: number;
  readonly tableauCardGap: number;
  readonly wasteGap: number;
  readonly bottomMargin: number;
}

export const ZERO_SAFE_AREA: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeInset(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateViewportLayout(
  viewportWidth: number,
  viewportHeight: number,
  safeArea: SafeAreaInsets = ZERO_SAFE_AREA,
): ViewportLayout {
  const width = normalizeDimension(viewportWidth);
  const height = normalizeDimension(viewportHeight);
  const insets = {
    top: normalizeInset(safeArea.top),
    right: normalizeInset(safeArea.right),
    bottom: normalizeInset(safeArea.bottom),
    left: normalizeInset(safeArea.left),
  };
  const safeWidth = Math.max(1, width - insets.left - insets.right);
  const safeHeight = Math.max(1, height - insets.top - insets.bottom);
  const profile: LayoutProfile = safeHeight <= COMPACT_MAX_HEIGHT
    ? 'compact-landscape'
    : 'standard';
  const compact = profile === 'compact-landscape';
  const hudHeight = compact ? COMPACT_TOP_HUD_HEIGHT : STANDARD_HUD_HEIGHT;
  const edgeMargin = clamp(
    compact ? 6 : 14,
    safeWidth * (compact ? 0.012 : 0.018),
    compact ? 12 : 32,
  );
  const boardGap = compact ? 4 : 8;
  const compactLeftRail = 0;
  const compactRightRail = compact ? clamp(140, safeWidth * 0.17, 176) : 0;
  const boardX = insets.left + edgeMargin + compactLeftRail;
  const boardY = insets.top + hudHeight + boardGap;
  const boardRight = width - insets.right - edgeMargin - compactRightRail;
  const boardBottom = height - insets.bottom - edgeMargin;
  const boardWidth = Math.max(1, boardRight - boardX);
  const boardHeight = Math.max(1, boardBottom - boardY);

  const minimumFoundationGap = compact ? 4 : 12;
  const minimumZoneGap = compact ? 8 : 28;
  const minimumColumnGap = compact ? 6 : 18;
  const preferredScaleHeight = compact
    ? safeHeight + (COMPACT_HUD_HEIGHT - COMPACT_TOP_HUD_HEIGHT) + 24
    : safeHeight;
  const preferredCardWidth = Math.min(
    MAX_CARD_WIDTH,
    BASE_CARD_WIDTH * (preferredScaleHeight / REFERENCE_HEIGHT),
  );
  const widthFitCardWidth = Math.max(
    1,
    (boardWidth - minimumZoneGap - minimumColumnGap * 6) / 8,
  );
  const foundationFitCardWidth = Math.max(
    1,
    (boardHeight - minimumFoundationGap * 3) / (CARD_ASPECT_RATIO * 4),
  );
  const cardWidth = Math.max(
    1,
    Math.min(
      preferredCardWidth,
      widthFitCardWidth,
      foundationFitCardWidth,
      MAX_CARD_WIDTH,
    ),
  );
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;

  const zoneGap = clamp(
    compact ? 8 : 28,
    cardWidth * (compact ? 0.18 : 0.35),
    compact ? 16 : 56,
  );
  const maximumMainPlayWidth = Math.max(
    cardWidth * 7,
    boardWidth - cardWidth - zoneGap,
  );
  const maximumGapFromWidth = Math.max(
    0,
    (maximumMainPlayWidth - cardWidth * 7) / 6,
  );
  const preferredColumnGap = cardWidth * (compact ? 0.26 : 0.3);
  const tableauColumnGap = Math.min(
    preferredColumnGap,
    maximumGapFromWidth,
    cardWidth * 0.4,
  );
  const tableauWidth = cardWidth * 7 + tableauColumnGap * 6;
  const compositionWidth = cardWidth + zoneGap + tableauWidth;
  const compositionX = boardX + Math.max(0, (boardWidth - compositionWidth) / 2);
  const mainPlayX = compositionX + cardWidth + zoneGap;

  const maximumFoundationGap = Math.max(
    0,
    (boardHeight - cardHeight * 4) / 3,
  );
  const preferredFoundationGap = clamp(
    compact ? 4 : 12,
    cardHeight * (compact ? 0.07 : 0.08),
    compact ? 10 : 28,
  );
  const foundationGap = Math.min(preferredFoundationGap, maximumFoundationGap);
  const foundationStackHeight = cardHeight * 4 + foundationGap * 3;
  const foundationStartY = boardY + Math.max(0, (boardHeight - foundationStackHeight) / 2);
  const foundations = Array.from({ length: 4 }, (_, index) => ({
    x: compositionX,
    y: foundationStartY + index * (cardHeight + foundationGap),
  }));

  const mainPlayTopOffset = compact ? clamp(10, safeHeight * 0.025, 14) : 0;
  const mainPlayY = boardY + mainPlayTopOffset;
  const mainPlayBounds = {
    x: mainPlayX,
    y: mainPlayY,
    width: tableauWidth,
    height: Math.max(1, boardHeight - mainPlayTopOffset),
  };
  const stock = { x: mainPlayX, y: mainPlayY };
  const wasteZoneGap = clamp(
    compact ? 8 : 16,
    cardWidth * 0.15,
    compact ? 14 : 28,
  );
  const wasteX = stock.x + cardWidth + wasteZoneGap;
  const mainPlayRight = mainPlayBounds.x + mainPlayBounds.width;
  const wasteLaneBounds = {
    x: wasteX,
    y: mainPlayY,
    width: Math.max(cardWidth, mainPlayRight - wasteX),
    height: cardHeight,
  };

  const tableauX = Array.from(
    { length: 7 },
    (_, index) => mainPlayX + index * (cardWidth + tableauColumnGap),
  );
  const rowGap = clamp(
    compact ? 8 : 24,
    safeHeight * (compact ? 0.02 : 0.04),
    compact ? 14 : 52,
  );
  const tableauY = mainPlayY + cardHeight + rowGap;
  const tableauCardGap = clamp(
    compact ? 18 : 20,
    cardHeight * (compact ? 0.25 : 28 / 151),
    compact ? 28 : 46,
  );
  const wasteGap = clamp(
    compact ? 10 : 18,
    cardWidth * 0.24,
    compact ? 24 : 40,
  );
  const bottomMargin = compact ? 8 : 18;

  return {
    viewportWidth: width,
    viewportHeight: height,
    profile,
    safeArea: insets,
    hudBounds: {
      x: insets.left,
      y: insets.top,
      width: safeWidth,
      height: hudHeight,
    },
    boardBounds: {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
    },
    compositionBounds: {
      x: compositionX,
      y: boardY,
      width: compositionWidth,
      height: boardHeight,
    },
    foundationRailBounds: {
      x: compositionX,
      y: foundationStartY,
      width: cardWidth,
      height: foundationStackHeight,
    },
    mainPlayBounds,
    cardWidth,
    cardHeight,
    stock,
    wasteLaneBounds,
    foundations,
    tableauX,
    tableauY,
    tableauColumnGap,
    tableauCardGap,
    wasteGap,
    bottomMargin,
  };
}

function scaleNumber(value: number, scale: number): number {
  return value * scale;
}

function scalePoint(point: LayoutPoint, scale: number): LayoutPoint {
  return {
    x: scaleNumber(point.x, scale),
    y: scaleNumber(point.y, scale),
  };
}

function scaleBounds(bounds: LayoutBounds, scale: number): LayoutBounds {
  return {
    x: scaleNumber(bounds.x, scale),
    y: scaleNumber(bounds.y, scale),
    width: scaleNumber(bounds.width, scale),
    height: scaleNumber(bounds.height, scale),
  };
}

export function scaleViewportLayout(
  layout: ViewportLayout,
  renderScale: number,
): ViewportLayout {
  const scale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
  if (scale === 1) return layout;

  return {
    viewportWidth: scaleNumber(layout.viewportWidth, scale),
    viewportHeight: scaleNumber(layout.viewportHeight, scale),
    profile: layout.profile,
    safeArea: {
      top: scaleNumber(layout.safeArea.top, scale),
      right: scaleNumber(layout.safeArea.right, scale),
      bottom: scaleNumber(layout.safeArea.bottom, scale),
      left: scaleNumber(layout.safeArea.left, scale),
    },
    hudBounds: scaleBounds(layout.hudBounds, scale),
    boardBounds: scaleBounds(layout.boardBounds, scale),
    compositionBounds: scaleBounds(layout.compositionBounds, scale),
    foundationRailBounds: scaleBounds(layout.foundationRailBounds, scale),
    mainPlayBounds: scaleBounds(layout.mainPlayBounds, scale),
    cardWidth: scaleNumber(layout.cardWidth, scale),
    cardHeight: scaleNumber(layout.cardHeight, scale),
    stock: scalePoint(layout.stock, scale),
    wasteLaneBounds: scaleBounds(layout.wasteLaneBounds, scale),
    foundations: layout.foundations.map((point) => scalePoint(point, scale)),
    tableauX: layout.tableauX.map((x) => scaleNumber(x, scale)),
    tableauY: scaleNumber(layout.tableauY, scale),
    tableauColumnGap: scaleNumber(layout.tableauColumnGap, scale),
    tableauCardGap: scaleNumber(layout.tableauCardGap, scale),
    wasteGap: scaleNumber(layout.wasteGap, scale),
    bottomMargin: scaleNumber(layout.bottomMargin, scale),
  };
}
