export type UiViewportProfile = 'desktop' | 'mobile-landscape';

export interface UiViewportEnvironment {
  readonly width: number;
  readonly height: number;
  readonly touchPrimary: boolean;
}

export interface ResolvedUiViewport extends UiViewportEnvironment {
  readonly profile: UiViewportProfile;
  readonly safeMargin: number;
  readonly uiScale: number;
  readonly minTouchTarget: number;
}

export function resolveUiViewport(env: UiViewportEnvironment): ResolvedUiViewport {
  const mobile = env.touchPrimary && env.height <= 820;
  const uiScale = mobile
    ? Math.max(0.5, Math.min(1, env.height / 720))
    : Math.max(0.75, Math.min(1.2, env.height / 1080));

  return {
    ...env,
    profile: mobile ? 'mobile-landscape' : 'desktop',
    safeMargin: mobile
      ? Math.max(12, Math.round(env.height * 0.03))
      : Math.max(24, Math.round(env.height * 0.035)),
    uiScale,
    minTouchTarget: 44,
  };
}

export function normalizeTouchTarget(
  visibleSize: number,
  viewport: Pick<ResolvedUiViewport, 'minTouchTarget'>,
): number {
  return Math.max(visibleSize, viewport.minTouchTarget);
}


export function scaleUiViewportForBacking(
  viewport: ResolvedUiViewport,
  renderScale: number,
): ResolvedUiViewport {
  const scale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
  return {
    ...viewport,
    width: viewport.width * scale,
    height: viewport.height * scale,
    safeMargin: viewport.safeMargin * scale,
    uiScale: viewport.uiScale * scale,
    minTouchTarget: viewport.minTouchTarget * scale,
  };
}
