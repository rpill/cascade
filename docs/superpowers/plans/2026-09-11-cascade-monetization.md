# Cascade Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Purchases screen and add safe Yandex Games payments, rewarded ads, and sparse interstitial ads without interrupting gameplay or risking duplicate coin grants.

**Architecture:** Keep all SDK details behind `PlatformServices`, persist monetization entitlements/receipts inside the existing `MetaSave`/`MetaSession` journaled state, and put orchestration in a focused `MonetizationController`. `GameScene` only wires UI actions and asks the controller before a fresh Standard deal; `PurchaseView` only renders a view model and emits actions.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 7, Node 22 test runner, Yandex Games SDK.

**Spec:** `/mnt/data/2026-09-11-cascade-monetization-design.md`

## Global Constraints

- Product IDs are exactly `coins_500`, `coins_1500`, `coins_theme_bundle`, and `remove_ads`.
- `coins_theme_bundle` grants `300 × released paid-theme count`; the current catalog has 8 paid themes, so the grant is 2400 coins now.
- Displayed price, currency code/name, and currency icon come from `payments.getCatalog()`; do not hard-code `39`, `89`, `129`, `99`, `Yan`, or a currency icon in game UI code.
- Rewarded video grants exactly 25 coins and at most 5 rewards per trusted day.
- A rewarded grant is triggered only by Yandex `onRewarded`; closing/opening the ad alone never grants coins.
- `remove_ads` is non-consumable and only disables game-triggered interstitials; rewarded ads remain voluntary and available.
- Do not add a sticky banner.
- Interstitials are requested only when starting a fresh `winnable` Standard deal from an already active Standard deal or from Standard completion; first launch, Daily, restart-same-deal, menu, rules, settings, statistics, collection, and shop do not trigger one.
- If purchase restoration fails at startup, do not show game-triggered interstitials until entitlement reconciliation succeeds; this avoids showing an ad to a prior `remove_ads` buyer during a transient payments failure.
- Unknown purchase product IDs are never consumed automatically.
- Consumable coin credit plus purchase-token ledger insertion must be one meta-state operation, durably flushed before `consumePurchase(token)`.
- Existing `game_api_pause` / `game_api_resume` remains the only lifecycle mechanism for pausing gameplay/audio while platform UI is open.
- The in-game “Новая раздача” action stays directly accessible in the gameplay HUD and is not moved into an overflow/menu.
- The extracted workspace has no `.git`; commit commands in this plan are for the user's real repository and are skipped when executing only in this snapshot.

---

## File Structure

### New production files

- `src/monetization/Products.ts` — stable product IDs, dynamic theme-bundle grant, rewarded constants, product-to-coin lookup.
- `src/monetization/MonetizationController.ts` — catalog loading, startup reconciliation, purchase processing, rewarded quota, and interstitial policy.
- `src/game/view/NewDealConfirmView.ts` — themed confirmation dialog for abandoning an unfinished ordinary deal.
- `src/game/view/NewDealConfirmView.css` — matching dialog styling.

### Modified production files

- `src/platform/services.ts` — add abstract payments/ads capabilities and inert browser fallbacks.
- `src/platform/yandex.ts` — map Yandex payments/ads SDK into those abstractions.
- `src/meta/MetaSave.ts` — migrate to version 6 with persisted monetization state.
- `src/meta/MetaOperations.ts` — atomic purchase-credit, token cleanup, remove-ads restore, and rewarded-ad operations.
- `src/meta/MetaSession.ts` — expose a small `dispatchAndFlush()` convenience for durability boundaries.
- `src/game/view/PurchaseView.ts` — render real products/rewarded/remove-ads state and emit actions.
- `src/game/view/PurchaseView.css` — loading/error/currency/rewarded/owned states.
- `src/game/scenes/GameScene.ts` — instantiate/wire controller, refresh store, gate fresh Standard deals, show confirmation.
- `src/localization/English.ts` — English strings for monetization and confirmation UI.
- `src/main.ts` — import the confirmation dialog CSS.
- `README.md` — short release checklist pointer for Yandex console configuration.

### New tests

- `tests/monetization-products.test.ts`
- `tests/monetization-meta.test.ts`
- `tests/monetization-controller.test.ts`
- `tests/purchase-view-monetization.test.ts`
- `tests/monetization-scene-wiring.test.ts`

### Modified tests

- `tests/platform-services.test.ts` — browser/Yandex payments and ad adapter behavior.

---

### Task 1: Define stable monetization products and dynamic bundle grant

**Files:**
- Create: `src/monetization/Products.ts`
- Create: `tests/monetization-products.test.ts`

**Interfaces:**
- Produces: `COIN_PRODUCT_IDS`, `THEME_BUNDLE_PRODUCT_ID`, `REMOVE_ADS_PRODUCT_ID`, `REWARDED_COINS`, `REWARDED_DAILY_LIMIT`, `MonetizationProductId`, `getThemeBundleCoinGrant()`, `getCoinGrantForProduct()`.
- Consumes: `THEME_CATALOG` from `src/theme/ThemeCatalog.ts`.

