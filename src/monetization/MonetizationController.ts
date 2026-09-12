import { getDailyId } from '../meta/DailyCalendar.ts';
import { analytics as defaultAnalytics, type AnalyticsClient } from '../analytics/AnalyticsService.ts';
import type { MetaOperation } from '../meta/MetaOperations.ts';
import type { MetaSave } from '../meta/MetaSave.ts';
import type { MetaSessionStatus } from '../meta/MetaSession.ts';
import type { PlatformServices } from '../platform/services.ts';
import { REWARDED_COINS, REWARDED_DAILY_LIMIT } from './Products.ts';

export interface MonetizationViewState {
  readonly rewardedBusy: boolean;
  readonly rewardedAvailable: boolean;
  readonly rewardedRemaining: number;
  readonly errorMessage: string | null;
}

export interface MonetizationMetaSession {
  readonly state: MetaSave;
  readonly status: MetaSessionStatus;
  dispatchAndFlush(operation: MetaOperation): Promise<boolean>;
}

export class MonetizationController {
  onChange?: () => void;

  private rewardedBusy = false;
  private errorMessage: string | null = null;
  private readonly platform: PlatformServices;
  private readonly meta: MonetizationMetaSession;
  private readonly analytics: AnalyticsClient;

  constructor(
    platform: PlatformServices,
    meta: MonetizationMetaSession,
    analyticsClient: AnalyticsClient = defaultAnalytics,
  ) {
    this.platform = platform;
    this.meta = meta;
    this.analytics = analyticsClient;
  }

  get state(): MonetizationViewState {
    const dayId = this.currentDayId();
    const rewardedCount = this.meta.state.monetization.rewardedDay === dayId
      ? this.meta.state.monetization.rewardedCount
      : 0;

    return {
      rewardedBusy: this.rewardedBusy,
      rewardedAvailable: this.platform.ads.available && this.meta.status === 'ready',
      rewardedRemaining: Math.max(0, REWARDED_DAILY_LIMIT - rewardedCount),
      errorMessage: this.errorMessage,
    };
  }

  async initialize(): Promise<void> {
    // Release monetization is ad-only. In particular, startup must not call
    // Yandex Payments/getPayments when in-app purchases are not configured.
    this.notify();
  }

  async watchRewarded(): Promise<void> {
    if (
      !this.platform.ads.available
      || this.meta.status !== 'ready'
      || this.rewardedBusy
      || this.state.rewardedRemaining <= 0
    ) {
      return;
    }

    this.analytics.event('rewarded_click');
    this.rewardedBusy = true;
    this.errorMessage = null;
    this.notify();

    try {
      const rewarded = await this.platform.ads.showRewarded();
      if (!rewarded) {
        this.analytics.event('rewarded_no_reward');
        return;
      }

      const saved = await this.meta.dispatchAndFlush({
        kind: 'rewarded-ad',
        dayId: this.currentDayId(),
      });
      if (!saved) {
        this.analytics.event('rewarded_error', { stage: 'save' });
        this.errorMessage = 'Не удалось сохранить награду. Повторите попытку.';
      } else {
        this.analytics.goal('rewarded_reward', {
          coins: REWARDED_COINS,
          remaining_today: this.state.rewardedRemaining,
        });
      }
    } catch {
      this.analytics.event('rewarded_error', { stage: 'show' });
      this.errorMessage = 'Не удалось показать рекламу. Повторите попытку позже.';
    } finally {
      this.rewardedBusy = false;
      this.notify();
    }
  }

  async beforeFreshStandardDeal(): Promise<void> {
    if (!this.platform.ads.available) return;

    this.analytics.event('fullscreen_requested');
    try {
      const shown = await this.platform.ads.showInterstitial();
      this.analytics.event(shown ? 'fullscreen_shown' : 'fullscreen_not_shown');
    } catch {
      this.analytics.event('fullscreen_not_shown', { reason: 'exception' });
      // Advertising failures must never block a requested new deal.
    }
  }

  refreshFromMeta(): void {
    this.notify();
  }

  private currentDayId(): string {
    return getDailyId(this.platform.trustedClock.nowMs() ?? Date.now());
  }

  private notify(): void {
    try {
      this.onChange?.();
    } catch {
      // UI observers must not break monetization state transitions.
    }
  }
}
