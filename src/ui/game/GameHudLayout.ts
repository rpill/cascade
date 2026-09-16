import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';

export interface GameHudLayout {
  readonly home: LayoutBounds;
  readonly newDeal: LayoutBounds;
  readonly restart: LayoutBounds;
  readonly undo: LayoutBounds;
  readonly hint: LayoutBounds;
  readonly settings: LayoutBounds;
  readonly metrics: LayoutBounds;
}

export function calculateGameHudLayout(layout: ViewportLayout, newDealVisible = true): GameHudLayout {
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;

  if (layout.profile === 'compact-landscape') {
    const gap = 5;
    const buttonCount = newDealVisible ? 6 : 5;
    const reservedMetricsHeight = 96;
    const availableHeight = layout.boardBounds.height;
    const controlHeight = Math.max(
      34,
      Math.min(
        layout.homeControl.height,
        (availableHeight - reservedMetricsHeight) / buttonCount - gap,
      ),
    );
    const controlAt = (index: number): LayoutBounds => ({
      x: layout.homeControl.x,
      y: layout.homeControl.y + index * (controlHeight + gap),
      width: layout.homeControl.width,
      height: controlHeight,
    });

    const home = controlAt(0);
    const newDeal = controlAt(1);
    const restart = controlAt(newDealVisible ? 2 : 1);
    const undo = controlAt(newDealVisible ? 3 : 2);
    const hint = controlAt(newDealVisible ? 4 : 3);
    const settings = controlAt(newDealVisible ? 5 : 4);
    const metricsY = settings.y + settings.height + gap;

    return {
      home,
      newDeal,
      restart,
      undo,
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

  const gap = Math.max(1, layout.newDealControl.y - (layout.homeControl.y + layout.homeControl.height));
  const restart: LayoutBounds = newDealVisible ? layout.undoControl : layout.newDealControl;
  const undo: LayoutBounds = {
    x: restart.x,
    y: restart.y + restart.height + gap,
    width: restart.width,
    height: restart.height,
  };
  const hint: LayoutBounds = {
    x: undo.x,
    y: undo.y + undo.height + gap,
    width: undo.width,
    height: undo.height,
  };
  const settings: LayoutBounds = {
    x: hint.x,
    y: hint.y + hint.height + gap,
    width: hint.width,
    height: hint.height,
  };
  const metricsY = settings.y + settings.height + gap;
  return {
    home: layout.homeControl,
    newDeal: layout.newDealControl,
    restart,
    undo,
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
