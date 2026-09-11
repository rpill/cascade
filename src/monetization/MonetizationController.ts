import { getDailyId } from '../meta/DailyCalendar.ts';
import { analytics as defaultAnalytics, type AnalyticsClient, type AnalyticsParams } from '../analytics/AnalyticsService.ts';
import type { MetaOperation } from '../meta/MetaOperations.ts';
import type { MetaSave } from '../meta/MetaSave.ts';
import type { MetaSessionStatus } from '../meta/MetaSession.ts';
import type {
  PlatformProduct,
  PlatformPurchase,
  PlatformServices,
} from '../platform/services.ts';
import {
  COIN_PRODUCT_IDS,
  getCoinGrantForProduct,
  REMOVE_ADS_PRODUCT_ID,
  REWARDED_COINS,
  REWARDED_DAILY_LIMIT,
  type MonetizationProductId,
} from './Products.ts';

export type PaymentsStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface StoreProductView {
  readonly id: MonetizationProductId;
  readonly price: string;
  readonly priceValue: string;
  readonly priceCurrencyCode: string;
  readonly currencyImageUrl: string;
}

export interface MonetizationViewState {
  readonly paymentsStatus: PaymentsStatus;
  readonly products: Readonly<Record<string, StoreProductView>>;
  readonly busyProductId: MonetizationProductId | null;
  readonly rewardedBusy: boolean;
  readonly rewardedAvailable: boolean;
  readonly rewardedRemaining: number;
  readonly removeAdsOwned: boolean;
  readonly errorMessage: string | null;
}

export interface MonetizationMetaSession {
  readonly state: MetaSave;
  readonly status: MetaSessionStatus;
  dispatchAndFlush(operation: MetaOperation): Promise<boolean>;
}

const KNOWN_PRODUCT_IDS = new Set<string>([
  ...COIN_PRODUCT_IDS,
  REMOVE_ADS_PRODUCT_ID,
]);

function isKnownProductId(productId: string): productId is MonetizationProductId {
  return KNOWN_PRODUCT_IDS.has(productId);
}

export class MonetizationController {
  onChange?: () => void;

  private paymentsStatus: PaymentsStatus = 'loading';
  private products: Record<string, StoreProductView> = {};
  private busyProductId: MonetizationProductId | null = null;
  private rewardedBusy = false;
  private errorMessage: string | null = null;
  private purchaseReconciliationReady = false;
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
      paymentsStatus: this.paymentsStatus,
      products: this.products,
      busyProductId: this.busyProductId,
      rewardedBusy: this.rewardedBusy,
      rewardedAvailable: this.platform.ads.available && this.meta.status === 'ready',
      rewardedRemaining: Math.max(0, REWARDED_DAILY_LIMIT - rewardedCount),
      removeAdsOwned: this.meta.state.monetization.removeAds,
      errorMessage: this.errorMessage,
    };
  }

  async initialize(): Promise<void> {
    if (!this.platform.payments.available) {
      this.purchaseReconciliationReady = false;
      this.products = {};
      this.setPaymentsState('unavailable', null);
      return;
    }

    this.purchaseReconciliationReady = false;
    this.products = {};
    this.setPaymentsState('loading', null);

    try {
      const purchases = await this.platform.payments.getPurchases();
      for (const purchase of purchases) {
        await this.reconcilePurchase(purchase);
      }
      this.purchaseReconciliationReady = true;

      const catalog = await this.platform.payments.getCatalog();
      this.products = this.keepKnownProducts(catalog);
      this.setPaymentsState('ready', null);
    } catch {
      this.purchaseReconciliationReady = false;
      this.products = {};
      this.setPaymentsState('error', 'Не удалось загрузить покупки. Повторите попытку.');
    }
  }

  async retryPayments(): Promise<void> {
    await this.initialize();
  }

  async purchase(productId: MonetizationProductId): Promise<void> {
    if (
      this.paymentsStatus !== 'ready'
      || this.meta.status !== 'ready'
      || this.busyProductId !== null
      || !isKnownProductId(productId)
      || this.products[productId] === undefined
      || (productId === REMOVE_ADS_PRODUCT_ID && this.meta.state.monetization.removeAds)
    ) {
      return;
    }

    const analyticsParams = this.purchaseAnalyticsParams(productId);
    this.analytics.event('iap_click', analyticsParams);
    this.busyProductId = productId;
    this.errorMessage = null;
    this.notify();

    try {
      const purchase = await this.platform.payments.purchase(productId);
      await this.reconcilePurchase(purchase);
      this.analytics.goal('iap_success', {
        ...analyticsParams,
        coins_granted: getCoinGrantForProduct(productId) ?? 0,
        remove_ads: productId === REMOVE_ADS_PRODUCT_ID,
      });
    } catch {
      this.analytics.event('iap_error', analyticsParams);
      this.errorMessage = 'Не удалось завершить покупку. Повторите попытку.';
    } finally {
      this.busyProductId = null;
      this.notify();
    }
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
    if (
      this.meta.state.monetization.removeAds
      || !this.platform.ads.available
      || !this.purchaseReconciliationReady
    ) {
      return;
    }

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

  private async reconcilePurchase(purchase: PlatformPurchase): Promise<void> {
    if (purchase.productId === REMOVE_ADS_PRODUCT_ID) {
      if (!this.meta.state.monetization.removeAds) {
        const saved = await this.meta.dispatchAndFlush({ kind: 'restore-remove-ads' });
        if (!saved) throw new Error('Failed to save remove-ads entitlement');
      }
      return;
    }

    const grant = getCoinGrantForProduct(purchase.productId);
    if (grant === null) return;

    if (!this.meta.state.monetization.creditedPurchaseTokens.includes(purchase.purchaseToken)) {
      const saved = await this.meta.dispatchAndFlush({
        kind: 'credit-platform-purchase',
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
      });
      if (!saved) throw new Error('Failed to save purchase credit');
    }

    await this.platform.payments.consumePurchase(purchase.purchaseToken);
    await this.meta.dispatchAndFlush({
      kind: 'clear-platform-purchase',
      purchaseToken: purchase.purchaseToken,
    });
  }

  private purchaseAnalyticsParams(productId: MonetizationProductId): AnalyticsParams {
    const product = this.products[productId];
    return {
      product_id: productId,
      ...(product === undefined ? {} : {
        price_value: product.priceValue,
        portal_currency: product.priceCurrencyCode,
      }),
    };
  }

  private keepKnownProducts(catalog: readonly PlatformProduct[]): Record<string, StoreProductView> {
    const known: Record<string, StoreProductView> = {};
    for (const product of catalog) {
      if (!isKnownProductId(product.id)) continue;
      known[product.id] = {
        id: product.id,
        price: product.price,
        priceValue: product.priceValue,
        priceCurrencyCode: product.priceCurrencyCode,
        currencyImageUrl: product.currencyImageUrl,
      };
    }
    return known;
  }

  private currentDayId(): string {
    return getDailyId(this.platform.trustedClock.nowMs() ?? Date.now());
  }

  private setPaymentsState(status: PaymentsStatus, errorMessage: string | null): void {
    this.paymentsStatus = status;
    this.errorMessage = errorMessage;
    this.notify();
  }

  private notify(): void {
    try {
      this.onChange?.();
    } catch {
      // UI observers must not break commerce state transitions.
    }
  }
}
