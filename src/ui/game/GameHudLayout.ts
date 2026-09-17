import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';

export interface GameHudLayout {
  readonly home: LayoutBounds;
  readonly undo: LayoutBounds;
  readonly hint: LayoutBounds;
  readonly restart: LayoutBounds;
  readonly newDeal: LayoutBounds;
  readonly metrics: LayoutBounds;
}

export function calculateGameHudLayout(layout: ViewportLayout, newDealVisible = true): GameHudLayout {
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;
  const compact = layout.profile === 'compact-landscape';
  const railX = layout.homeControl.x;
  const railWidth = layout.homeControl.width;
  const controlHeight = layout.homeControl.height;
  const smallGap = compact ? 5 : 10;
  const minimumMetricsHeight = compact ? 90 : controlHeight * 2.8;
  const visibleButtonCount = newDealVisible ? 5 : 4;
  const buttonsAndInnerGaps = visibleButtonCount * controlHeight + smallGap * 2;
  const minimumTrailingGap = compact ? 18 : 24;
  const maxGroupGapWithReadableMetrics = Math.max(0, (layout.boardBounds.height - buttonsAndInnerGaps - minimumMetricsHeight - minimumTrailingGap) / 2);
  const preferredMetricsHeight = controlHeight * (compact ? 2.8 : 3.8);
  const preferredGroupGap = (layout.boardBounds.height - buttonsAndInnerGaps - preferredMetricsHeight - minimumTrailingGap) / 2.8;
  const sectionGap = Math.min(
    compact ? 18 : 54,
    maxGroupGapWithReadableMetrics,
    Math.max(compact ? 8 : 18, preferredGroupGap),
  );

  const fullWidthAt = (y: number): LayoutBounds => ({
    x: railX,
    y,
    width: railWidth,
    height: controlHeight,
  });

  const home = fullWidthAt(layout.homeControl.y);
  const undo = fullWidthAt(home.y + home.height + sectionGap);
  const hint = fullWidthAt(undo.y + undo.height + smallGap);
  const restart = fullWidthAt(hint.y + hint.height + sectionGap);
  const newDeal = fullWidthAt(restart.y + restart.height + smallGap);
  const lastAction = newDealVisible ? newDeal : restart;
  const metricsGap = compact ? 10 : 18;
  const metricsY = lastAction.y + lastAction.height + metricsGap;
  const metricsHeight = Math.max(1, boardBottom - metricsY);

  return {
    home,
    undo,
    hint,
    restart,
    newDeal,
    metrics: {
      x: railX,
      y: metricsY,
      width: railWidth,
      height: metricsHeight,
    },
  };
}
