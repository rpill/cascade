import type { ResolvedUiViewport } from './UiViewport.ts';

export interface UiRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HomeLayout {
  readonly brand: UiRect;
  readonly dashboard: UiRect;
  readonly continueCard: UiRect;
  readonly continuePrimary: UiRect;
  readonly newDealRow: UiRect;
  readonly difficultySelector: UiRect;
  readonly newDealAction: UiRect;
  readonly daily: UiRect;
  readonly mastery: UiRect;
  readonly leaders: UiRect;
  readonly serviceActions: UiRect;
}

function rect(x: number, y: number, width: number, height: number): UiRect {
  return { x, y, width, height };
}

export function computeHomeLayout(viewport: ResolvedUiViewport): HomeLayout {
  const backing = viewport.minTouchTarget / 44;
  if (backing !== 1) {
    const logical = computeHomeLayout({ ...viewport, width: viewport.width / backing, height: viewport.height / backing, safeMargin: viewport.safeMargin / backing, uiScale: viewport.uiScale / backing, minTouchTarget: 44 });
    return Object.fromEntries(Object.entries(logical).map(([key, r]) => [key, { x: r.x * backing, y: r.y * backing, width: r.width * backing, height: r.height * backing }])) as unknown as HomeLayout;
  }
  const { width, height, safeMargin, profile } = viewport;
  const gap = profile === 'desktop'
    ? Math.max(24, Math.round(width * 0.016))
    : Math.max(10, Math.round(width * 0.012));
  const usableWidth = Math.max(1, width - safeMargin * 2 - gap);
  const brandWeight = 31;
  const dashboardWeight = 69;
  const weightTotal = brandWeight + dashboardWeight;
  const brandWidth = usableWidth * brandWeight / weightTotal;
  const dashboardWidth = usableWidth - brandWidth;
  const mobile = profile === 'mobile-landscape';
  const brand = mobile
    ? rect(safeMargin, safeMargin, Math.min(width * 0.38, 350), 44)
    : rect(safeMargin, safeMargin, brandWidth, height - safeMargin * 2);
  const dashboardHeight = mobile ? height - safeMargin * 2 : Math.min(height - safeMargin * 2, height * 0.82);
  const dashboard = mobile
    ? rect(safeMargin, safeMargin, width - safeMargin * 2, dashboardHeight)
    : rect(brand.x + brand.width + gap, (height - dashboardHeight) / 2, dashboardWidth, dashboardHeight);

  const innerGap = profile === 'desktop'
    ? Math.max(16, Math.round(height * 0.018))
    : Math.max(8, Math.round(height * 0.014));
  const serviceHeight = Math.max(viewport.minTouchTarget, profile === 'desktop' ? 48 : 44);
  const serviceWidth = serviceHeight * 2 + innerGap;
  const serviceActions = rect(dashboard.x + dashboard.width - serviceWidth, dashboard.y, serviceWidth, serviceHeight);

  const contentTop = dashboard.y + serviceHeight + innerGap;
  const contentBottom = dashboard.y + dashboard.height;
  const contentHeight = Math.max(1, contentBottom - contentTop);
  const cardsHeight = Math.max(1, contentHeight - innerGap);
  const continueHeight = Math.max(cardsHeight * 0.54, viewport.minTouchTarget * 2 + 10);
  const pairHeight = cardsHeight - continueHeight;

  const continueCard = rect(dashboard.x, contentTop, dashboard.width, continueHeight);
  const standardGap = Math.max(6, Math.min(innerGap, viewport.minTouchTarget * 0.22));
  const newDealHeight = Math.max(
    viewport.minTouchTarget,
    Math.min(continueCard.height * 0.34, viewport.minTouchTarget * 1.45),
  );
  const continuePrimary = rect(
    continueCard.x,
    continueCard.y,
    continueCard.width,
    Math.max(viewport.minTouchTarget, continueCard.height - newDealHeight - standardGap),
  );
  const newDealRow = rect(
    continueCard.x,
    continuePrimary.y + continuePrimary.height + standardGap,
    continueCard.width,
    Math.max(viewport.minTouchTarget, continueCard.y + continueCard.height - (continuePrimary.y + continuePrimary.height + standardGap)),
  );
  const actionGap = Math.max(6, standardGap);
  const newDealActionWidth = Math.max(viewport.minTouchTarget * 2.7, newDealRow.width * 0.27);
  const newDealAction = rect(
    newDealRow.x + newDealRow.width - newDealActionWidth,
    newDealRow.y,
    newDealActionWidth,
    newDealRow.height,
  );
  const difficultySelector = rect(
    newDealRow.x,
    newDealRow.y,
    Math.max(1, newDealRow.width - newDealActionWidth - actionGap),
    newDealRow.height,
  );

  const pairY = continueCard.y + continueCard.height + innerGap;
  const pairGap = innerGap;
  const pairWidth = (dashboard.width - pairGap * 2) / 3;
  const daily = rect(dashboard.x, pairY, pairWidth, pairHeight);
  const mastery = rect(daily.x + daily.width + pairGap, pairY, pairWidth, pairHeight);
  const leaders = rect(mastery.x + mastery.width + pairGap, pairY, pairWidth, pairHeight);

  return {
    brand,
    dashboard,
    continueCard,
    continuePrimary,
    newDealRow,
    difficultySelector,
    newDealAction,
    daily,
    mastery,
    leaders,
    serviceActions,
  };
}