- [ ] **Step 1: Write the failing product-grant test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCoinGrantForProduct,
  getThemeBundleCoinGrant,
  REWARDED_COINS,
  REWARDED_DAILY_LIMIT,
} from '../src/monetization/Products.ts';

test('theme bundle equals 300 coins per released paid theme', () => {
  assert.equal(getThemeBundleCoinGrant(), 2400);
  assert.equal(getCoinGrantForProduct('coins_theme_bundle'), 2400);
});

test('fixed packs and rewarded constants remain stable', () => {
  assert.equal(getCoinGrantForProduct('coins_500'), 500);
  assert.equal(getCoinGrantForProduct('coins_1500'), 1500);
  assert.equal(getCoinGrantForProduct('remove_ads'), null);
  assert.equal(getCoinGrantForProduct('unknown'), null);
  assert.equal(REWARDED_COINS, 25);
  assert.equal(REWARDED_DAILY_LIMIT, 5);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/monetization-products.test.ts
```

Expected: FAIL because `src/monetization/Products.ts` does not exist.

- [ ] **Step 3: Implement the product definitions**

```ts
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
```

- [ ] **Step 4: Run the product tests and verify GREEN**

```bash
node --test tests/monetization-products.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit in the real repo**

```bash
git add src/monetization/Products.ts tests/monetization-products.test.ts
git commit -m "feat: define monetization products"
```

---

### Task 2: Add payments and ads to the platform abstraction

**Files:**
- Modify: `src/platform/services.ts`
- Modify: `src/platform/yandex.ts`
- Modify: `tests/platform-services.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PlatformProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly price: string;
  readonly priceValue: string;
  readonly priceCurrencyCode: string;
  readonly currencyImageUrl: string;
}

export interface PlatformPurchase {
  readonly productId: string;
  readonly purchaseToken: string;
}

export interface PlatformPayments {
  readonly available: boolean;
  getCatalog(): Promise<PlatformProduct[]>;
  purchase(productId: string): Promise<PlatformPurchase>;
  getPurchases(): Promise<PlatformPurchase[]>;
  consumePurchase(purchaseToken: string): Promise<void>;
}

export interface PlatformAds {
  readonly available: boolean;
  showInterstitial(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
}
```

- `PlatformServices` gains readonly `payments` and `ads` members.
- Browser fallback returns unavailable capabilities that resolve safely and never mutate gameplay.

- [ ] **Step 1: Extend the existing platform test with failing browser-fallback assertions**

Add to `tests/platform-services.test.ts`:

```ts
test('unavailable platform exposes safe ads and payments fallbacks', async () => {
  const platform = createUnavailablePlatformServices(null);

  assert.equal(platform.payments.available, false);
  assert.deepEqual(await platform.payments.getCatalog(), []);
  assert.deepEqual(await platform.payments.getPurchases(), []);
  await assert.rejects(platform.payments.purchase('coins_500'));
  await platform.payments.consumePurchase('ignored-token');

  assert.equal(platform.ads.available, false);
  assert.equal(await platform.ads.showInterstitial(), false);
  assert.equal(await platform.ads.showRewarded(), false);
});
```

- [ ] **Step 2: Add failing Yandex adapter tests for catalog normalization and purchase pass-through**

Use a fake Yandex payments object whose catalog contains one product with `priceValue: '39'`, `priceCurrencyCode: 'YAN'`, and `getPriceCurrencyImage: () => '/yan.svg'`. Assert that the platform returns those values unchanged and maps `productID` to `productId`:

```ts
const catalog = await platform.payments.getCatalog();
assert.deepEqual(catalog[0], {
  id: 'coins_500',
  title: '500 coins',
  description: 'Coin pack',
  price: '39 YAN',
  priceValue: '39',
  priceCurrencyCode: 'YAN',
  currencyImageUrl: '/yan.svg',
});
assert.deepEqual(await platform.payments.purchase('coins_500'), {
  productId: 'coins_500',
  purchaseToken: 'purchase-1',
});
```

- [ ] **Step 3: Add failing Yandex ad callback tests**

Cover all three cases:

```ts
assert.equal(await platform.ads.showInterstitial(), true); // onClose(true)
assert.equal(await platform.ads.showInterstitial(), false); // onError
assert.equal(await platform.ads.showRewarded(), true); // onRewarded then onClose
```

Also assert that `showRewarded()` returns `false` when only `onClose(true)` occurs without `onRewarded`.

- [ ] **Step 4: Run the focused platform tests and verify RED**

```bash
node --test tests/platform-services.test.ts
```

Expected: FAIL because `payments` and `ads` are absent.

- [ ] **Step 5: Implement inert browser capabilities in `services.ts`**

Add the interfaces above and include:

```ts
payments: {
  available: false,
  getCatalog: async () => [],
  purchase: async () => { throw new Error('Payments unavailable'); },
  getPurchases: async () => [],
  consumePurchase: async () => undefined,
},
ads: {
  available: false,
  showInterstitial: async () => false,
  showRewarded: async () => false,
},
```

inside `createUnavailablePlatformServices()`.

- [ ] **Step 6: Type the required Yandex SDK surfaces**

Add to `src/platform/yandex.ts`:

```ts
interface YandexProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  getPriceCurrencyImage(size: 'small' | 'medium' | 'svg'): string;
}

interface YandexPurchase {
  productID: string;
  purchaseToken: string;
}

interface YandexPayments {
  getCatalog(): Promise<YandexProduct[]>;
  purchase(options: { id: string }): Promise<YandexPurchase>;
  getPurchases(): Promise<YandexPurchase[]>;
  consumePurchase(purchaseToken: string): Promise<void>;
}

interface YandexAdv {
  showFullscreenAdv(options: { callbacks: {
    onClose?: (wasShown: boolean) => void;
    onError?: (error: object) => void;
  }}): void;
  showRewardedVideo(options: { callbacks: {
    onRewarded?: () => void;
    onClose?: (wasShown: boolean) => void;
    onError?: (error: object) => void;
  }}): void;
}
```

Extend `YandexSdk` with optional `payments`, `getPayments`, and `adv`.

- [ ] **Step 7: Implement lazy Yandex payments without caching failures forever**

Use this shape:

```ts
function createYandexPayments(ysdk: YandexSdk): PlatformPayments {
  const available = ysdk.payments !== undefined || ysdk.getPayments !== undefined;
  let loading: Promise<YandexPayments> | null = null;

  const resolvePayments = async (): Promise<YandexPayments> => {
    if (ysdk.payments !== undefined) return ysdk.payments;
    if (ysdk.getPayments === undefined) throw new Error('Payments unavailable');
    if (loading === null) loading = ysdk.getPayments();
    try {
      return await loading;
    } catch (error) {
      loading = null;
      throw error;
    }
  };

  return {
    available,
    async getCatalog() {
      const products = await (await resolvePayments()).getCatalog();
      return products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        priceValue: product.priceValue,
        priceCurrencyCode: product.priceCurrencyCode,
        currencyImageUrl: product.getPriceCurrencyImage('small'),
      }));
    },
    async purchase(productId) {
      const purchase = await (await resolvePayments()).purchase({ id: productId });
      return { productId: purchase.productID, purchaseToken: purchase.purchaseToken };
    },
    async getPurchases() {
      const purchases = await (await resolvePayments()).getPurchases();
      return purchases.map((purchase) => ({
        productId: purchase.productID,
        purchaseToken: purchase.purchaseToken,
      }));
    },
    async consumePurchase(purchaseToken) {
      await (await resolvePayments()).consumePurchase(purchaseToken);
    },
  };
}
```

- [ ] **Step 8: Implement Promise wrappers for Yandex ads**

Use a one-shot resolver so `onError`, `onClose`, and duplicate SDK callbacks cannot settle twice. Rewarded resolution carries an `earned` flag set only by `onRewarded`:

```ts
function createYandexAds(ysdk: YandexSdk): PlatformAds {
  if (ysdk.adv === undefined) {
    return { available: false, showInterstitial: async () => false, showRewarded: async () => false };
  }

  return {
    available: true,
    showInterstitial: () => new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
      try {
        ysdk.adv!.showFullscreenAdv({ callbacks: {
          onClose: (wasShown) => finish(wasShown),
          onError: () => finish(false),
        }});
      } catch { finish(false); }
    }),
    showRewarded: () => new Promise<boolean>((resolve) => {
      let settled = false;
      let earned = false;
      const finish = () => { if (!settled) { settled = true; resolve(earned); } };
      try {
        ysdk.adv!.showRewardedVideo({ callbacks: {
          onRewarded: () => { earned = true; },
          onClose: () => finish(),
          onError: () => finish(),
        }});
      } catch { finish(); }
    }),
  };
}
```

Add both adapters to `createYandexPlatformServices()`.

- [ ] **Step 9: Run focused tests and TypeScript build**

```bash
node --test tests/platform-services.test.ts
npm run build
```

Expected: platform tests PASS; build exits 0.

- [ ] **Step 10: Commit in the real repo**

```bash
git add src/platform/services.ts src/platform/yandex.ts tests/platform-services.test.ts
git commit -m "feat: add yandex payments and ads adapters"
```

---

### Task 3: Persist monetization state atomically in the meta profile

**Files:**
- Modify: `src/meta/MetaSave.ts`
- Modify: `src/meta/MetaOperations.ts`
- Modify: `src/meta/MetaSession.ts`
- Create: `tests/monetization-meta.test.ts`

**Interfaces:**
- `META_SAVE_VERSION` becomes `6`.
- `MetaSave` gains:

```ts
export interface MonetizationState {
  removeAds: boolean;
  creditedPurchaseTokens: string[];
  rewardedDay: string;
  rewardedCount: number;
}
```

- `MetaOperation` gains:

```ts
| { readonly kind: 'credit-platform-purchase'; readonly productId: string; readonly purchaseToken: string }
| { readonly kind: 'clear-platform-purchase'; readonly purchaseToken: string }
| { readonly kind: 'restore-remove-ads' }
| { readonly kind: 'rewarded-ad'; readonly dayId: string }
```

- `MetaSession` gains `dispatchAndFlush(operation: MetaOperation): Promise<boolean>`.

- [ ] **Step 1: Write migration/default-state tests**

```ts
test('v5 profile migrates to empty monetization state', () => {
  const state = normalizeMetaSave({ ...legacyV5Fixture, version: 5 });
  assert.deepEqual(state.monetization, {
    removeAds: false,
    creditedPurchaseTokens: [],
    rewardedDay: '',
    rewardedCount: 0,
  });
});
```

Also verify malformed token arrays/day/count are normalized and `removeAds` only accepts boolean `true`.

- [ ] **Step 2: Write failing atomic coin-credit tests**

```ts
const once = applyMetaOperation(createDefaultMetaSave(), {
  kind: 'credit-platform-purchase',
  productId: 'coins_500',
  purchaseToken: 'token-1',
});
assert.equal(once.progression.coins, 500);
assert.deepEqual(once.monetization.creditedPurchaseTokens, ['token-1']);

const twice = applyMetaOperation(once, {
  kind: 'credit-platform-purchase',
  productId: 'coins_500',
  purchaseToken: 'token-1',
});
assert.equal(twice.progression.coins, 500);
```

Verify an unknown product ID leaves state unchanged and `clear-platform-purchase` removes only the named token.

- [ ] **Step 3: Write failing remove-ads and rewarded-day tests**

```ts
const adFree = applyMetaOperation(state, { kind: 'restore-remove-ads' });
assert.equal(adFree.monetization.removeAds, true);

let rewarded = createDefaultMetaSave();
for (let index = 0; index < 6; index += 1) {
  rewarded = applyMetaOperation(rewarded, { kind: 'rewarded-ad', dayId: '2026-09-11' });
}
assert.equal(rewarded.progression.coins, 125);
assert.equal(rewarded.monetization.rewardedCount, 5);

rewarded = applyMetaOperation(rewarded, { kind: 'rewarded-ad', dayId: '2026-09-12' });
assert.equal(rewarded.progression.coins, 150);
assert.equal(rewarded.monetization.rewardedCount, 1);
```

- [ ] **Step 4: Run meta tests and verify RED**

```bash
node --test tests/monetization-meta.test.ts
```

Expected: FAIL because version 6 and monetization operations do not exist.

- [ ] **Step 5: Implement version-6 state and normalization**

Add `MonetizationState`, `MetaSaveV6`, and:

```ts
function normalizeMonetization(raw: unknown): MonetizationState {
  const value = isObject(raw) ? raw : {};
  const tokens = uniqueStrings(value.creditedPurchaseTokens)
    .filter((token) => token.length > 0 && token.length <= 512)
    .slice(-128);
  const rewardedDay = typeof value.rewardedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.rewardedDay)
    ? value.rewardedDay : '';
  const rewardedCount = Number.isSafeInteger(value.rewardedCount)
    ? Math.max(0, Math.min(REWARDED_DAILY_LIMIT, value.rewardedCount as number))
    : 0;
  return {
    removeAds: value.removeAds === true,
    creditedPurchaseTokens: tokens,
    rewardedDay,
    rewardedCount,
  };
}
```

Import `REWARDED_DAILY_LIMIT` from `Products.ts`, make the default state use `normalizeMonetization(null)`, accept versions 2–6, and migrate versions below 6 to an empty monetization state.

- [ ] **Step 6: Implement atomic meta operations**

For purchase credit:

```ts
case 'credit-platform-purchase': {
  if (!event.purchaseToken || state.monetization.creditedPurchaseTokens.includes(event.purchaseToken)) return state;
  const grant = getCoinGrantForProduct(event.productId);
  if (grant === null) return state;
  const coins = Math.min(MAX_ECONOMY_VALUE, state.progression.coins + grant);
  return {
    ...state,
    progression: { ...state.progression, coins },
    monetization: {
      ...state.monetization,
      creditedPurchaseTokens: [...state.monetization.creditedPurchaseTokens, event.purchaseToken].slice(-128),
    },
  };
}
```

Implement `clear-platform-purchase`, monotonic `restore-remove-ads`, and `rewarded-ad` with `REWARDED_COINS`/`REWARDED_DAILY_LIMIT`.

- [ ] **Step 7: Add the durability convenience to `MetaSession`**

```ts
async dispatchAndFlush(operation: MetaOperation): Promise<boolean> {
  if (!this.dispatch(operation)) return false;
  return this.flush();
}
```

This deliberately reuses the current journal and strict `saveStrict(..., true)` path instead of introducing a second persistence system.

- [ ] **Step 8: Run focused meta/session tests**

```bash
node --test tests/monetization-meta.test.ts tests/meta-session.test.ts tests/meta-save.test.ts
```

Expected: all PASS.

- [ ] **Step 9: Commit in the real repo**

```bash
git add src/meta/MetaSave.ts src/meta/MetaOperations.ts src/meta/MetaSession.ts tests/monetization-meta.test.ts
git commit -m "feat: persist monetization entitlements and receipts"
```

---

### Task 4: Build the monetization controller and recovery flow

**Files:**
- Create: `src/monetization/MonetizationController.ts`
- Create: `tests/monetization-controller.test.ts`

**Interfaces:**

```ts
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

export class MonetizationController {
  onChange?: () => void;
  constructor(platform: PlatformServices, meta: MonetizationMetaSession);
  get state(): MonetizationViewState;
  initialize(): Promise<void>;
  retryPayments(): Promise<void>;
  purchase(productId: MonetizationProductId): Promise<void>;
  watchRewarded(): Promise<void>;
  beforeFreshStandardDeal(): Promise<void>;
  refreshFromMeta(): void;
}
```

- [ ] **Step 1: Write the startup-reconciliation ordering test**

Use fakes that append to a `calls` array. Return an outstanding `coins_500` purchase and make meta `dispatchAndFlush` update the fake state. Assert:

```ts
assert.deepEqual(calls, [
  'getPurchases',
  'credit:token-1',
  'flush:credit:token-1',
  'consume:token-1',
  'clear:token-1',
  'flush:clear:token-1',
  'getCatalog',
]);
```

The essential invariant is credit + durable save before consume.

- [ ] **Step 2: Write failed-consume retry/idempotency test**

First initialization: credit succeeds, consume rejects. Second reconciliation returns the same purchase. Assert the second pass does not add another 500 coins and calls consume again.

- [ ] **Step 3: Write non-consumable restore and unknown-product tests**

Return `remove_ads` plus `mystery_item`. Assert `removeAds` becomes true, neither item is consumed, and `mystery_item` is otherwise ignored.

- [ ] **Step 4: Write rewarded-ad quota tests**

Use an ads fake whose `showRewarded()` resolves `true`, and a trusted clock fixed on `2026-09-11`. Call `watchRewarded()` six times. Assert exactly five meta reward operations and 125 total coins. Also test `showRewarded() === false` creates no meta operation.

- [ ] **Step 5: Write interstitial policy tests**

Cover:

```ts
// persisted removeAds => no call
// startup purchase reconciliation failed => no call
// successful reconciliation and no entitlement => one showInterstitial call
// showInterstitial throws/returns false => controller resolves and navigation may continue
// rewarded remains callable even when removeAds is true
```

- [ ] **Step 6: Run controller tests and verify RED**

```bash
node --test tests/monetization-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 7: Implement `initialize()` with reconciliation before catalog-ready state**

Use this control flow:

```ts
async initialize(): Promise<void> {
  if (!this.platform.payments.available) {
    this.purchaseReconciliationReady = true;
    this.setPaymentsStatus('unavailable');
    return;
  }

  this.setPaymentsStatus('loading');
  try {
    const purchases = await this.platform.payments.getPurchases();
    for (const purchase of purchases) await this.reconcilePurchase(purchase);
    this.purchaseReconciliationReady = true;
    const catalog = await this.platform.payments.getCatalog();
    this.catalog = this.keepKnownProducts(catalog);
    this.setPaymentsStatus('ready');
  } catch {
    this.purchaseReconciliationReady = false;
    this.setPaymentsStatus('error', 'Не удалось загрузить покупки. Повторите попытку.');
  }
}
```

`retryPayments()` calls the same sequence again. The controller does not invent local prices when catalog loading fails.

- [ ] **Step 8: Implement `reconcilePurchase()`**

```ts
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
```

A cleanup-save failure after a successful consume is not treated as a reason to re-credit later; the retained token still blocks duplicate credit.

- [ ] **Step 9: Implement product purchase flow with an in-flight lock**

Only allow known IDs present in the loaded catalog and one active purchase at a time:

```ts
const purchase = await this.platform.payments.purchase(productId);
await this.reconcilePurchase(purchase);
```

For `remove_ads`, reconciliation persists the entitlement and never consumes it. A rejected purchase updates a non-fatal message and leaves the store usable.

- [ ] **Step 10: Implement rewarded flow and trusted-day calculation**

Use `getDailyId(this.platform.trustedClock.nowMs() ?? Date.now())`, but because the browser fallback exposes no ads, production rewarded grants on Yandex use `serverTime()`.

Before calling the ad, compute remaining quota from meta state. Lock double clicks with `rewardedBusy`. Only dispatch `{ kind: 'rewarded-ad', dayId }` when `await showRewarded()` is `true`.

- [ ] **Step 11: Implement interstitial suppression rules**

`beforeFreshStandardDeal()` returns immediately when:

```ts
this.meta.state.monetization.removeAds === true
|| !this.platform.ads.available
|| !this.purchaseReconciliationReady
```

Otherwise await `showInterstitial()` inside `try/catch` and swallow platform failures so the new deal can continue.

- [ ] **Step 12: Run controller and dependent tests**

```bash
node --test tests/monetization-controller.test.ts tests/monetization-meta.test.ts tests/platform-services.test.ts
```

Expected: all PASS.

- [ ] **Step 13: Commit in the real repo**

```bash
git add src/monetization/MonetizationController.ts tests/monetization-controller.test.ts
git commit -m "feat: orchestrate purchases and ads"
```

---

### Task 5: Replace the Purchases placeholder with real store state

**Files:**
- Modify: `src/game/view/PurchaseView.ts`
- Modify: `src/game/view/PurchaseView.css`
- Modify: `src/localization/English.ts`
- Create: `tests/purchase-view-monetization.test.ts`

**Interfaces:**

```ts
export interface PurchaseViewActions {
  readonly purchase: (productId: MonetizationProductId) => void;
  readonly rewarded: () => void;
  readonly retry: () => void;
}

export class PurchaseView {
  constructor(host: HTMLElement, actions: PurchaseViewActions);
  update(state: MonetizationViewState): void;
}
```

- [ ] **Step 1: Write the failing UI source/regression test**

Assert that `PurchaseView.ts` imports product constants instead of declaring `[500, 1500, 4000]`, renders a rewarded row, renders an SDK currency image, exposes retry, and contains no literal launch prices or `Yan`:

```ts
assert.doesNotMatch(source, /\b4000\b/);
assert.doesNotMatch(source, /\b39\b|\b89\b|\b129\b|\b99\b|Yan/);
assert.match(source, /coins_theme_bundle/);
assert.match(source, /rewarded/);
assert.match(source, /currencyImageUrl/);
assert.match(source, /actions\.retry/);
```

- [ ] **Step 2: Run the view test and verify RED**

```bash
node --test tests/purchase-view-monetization.test.ts
```

Expected: FAIL because the view is still a disabled placeholder.

- [ ] **Step 3: Build three coin rows from product definitions**

Rows are keyed by stable product ID and show these in-game grants:

```ts
[
  { id: 'coins_500', coins: 500 },
  { id: 'coins_1500', coins: 1500 },
  { id: 'coins_theme_bundle', coins: getThemeBundleCoinGrant() },
]
```

Keep the current paper/wood/corner visual treatment.

- [ ] **Step 4: Render SDK catalog price data without fake fallback prices**

When a product exists in `state.products`, render `priceValue` plus an `<img>` using `currencyImageUrl`; if the icon URL is empty, render SDK `price`. If catalog data is absent, show localized `НЕДОСТУПНО`, not a locally invented price.

Disable only the affected product while `busyProductId` matches it; other product buttons remain visually stable.

- [ ] **Step 5: Add rewarded and remove-ads rows**

Rewarded UI:

```text
Смотреть рекламу · +25
Осталось сегодня: 5
```

The button is disabled when ads are unavailable, a rewarded request is in flight, or remaining quota is zero.

Remove-ads UI uses the SDK catalog product price until owned; once owned, replace the action with `КУПЛЕНО` and keep it disabled. Copy explicitly says rewarded ads remain voluntary.

- [ ] **Step 6: Add loading/error/retry states**

Use `purchase-note` as the status area:

- `loading`: `Покупки загружаются…`
- `unavailable`: `Платежи сейчас недоступны.`
- `error`: `Не удалось загрузить покупки. Повторите попытку.` plus `ПОВТОРИТЬ`
- `ready`: short neutral copy, no fake local pricing.

- [ ] **Step 7: Add localization entries**

Add direct RU→EN mappings for all new UI strings, including:

```ts
'Покупки загружаются…': 'Loading purchases…',
'Платежи сейчас недоступны.': 'Payments are currently unavailable.',
'Не удалось загрузить покупки. Повторите попытку.': 'Could not load purchases. Please try again.',
'ПОВТОРИТЬ': 'RETRY',
'НЕДОСТУПНО': 'UNAVAILABLE',
'Смотреть рекламу · +25': 'Watch ad · +25',
'Осталось сегодня: {count}': '{count} left today',
'Лимит на сегодня исчерпан': 'Daily limit reached',
'КУПЛЕНО': 'OWNED',
'Реклама за награду остаётся добровольной.': 'Rewarded ads remain optional.',
```

- [ ] **Step 8: Style currency, rewarded, retry, busy, and owned states**

Add classes with the existing typography/paper palette; do not introduce a new visual language. Currency icon should stay around `1em–1.2em` and align with the price baseline. Keep the dialog usable at `max-height: 430px`.

- [ ] **Step 9: Run view/style/localization regressions**

```bash
node --test tests/purchase-view-monetization.test.ts tests/coin-icon-ui.test.ts tests/how-to-play-overlay-v2.test.ts tests/surface-ornaments-polish.test.ts tests/localization.test.ts
```

Expected: all PASS.

- [ ] **Step 10: Commit in the real repo**

```bash
git add src/game/view/PurchaseView.ts src/game/view/PurchaseView.css src/localization/English.ts tests/purchase-view-monetization.test.ts
git commit -m "feat: finish purchases screen"
```

---

### Task 6: Wire monetization into GameScene and fresh-Standard-deal transitions

**Files:**
- Create: `src/game/view/NewDealConfirmView.ts`
- Create: `src/game/view/NewDealConfirmView.css`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/main.ts`
- Modify: `src/localization/English.ts`
- Create: `tests/monetization-scene-wiring.test.ts`

**Interfaces:**

```ts
export class NewDealConfirmView {
  constructor(host: HTMLElement);
  confirm(): Promise<boolean>;
  destroy(): void;
}
```

`GameScene` gains `monetizationController`, `newDealConfirmView`, and a `freshDealTransitionInFlight` guard.

- [ ] **Step 1: Write the failing scene wiring test**

Check source-level invariants that are difficult to reach without booting Phaser:

```ts
assert.match(sceneSource, /new MonetizationController/);
assert.match(sceneSource, /await this\.monetizationController\.initialize\(\)/);
assert.match(sceneSource, /beforeFreshStandardDeal/);
assert.match(sceneSource, /newDealConfirmView\.confirm/);
assert.match(sceneSource, /freshDealTransitionInFlight/);
assert.match(sceneSource, /currentDeal\.mode === 'winnable'/);
```

Also assert the Daily retry path still calls `restartDeal()` and contains no interstitial call.

- [ ] **Step 2: Run the scene test and verify RED**

```bash
node --test tests/monetization-scene-wiring.test.ts
```

Expected: FAIL because nothing is wired yet.

- [ ] **Step 3: Implement the themed confirm dialog**

`confirm()` opens a modal with:

```text
Начать новую раздачу?
Текущая партия будет завершена.
[ОТМЕНА] [НОВАЯ РАЗДАЧА]
```

It resolves `true` only from the confirm button, `false` from cancel/Escape/backdrop, restores previous focus, and resolves any previous pending confirmation as `false` before opening a new one. Style it with the same paper/ink/wood family as the existing menu dialogs.

- [ ] **Step 4: Wire PurchaseView actions during scene creation**

Construct it as:

```ts
this.purchaseView = new PurchaseView(this.game.canvas.parentElement!, {
  purchase: (productId) => { void this.monetizationController?.purchase(productId); },
  rewarded: () => { void this.monetizationController?.watchRewarded(); },
  retry: () => { void this.monetizationController?.retryPayments(); },
});
```

Before the controller exists, the initial view state remains loading/disabled.

- [ ] **Step 5: Create and initialize the controller after profile load**

In `initializeMeta()`, after `await this.loadMetaProfile()` and before allowing ad decisions:

```ts
this.monetizationController = new MonetizationController(this.platform, this.metaSession);
this.monetizationController.onChange = () => this.refreshMonetizationState();
await this.monetizationController.initialize();
this.refreshMonetizationState();
```

If meta loading failed, still create the controller but leave purchases disabled until the profile is ready; `retryMeta()` should refresh/reinitialize monetization after a successful profile retry.

- [ ] **Step 6: Keep the store synchronized with meta changes**

Add:

```ts
private refreshMonetizationState(): void {
  this.monetizationController?.refreshFromMeta();
  if (this.monetizationController) this.purchaseView.update(this.monetizationController.state);
}
```

Call it from `refreshSessionState()` after `this.metaState = this.metaSession.state` so coin balance, remove-ads ownership, and rewarded remaining count update immediately after a grant.

- [ ] **Step 7: Split fresh-deal request from deal replacement**

Keep `startNewDeal()` as the directly bound HUD/keyboard action, but make it dispatch the async flow:

```ts
private startNewDeal(): void {
  void this.requestFreshDeal(true);
}

private playAgainFromGameComplete(): void {
  void this.requestFreshDeal(false);
}
```

Update `GameCompleteView`'s `newGame` action to `playAgainFromGameComplete()`.

- [ ] **Step 8: Implement confirmation + interstitial + replacement ordering**

`requestFreshDeal(confirmAbandon)` performs these steps in order:

1. Reject while rules are open or another transition is in flight.
2. Require an active non-Daily deal.
3. If `confirmAbandon` and the game is not already won, await `newDealConfirmView.confirm()`; stop if false.
4. Set `freshDealTransitionInFlight = true`.
5. If `currentDeal.mode === 'winnable'`, await `monetizationController?.beforeFreshStandardDeal()`.
6. Re-read current deal after the await; if scene state changed, stop safely.
7. Run the existing `recordStandardFailureIfReplacing`, difficulty selection, `flow.startNewInCurrentMode`, board destroy, and `startDeal` logic.
8. Clear the in-flight flag in `finally`.

This keeps the current “New deal” button directly accessible and ensures the ad occurs before the new deal is returned/rendered.

- [ ] **Step 9: Import confirmation CSS and localize copy**

In `src/main.ts`:

```ts
import './game/view/NewDealConfirmView.css';
```

Add English mappings:

```ts
'Начать новую раздачу?': 'Start a new deal?',
'Текущая партия будет завершена.': 'Your current game will be abandoned.',
'ОТМЕНА': 'CANCEL',
'НОВАЯ РАЗДАЧА': 'NEW DEAL',
```

- [ ] **Step 10: Destroy the confirmation view and detach controller callback on shutdown**

Add `this.newDealConfirmView.destroy()` and set `this.monetizationController.onChange = undefined` before scene teardown completes.

- [ ] **Step 11: Run scene/platform/lifecycle regressions**

```bash
node --test tests/monetization-scene-wiring.test.ts tests/platform-lifecycle-wiring.test.ts tests/game-controls.test.ts tests/game-controls-view.test.ts tests/victory-scene-wiring.test.ts tests/daily-scene-wiring.test.ts
```

Expected: all PASS.

- [ ] **Step 12: Commit in the real repo**

```bash
git add src/game/view/NewDealConfirmView.ts src/game/view/NewDealConfirmView.css src/game/scenes/GameScene.ts src/main.ts src/localization/English.ts tests/monetization-scene-wiring.test.ts
git commit -m "feat: gate fresh standard deals with monetization"
```

---

### Task 7: Document console setup and run full verification

**Files:**
- Modify: `README.md`
- Create: `docs/yandex-monetization.md`

**Interfaces:**
- No runtime interfaces; this task records the external configuration that code cannot create.

- [ ] **Step 1: Write the Yandex console checklist**

Create `docs/yandex-monetization.md` with exactly these launch products:

```md
# Yandex monetization setup

Enable purchases and advertising for the game in the Yandex Games Developer Console.

| Product ID | Type | In-game result | Recommended launch price |
| --- | --- | --- | --- |
| `coins_500` | Consumable | 500 coins | 39 Yan |
| `coins_1500` | Consumable | 1500 coins | 89 Yan |
| `coins_theme_bundle` | Consumable | 300 × current released paid-theme count (2400 now) | 129 Yan |
| `remove_ads` | Non-consumable | Disables game-triggered interstitials | 99 Yan |

The UI reads actual user-facing price/currency/icon from `payments.getCatalog()`; the values above are console configuration guidance only.

Before release:
1. Create all four products with the exact IDs above.
2. Enable advertising and in-app purchases.
3. Open the Yandex debug panel and test each consumable purchase through credit, save, consume, and reload.
4. Leave at least one purchase unconsumed during testing, reload, and verify startup reconciliation credits it once and consumes it.
5. Buy `remove_ads`, reload, and verify Standard fresh-deal interstitials stop while rewarded video still works.
6. Verify startup advertising pauses audio/gameplay through `game_api_pause` / `game_api_resume`.
7. Verify no sticky banner is enabled.
```

- [ ] **Step 2: Link the checklist from README**

Add a short “Yandex release” section linking to `docs/yandex-monetization.md` without duplicating prices into runtime documentation elsewhere.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS, 0 failures.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: `tsc` exits 0 and Vite production build exits 0.

- [ ] **Step 5: Run the Yandex-dev build**

```bash
npm run build:yandex-dev
```

Expected: exits 0.

- [ ] **Step 6: Inspect for accidental hard-coded portal pricing or banner integration**

```bash
grep -RInE "39 Yan|89 Yan|129 Yan|99 Yan|showBannerAdv|showStickyAdv|StickyAdv" src || true
```

Expected: no runtime matches.

- [ ] **Step 7: Inspect for all required SDK calls and recovery path**

```bash
grep -RInE "getCatalog|getPurchases|consumePurchase|showFullscreenAdv|showRewardedVideo|game_api_pause|game_api_resume" src
```

Expected: payments/ad calls live in platform/monetization code; lifecycle events remain in `src/platform/yandex.ts`.

- [ ] **Step 8: Commit documentation in the real repo**

```bash
git add README.md docs/yandex-monetization.md
git commit -m "docs: add yandex monetization release checklist"
```

---

## Verification Matrix

| Requirement | Covered by |
| --- | --- |
| 2400 bundle from 8 paid themes | Task 1 |
| No hard-coded shop currency/price | Tasks 2, 5, 7 |
| Browser ads/payments safe | Task 2 |
| Yandex payment/catalog normalization | Task 2 |
| Reward only from `onRewarded` | Tasks 2, 4 |
| Save before consume | Tasks 3, 4 |
| Retry consume without double credit | Tasks 3, 4 |
| Unknown purchases not consumed | Task 4 |
| `remove_ads` persistent and non-consumable | Tasks 3, 4 |
| Rewarded +25, max 5/day | Tasks 3, 4, 5 |
| No sticky banner | Tasks 2, 7 |
| Interstitial only before fresh Standard deal | Tasks 4, 6 |
| Interstitial failure never blocks deal | Tasks 4, 6 |
| New Deal remains direct HUD action | Task 6 |
| Mid-game New Deal asks confirmation | Task 6 |
| Existing pause/resume lifecycle retained | Tasks 2, 6, 7 |
| Developer Console setup recorded | Task 7 |
