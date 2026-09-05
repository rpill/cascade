export const CARD_ASPECT_RATIO = 151 / 108;
export const COMPACT_MIN_CARD_WIDTH = 64;
export const STANDARD_MIN_CARD_WIDTH = 84;
export const BASE_CARD_WIDTH = 108;
export const MAX_CARD_WIDTH = 180;

const REFERENCE_HEIGHT = 768;
const COMPACT_MAX_HEIGHT = 620;
const STANDARD_HUD_HEIGHT = 56;
const COMPACT_HUD_HEIGHT = 48;

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
  const hudHeight = compact ? COMPACT_HUD_HEIGHT : STANDARD_HUD_HEIGHT;
  const edgeMargin = clamp(compact ? 8 : 14, safeWidth * 0.018, compact ? 18 : 32);
  const boardGap = compact ? 4 : 8;
  const boardX = insets.left + edgeMargin;
  const boardY = insets.top + hudHeight + boardGap;
  const boardRight = width - insets.right - edgeMargin;
  const boardBottom = height - insets.bottom - edgeMargin;
  const boardWidth = Math.max(1, boardRight - boardX);
  const boardHeight = Math.max(1, boardBottom - boardY);
  const minCardWidth = compact ? COMPACT_MIN_CARD_WIDTH : STANDARD_MIN_CARD_WIDTH;
  const minColumnGap = compact ? 6 : 18;
  const preferredCardWidth = clamp(
    minCardWidth,
    BASE_CARD_WIDTH * (safeHeight / REFERENCE_HEIGHT),
    MAX_CARD_WIDTH,
  );
  const widthFitCardWidth = (boardWidth - minColumnGap * 6) / 7;
  const cardWidth = clamp(
    minCardWidth,
    Math.min(preferredCardWidth, widthFitCardWidth),
    MAX_CARD_WIDTH,
  );
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;
  const topRowY = boardY;
  const foundationGap = clamp(compact ? 5 : 8, cardWidth * 0.08, compact ? 9 : 14);
  const foundationWidth = cardWidth * 4 + foundationGap * 3;
  const foundationStartX = boardRight - foundationWidth;
  const foundations = Array.from({ length: 4 }, (_, index) => ({
    x: foundationStartX + index * (cardWidth + foundationGap),
    y: topRowY,
  }));
  const zoneGap = clamp(compact ? 8 : 16, cardWidth * 0.15, compact ? 14 : 28);
  const stock = { x: boardX, y: topRowY };
  const wasteX = stock.x + cardWidth + zoneGap;
  const wasteRight = foundationStartX - zoneGap;
  const wasteLaneBounds = {
    x: wasteX,
    y: topRowY,
    width: Math.max(cardWidth, wasteRight - wasteX),
    height: cardHeight,
  };
  const maximumGapFromWidth = Math.max(0, (boardWidth - cardWidth * 7) / 6);
  const preferredColumnGap = clamp(
    compact ? 6 : 18,
    cardWidth * (compact ? 0.16 : 0.3),
    compact ? 18 : 40,
  );
  const tableauColumnGap = Math.min(
    preferredColumnGap,
    maximumGapFromWidth,
    cardWidth * 0.4,
  );
  const tableauWidth = cardWidth * 7 + tableauColumnGap * 6;
  const firstTableauX = boardX + Math.max(0, (boardWidth - tableauWidth) / 2);
  const tableauX = Array.from(
    { length: 7 },
    (_, index) => firstTableauX + index * (cardWidth + tableauColumnGap),
  );
  const rowGap = clamp(compact ? 8 : 24, safeHeight * (compact ? 0.02 : 0.04), compact ? 14 : 52);
  const tableauY = topRowY + cardHeight + rowGap;
  const tableauCardGap = clamp(
    compact ? 8 : 20,
    cardHeight * (compact ? 0.15 : 28 / 151),
    compact ? 18 : 46,
  );
  const wasteGap = clamp(compact ? 12 : 18, cardWidth * 0.24, compact ? 24 : 40);
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
