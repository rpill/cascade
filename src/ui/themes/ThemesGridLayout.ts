import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';

export interface ThemesGridLayout {
  readonly columns: 2 | 3;
  readonly back: UiRect;
  readonly title: UiRect;
  readonly coinPill: UiRect;
  readonly coinPack: UiRect;
  readonly content: UiRect;
  readonly cards: readonly UiRect[];
  readonly contentHeight: number;
}

export function computeThemesGridLayout(viewport: ResolvedUiViewport, cardCount: number): ThemesGridLayout {
  const margin = viewport.safeMargin;
  const touch = viewport.minTouchTarget;
  const mobile = viewport.profile === 'mobile-landscape';
  const headerHeight = Math.max(touch, mobile ? 48 * viewport.uiScale : 64 * viewport.uiScale);
  const gap = Math.max(8 * viewport.uiScale, margin * 0.42);
  const back: UiRect = { x: margin, y: margin, width: touch, height: headerHeight };
  const coinPillWidth = Math.max(96 * viewport.uiScale, touch * 2.2);
  const coinPackWidth = Math.max(130 * viewport.uiScale, touch * 2.9);
  const coinPill: UiRect = {
    x: viewport.width - margin - coinPillWidth,
    y: margin,
    width: coinPillWidth,
    height: headerHeight,
  };
  const coinPack: UiRect = {
    x: coinPill.x - gap - coinPackWidth,
    y: margin,
    width: coinPackWidth,
    height: headerHeight,
  };
  const title: UiRect = {
    x: back.x + back.width + gap,
    y: margin,
    width: Math.max(touch * 2, coinPack.x - gap - (back.x + back.width + gap)),
    height: headerHeight,
  };
  const contentY = margin + headerHeight + gap;
  const content: UiRect = {
    x: margin,
    y: contentY,
    width: viewport.width - margin * 2,
    height: Math.max(touch, viewport.height - contentY - margin),
  };
  const columns: 2 | 3 = mobile ? 2 : 3;
  const columnGap = gap;
  const rowGap = gap;
  const cardWidth = (content.width - columnGap * (columns - 1)) / columns;
  const cardHeight = mobile
    ? Math.max(touch * 2.65, Math.min(content.height * 0.62, 178 * viewport.uiScale))
    : Math.max(touch * 3.4, Math.min(content.height * 0.34, 250 * viewport.uiScale));
  const cards: UiRect[] = [];
  const rows = Math.ceil(Math.max(0, cardCount) / columns);
  for (let index = 0; index < cardCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    cards.push({
      x: column * (cardWidth + columnGap),
      y: row * (cardHeight + rowGap),
      width: cardWidth,
      height: cardHeight,
    });
  }
  const contentHeight = rows === 0 ? content.height : Math.max(content.height, rows * cardHeight + Math.max(0, rows - 1) * rowGap);
  return { columns, back, title, coinPill, coinPack, content, cards, contentHeight };
}
