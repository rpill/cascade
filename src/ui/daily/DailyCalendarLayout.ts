import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';

export interface DailyLayout {
  readonly header: UiRect;
  readonly summary: UiRect;
  readonly calendar: UiRect;
  readonly calendarHeader: UiRect;
  readonly calendarGrid: UiRect;
  readonly home: UiRect;
}

export function computeDailyLayout(viewport: ResolvedUiViewport): DailyLayout {
  const m = viewport.safeMargin;
  const gap = Math.max(10 * viewport.uiScale, m * 0.55);
  const headerHeight = Math.max(viewport.minTouchTarget, viewport.height * (viewport.profile === 'desktop' ? 0.075 : 0.12));
  const contentY = m + headerHeight + gap;
  const contentHeight = viewport.height - contentY - m;
  const availableWidth = viewport.width - m * 2 - gap;
  const summaryRatio = viewport.profile === 'desktop' ? 0.34 : 0.38;
  const summaryWidth = availableWidth * summaryRatio;
  const calendarWidth = availableWidth - summaryWidth;
  const summary: UiRect = { x: m, y: contentY, width: summaryWidth, height: contentHeight };
  const calendar: UiRect = { x: m + summaryWidth + gap, y: contentY, width: calendarWidth, height: contentHeight };
  const calendarHeaderHeight = Math.max(viewport.minTouchTarget, calendar.height * 0.13);
  return {
    header: { x: m, y: m, width: viewport.width - m * 2, height: headerHeight },
    summary,
    calendar,
    calendarHeader: { x: calendar.x, y: calendar.y, width: calendar.width, height: calendarHeaderHeight },
    calendarGrid: {
      x: calendar.x + calendar.width * 0.05,
      y: calendar.y + calendarHeaderHeight + calendar.height * 0.08,
      width: calendar.width * 0.90,
      height: calendar.height - calendarHeaderHeight - calendar.height * 0.14,
    },
    home: { x: m, y: m, width: headerHeight, height: headerHeight },
  };
}

export function computeCalendarCellBounds(grid: UiRect, count = 42): readonly UiRect[] {
  const columns = 7;
  const rows = Math.ceil(count / columns);
  const columnGap = Math.max(2, grid.width * 0.008);
  const rowGap = Math.max(2, grid.height * 0.012);
  const width = (grid.width - columnGap * (columns - 1)) / columns;
  const height = (grid.height - rowGap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: grid.x + (index % columns) * (width + columnGap),
    y: grid.y + Math.floor(index / columns) * (height + rowGap),
    width,
    height,
  }));
}
