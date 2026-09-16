import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';

export interface ThemesGridLayout {
  readonly columns: 3;
  readonly content: UiRect;
  readonly cards: readonly UiRect[];
  readonly contentHeight: number;
}

export function computeThemesGridLayout(viewport: ResolvedUiViewport, content: UiRect, cardCount: number): ThemesGridLayout {
  const touch = viewport.minTouchTarget;
  const mobile = viewport.profile === 'mobile-landscape';
  const gap = Math.max(8 * viewport.uiScale, viewport.safeMargin * 0.42);
  const columns: 3 = 3;
  const columnGap = gap;
  const rowGap = gap;
  const cardWidth = (content.width - columnGap * (columns - 1)) / columns;
  const mobileRows = Math.max(1, Math.min(3, Math.ceil(Math.max(1, cardCount) / columns)));
  const mobileFitHeight = (content.height - rowGap * Math.max(0, mobileRows - 1)) / mobileRows;
  const cardHeight = mobile
    ? Math.max(touch * 2.25, Math.min(mobileFitHeight, 132))
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
  return { columns, content, cards, contentHeight };
}
