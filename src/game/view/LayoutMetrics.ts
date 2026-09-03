export const CARD_ASPECT_RATIO = 151 / 108;
export const MIN_CARD_WIDTH = 84;
export const BASE_CARD_WIDTH = 108;
export const MAX_CARD_WIDTH = 180;
export const MIN_TABLEAU_COLUMN_GAP = 18;

const REFERENCE_HEIGHT = 768;
const MIN_EDGE_MARGIN = 14;
const MAX_EDGE_MARGIN = 32;
const MIN_ZONE_GAP = 28;
const MAX_ZONE_GAP = 56;
const PREFERRED_TABLEAU_GAP_RATIO = 0.3;
const MAX_TABLEAU_GAP_RATIO = 0.4;
const MIN_FOUNDATION_GAP = 12;
const MAX_FOUNDATION_GAP = 42;
const MIN_TABLEAU_ROW_GAP = 28;
const MAX_TABLEAU_ROW_GAP = 64;
const MIN_TABLEAU_CARD_GAP = 24;
const MAX_TABLEAU_CARD_GAP = 52;
const MIN_WASTE_GAP = 18;
const MAX_WASTE_GAP = 40;

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

export interface LayoutMetrics {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly foundationX: number;
  readonly foundationY: readonly number[];
  readonly stock: LayoutPoint;
  readonly waste: LayoutPoint;
  readonly tableauX: readonly number[];
  readonly tableauY: number;
  readonly tableauColumnGap: number;
  readonly tableauCardGap: number;
  readonly wasteGap: number;
  readonly utilityDividerX: number;
  readonly compositionBounds: LayoutBounds;
  readonly bottomMargin: number;
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function calculateLayoutMetrics(
  viewportWidth: number,
  viewportHeight: number,
): LayoutMetrics {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? viewportWidth
    : 1;
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : 1;
  const edgeMargin = clamp(MIN_EDGE_MARGIN, width * 0.018, MAX_EDGE_MARGIN);
  const preferredCardWidth = clamp(
    MIN_CARD_WIDTH,
    BASE_CARD_WIDTH * (height / REFERENCE_HEIGHT),
    MAX_CARD_WIDTH,
  );
  const widthFitCardWidth = (
    width
    - edgeMargin * 2
    - MIN_ZONE_GAP
    - MIN_TABLEAU_COLUMN_GAP * 6
  ) / 8;
  const cardWidth = clamp(
    MIN_CARD_WIDTH,
    Math.min(preferredCardWidth, widthFitCardWidth),
    MAX_CARD_WIDTH,
  );
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;
  const zoneGap = clamp(MIN_ZONE_GAP, cardWidth * 0.35, MAX_ZONE_GAP);
  const foundationX = edgeMargin;
  const mainPlayLeft = foundationX + cardWidth + zoneGap;
  const mainPlayRight = width - edgeMargin;
  const mainPlayWidth = Math.max(cardWidth * 7, mainPlayRight - mainPlayLeft);
  const maximumGapFromWidth = (mainPlayWidth - cardWidth * 7) / 6;
  const preferredTableauGap = cardWidth * PREFERRED_TABLEAU_GAP_RATIO;
  const maximumTableauGap = cardWidth * MAX_TABLEAU_GAP_RATIO;
  const tableauColumnGap = clamp(
    MIN_TABLEAU_COLUMN_GAP,
    Math.min(preferredTableauGap, maximumGapFromWidth),
    maximumTableauGap,
  );
  const tableauWidth = cardWidth * 7 + tableauColumnGap * 6;
  const firstTableauX = mainPlayLeft
    + Math.max(0, (mainPlayWidth - tableauWidth) / 2);
  const tableauX = Array.from(
    { length: 7 },
    (_, index) => firstTableauX + index * (cardWidth + tableauColumnGap),
  );
  const tableauRight = tableauX.at(-1)! + cardWidth;
  const compositionX = foundationX;
  const compositionWidth = tableauRight - compositionX;

  const topMargin = clamp(18, height * 0.03, 32);
  const bottomMargin = topMargin;
  const tableauRowGap = clamp(
    MIN_TABLEAU_ROW_GAP,
    height * 0.07,
    MAX_TABLEAU_ROW_GAP,
  );
  const tableauY = topMargin + cardHeight + tableauRowGap;
  const tableauCardGap = clamp(
    MIN_TABLEAU_CARD_GAP,
    cardHeight * (36 / 151),
    MAX_TABLEAU_CARD_GAP,
  );
  const wasteGap = clamp(
    MIN_WASTE_GAP,
    cardWidth * (26 / 108),
    MAX_WASTE_GAP,
  );

  const rawFoundationGap = (
    height - topMargin * 2 - cardHeight * 4
  ) / 3;
  const foundationGap = clamp(
    MIN_FOUNDATION_GAP,
    rawFoundationGap,
    MAX_FOUNDATION_GAP,
  );
  const foundationStackHeight = cardHeight * 4 + foundationGap * 3;
  const foundationStartY = Math.max(
    topMargin,
    (height - foundationStackHeight) / 2,
  );
  const foundationY = Array.from(
    { length: 4 },
    (_, index) => foundationStartY + index * (cardHeight + foundationGap),
  );

  return {
    viewportWidth: width,
    viewportHeight: height,
    cardWidth,
    cardHeight,
    foundationX,
    foundationY,
    stock: { x: tableauX[0], y: topMargin },
    waste: { x: tableauX[1], y: topMargin },
    tableauX,
    tableauY,
    tableauColumnGap,
    tableauCardGap,
    wasteGap,
    utilityDividerX: foundationX + cardWidth + zoneGap / 2,
    compositionBounds: {
      x: compositionX,
      y: 0,
      width: compositionWidth,
      height,
    },
    bottomMargin,
  };
}
