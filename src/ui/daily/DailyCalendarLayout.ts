import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';

export interface DailyLayout {
  readonly summary: UiRect;
  readonly calendar: UiRect;
  readonly calendarHeader: UiRect;
  readonly calendarGrid: UiRect;
}

export function computeDailyLayout(viewport: ResolvedUiViewport, content: UiRect): DailyLayout {
  const gap = Math.max(10 * viewport.uiScale, viewport.safeMargin * 0.55);
  const contentY = content.y;
  const contentHeight = content.height;
  const availableWidth = content.width - gap;
  const summaryRatio = viewport.profile === 'desktop' ? 0.34 : 0.38;
  const summaryWidth = availableWidth * summaryRatio;
  const calendarWidth = availableWidth - summaryWidth;
  const summary: UiRect = { x: content.x, y: contentY, width: summaryWidth, height: contentHeight };
  const calendar: UiRect = { x: content.x + summaryWidth + gap, y: contentY, width: calendarWidth, height: contentHeight };
  const calendarHeaderHeight = Math.max(viewport.minTouchTarget, calendar.height * 0.13);
  return {
    summary,
    calendar,
    calendarHeader: { x: calendar.x, y: calendar.y, width: calendar.width, height: calendarHeaderHeight },
    calendarGrid: {
      x: calendar.x + calendar.width * 0.05,
      y: calendar.y + calendarHeaderHeight + calendar.height * 0.08,
      width: calendar.width * 0.90,
      height: calendar.height - calendarHeaderHeight - calendar.height * 0.14,
    },
  };
}


export interface MonthNavigationBounds {
  readonly previous: UiRect;
  readonly next: UiRect;
}

export function computeMonthNavigationBounds(
  header: UiRect,
  viewport: ResolvedUiViewport,
): MonthNavigationBounds {
  const css = viewport.minTouchTarget / 44;
  const sideInset = Math.max(12 * css, header.width * (viewport.profile === 'desktop' ? 0.035 : 0.055));
  const verticalInset = Math.max(6 * css, header.height * (viewport.profile === 'desktop' ? 0.10 : 0.14));
  const availableHeight = Math.max(1, header.height - verticalInset * 2);
  const visibleSize = Math.max(30 * css, Math.min(availableHeight, 54 * viewport.uiScale));
  const y = header.y + (header.height - visibleSize) / 2;
  return {
    previous: { x: header.x + sideInset, y, width: visibleSize, height: visibleSize },
    next: { x: header.x + header.width - sideInset - visibleSize, y, width: visibleSize, height: visibleSize },
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
