import { analytics as defaultAnalytics, type AnalyticsClient } from '../analytics/AnalyticsService.ts';
import type { PlatformServices } from '../platform/services.ts';

const STANDARD_INTERSTITIAL_EVERY = 3;
const STANDARD_INTERSTITIAL_COOLDOWN_MS = 2 * 60 * 1000;

export class StandardAdController {
  private freshStandardDealCount = 0;
  private lastInterstitialRequestAt: number | null = null;

  constructor(
    private readonly platform: PlatformServices,
    private readonly analytics: AnalyticsClient = defaultAnalytics,
  ) {}

  async beforeFreshStandardDeal(): Promise<void> {
    this.freshStandardDealCount += 1;
    if (this.freshStandardDealCount % STANDARD_INTERSTITIAL_EVERY !== 0) return;
    if (!this.platform.ads.available) return;

    const now = this.platform.trustedClock.nowMs() ?? Date.now();
    if (this.lastInterstitialRequestAt !== null && now - this.lastInterstitialRequestAt < STANDARD_INTERSTITIAL_COOLDOWN_MS) return;
    this.lastInterstitialRequestAt = now;

    this.analytics.event('fullscreen_requested');
    try {
      const shown = await this.platform.ads.showInterstitial();
      this.analytics.event(shown ? 'fullscreen_shown' : 'fullscreen_not_shown');
    } catch {
      this.analytics.event('fullscreen_not_shown', { reason: 'exception' });
    }
  }
}
