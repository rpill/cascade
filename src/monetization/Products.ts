import { THEME_CATALOG } from '../theme/ThemeCatalog.ts';

export const COIN_PRODUCT_IDS = ['coins_500', 'coins_1500', 'coins_theme_bundle'] as const;
export const THEME_BUNDLE_PRODUCT_ID = 'coins_theme_bundle' as const;
export const REMOVE_ADS_PRODUCT_ID = 'remove_ads' as const;
export const REWARDED_COINS = 25;
export const REWARDED_DAILY_LIMIT = 5;

export type CoinProductId = typeof COIN_PRODUCT_IDS[number];
export type MonetizationProductId = CoinProductId | typeof REMOVE_ADS_PRODUCT_ID;

export function getThemeBundleCoinGrant(): number {
  return THEME_CATALOG.filter((theme) => theme.price > 0).length * 300;
}

export function getCoinGrantForProduct(productId: string): number | null {
  if (productId === 'coins_500') return 500;
  if (productId === 'coins_1500') return 1500;
  if (productId === THEME_BUNDLE_PRODUCT_ID) return getThemeBundleCoinGrant();
  return null;
}
