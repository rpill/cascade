import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyLayout, computeMonthNavigationBounds } from '../src/ui/daily/DailyCalendarLayout.ts';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import { computeSceneShellLayout } from '../src/ui/layout/SceneShellLayout.ts';

test('mobile month navigation keeps visible padding from every calendar-header edge', () => {
  const viewport = resolveUiViewport({ width: 725, height: 471, touchPrimary: true });
  const content = computeSceneShellLayout(viewport).content;
  const layout = computeDailyLayout(viewport, content);
  const nav = computeMonthNavigationBounds(layout.calendarHeader, viewport);

  assert.equal(layout.summary.x, content.x);
  assert.equal(layout.calendar.x + layout.calendar.width, content.x + content.width);

  assert.ok(nav.previous.x > layout.calendarHeader.x + 6);
  assert.ok(nav.previous.y > layout.calendarHeader.y + 4);
  assert.ok(nav.next.x + nav.next.width < layout.calendarHeader.x + layout.calendarHeader.width - 6);
  assert.ok(nav.next.y + nav.next.height < layout.calendarHeader.y + layout.calendarHeader.height - 4);
});
