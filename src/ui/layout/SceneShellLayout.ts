import type { UiRect } from './HomeLayout.ts';
import type { ResolvedUiViewport } from './UiViewport.ts';

export interface SceneShellLayout {
  readonly header: UiRect;
  readonly back: UiRect;
  readonly title: UiRect;
  readonly rightSlot: UiRect;
  readonly content: UiRect;
}

export function computeSceneShellLayout(viewport: ResolvedUiViewport): SceneShellLayout {
  const css = viewport.minTouchTarget / 44;
  const outer = viewport.safeMargin;
  const mobile = viewport.profile === 'mobile-landscape';
  const headerHeight = Math.max(viewport.minTouchTarget, (mobile ? 48 : 60) * css);
  const contentGap = Math.max((mobile ? 8 : 14) * css, outer * 0.35);
  const back: UiRect = { x: outer, y: outer, width: headerHeight, height: headerHeight };
  const rightWidth = Math.max(headerHeight * (mobile ? 3.1 : 3.6), 144 * css);
  const rightSlot: UiRect = {
    x: viewport.width - outer - rightWidth,
    y: outer,
    width: rightWidth,
    height: headerHeight,
  };
  const titleWidth = Math.max(1, viewport.width - (outer + headerHeight + contentGap) * 2);
  const title: UiRect = {
    x: (viewport.width - titleWidth) / 2,
    y: outer,
    width: titleWidth,
    height: headerHeight,
  };
  const contentY = outer + headerHeight + contentGap;
  const content: UiRect = {
    x: outer,
    y: contentY,
    width: Math.max(1, viewport.width - outer * 2),
    height: Math.max(1, viewport.height - contentY - outer),
  };
  return {
    header: { x: outer, y: outer, width: viewport.width - outer * 2, height: headerHeight },
    back,
    title,
    rightSlot,
    content,
  };
}

export function computeNarrowScenePanel(content: UiRect, viewport: ResolvedUiViewport): UiRect {
  const css = viewport.minTouchTarget / 44;
  const maxWidth = viewport.profile === 'desktop' ? 820 * css : content.width * 0.88;
  const width = Math.min(content.width, maxWidth);
  return {
    x: content.x + (content.width - width) / 2,
    y: content.y,
    width,
    height: content.height,
  };
}
