import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';

export interface GameHudLayout {
  readonly home: LayoutBounds;
  readonly newDeal: LayoutBounds;
  readonly undo: LayoutBounds;
  readonly hint: LayoutBounds;
  readonly settings: LayoutBounds;
  readonly metrics: LayoutBounds;
}

export function calculateGameHudLayout(layout: ViewportLayout): GameHudLayout {
  const gap = Math.max(1, layout.newDealControl.y - (layout.homeControl.y + layout.homeControl.height));
  const hint: LayoutBounds = {
    x: layout.undoControl.x,
    y: layout.undoControl.y + layout.undoControl.height + gap,
    width: layout.undoControl.width,
    height: layout.undoControl.height,
  };
  const settings: LayoutBounds = {
    x: hint.x,
    y: hint.y + hint.height + gap,
    width: hint.width,
    height: hint.height,
  };
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;
  const metricsY = settings.y + settings.height + gap;
  return {
    home: layout.homeControl,
    newDeal: layout.newDealControl,
    undo: layout.undoControl,
    hint,
    settings,
    metrics: {
      x: settings.x,
      y: metricsY,
      width: settings.width,
      height: Math.max(1, boardBottom - metricsY),
    },
  };
}
