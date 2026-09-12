import { t } from '../../localization/Localization.ts';
import type { MonetizationViewState, StoreProductView } from '../../monetization/MonetizationController.ts';
import {
  COIN_PRODUCT_IDS,
  getCoinGrantForProduct,
  REMOVE_ADS_PRODUCT_ID,
  REWARDED_DAILY_LIMIT,
  type CoinProductId,
  type MonetizationProductId,
} from '../../monetization/Products.ts';
import { createCoinInline } from './ui/CoinInline.ts';

const PURCHASE_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const PURCHASE_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const PURCHASE_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.webp';
const PURCHASE_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.webp';
const PURCHASE_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.webp';
const PURCHASE_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.webp';

export interface PurchaseViewActions {
  readonly opened?: () => void;
  readonly purchase: (productId: MonetizationProductId) => void;
  readonly rewarded: () => void;
  readonly retry: () => void;
}

interface CoinRow {
  readonly id: CoinProductId;
  readonly coins: number;
  readonly amount: HTMLSpanElement;
  readonly button: HTMLButtonElement;
}

function toCssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

function createInitialState(): MonetizationViewState {
  return {
    paymentsStatus: 'loading',
    products: {},
    busyProductId: null,
    rewardedBusy: false,
    rewardedAvailable: false,
    rewardedRemaining: REWARDED_DAILY_LIMIT,
    removeAdsOwned: false,
    errorMessage: null,
  };
}

export class PurchaseView {
  private readonly root: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly note: HTMLParagraphElement;
  private readonly retryButton: HTMLButtonElement;
  private readonly coinHeading: HTMLHeadingElement;
  private readonly coinRows: readonly CoinRow[];
  private readonly rewardedRemaining: HTMLSpanElement;
  private readonly rewardedButton: HTMLButtonElement;
  private readonly adsHeading: HTMLHeadingElement;
  private readonly adsCopy: HTMLParagraphElement;
  private readonly adsButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly actions: PurchaseViewActions;
  private previousFocus: HTMLElement | null = null;
  private state: MonetizationViewState = createInitialState();

  constructor(host: HTMLElement, actions: PurchaseViewActions) {
    this.actions = actions;
    this.root = document.createElement('dialog');
    this.root.className = 'purchase-dialog';
    this.root.style.setProperty('--purchase-wood-detail', toCssUrl(PURCHASE_WOOD_DETAIL));
    this.root.style.setProperty('--app-shell-paper-primary', toCssUrl(PURCHASE_PAPER_PRIMARY));
    this.root.style.setProperty('--home-corner-tl', toCssUrl(PURCHASE_CORNER_TL));
    this.root.style.setProperty('--home-corner-tr', toCssUrl(PURCHASE_CORNER_TR));
    this.root.style.setProperty('--home-corner-br', toCssUrl(PURCHASE_CORNER_BR));
    this.root.style.setProperty('--home-corner-bl', toCssUrl(PURCHASE_CORNER_BL));
    this.root.setAttribute('aria-labelledby', 'purchase-title');

    this.title = document.createElement('h2');
    this.title.id = 'purchase-title';
    this.title.className = 'purchase-title';

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'purchase-close-icon';
    const closeGlyph = document.createElement('span');
    closeGlyph.className = 'purchase-close-glyph';
    closeGlyph.textContent = '×';
    this.closeButton.append(closeGlyph);
    this.closeButton.addEventListener('click', () => this.hide());

    this.note = document.createElement('p');
    this.note.className = 'purchase-note';

    this.retryButton = document.createElement('button');
    this.retryButton.type = 'button';
    this.retryButton.className = 'purchase-retry';
    this.retryButton.hidden = true;
    this.retryButton.addEventListener('click', () => this.actions.retry());

    this.coinHeading = document.createElement('h3');
    this.coinHeading.className = 'purchase-section-title';

    const packList = document.createElement('div');
    packList.className = 'purchase-pack-list';
    this.coinRows = COIN_PRODUCT_IDS.map((id) => {
      const coins = getCoinGrantForProduct(id) ?? 0;
      const row = document.createElement('div');
      row.className = 'purchase-pack';
      const amount = document.createElement('span');
      amount.className = 'purchase-pack-amount';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'purchase-pack-button';
      button.addEventListener('click', () => this.actions.purchase(id));
      row.append(amount, button);
      packList.append(row);
      return { id, coins, amount, button };
    });

    const rewardedRow = document.createElement('div');
    rewardedRow.className = 'purchase-pack purchase-rewarded-row';
    this.rewardedRemaining = document.createElement('span');
    this.rewardedRemaining.className = 'purchase-rewarded-remaining';
    this.rewardedButton = document.createElement('button');
    this.rewardedButton.type = 'button';
    this.rewardedButton.className = 'purchase-pack-button purchase-rewarded-button';
    this.rewardedButton.addEventListener('click', () => this.actions.rewarded());
    rewardedRow.append(this.rewardedRemaining, this.rewardedButton);
    packList.append(rewardedRow);

    const divider = document.createElement('div');
    divider.className = 'purchase-divider';
    divider.setAttribute('aria-hidden', 'true');

    this.adsHeading = document.createElement('h3');
    this.adsHeading.className = 'purchase-section-title';
    this.adsCopy = document.createElement('p');
    this.adsCopy.className = 'purchase-ads-copy';
    this.adsButton = document.createElement('button');
    this.adsButton.type = 'button';
    this.adsButton.className = 'purchase-pack-button purchase-ads-button';
    this.adsButton.addEventListener('click', () => this.actions.purchase(REMOVE_ADS_PRODUCT_ID));

    this.root.append(
      this.closeButton,
      this.title,
      this.note,
      this.retryButton,
      this.coinHeading,
      packList,
      divider,
      this.adsHeading,
      this.adsCopy,
      this.adsButton,
    );
    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.hide();
    });
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.root.addEventListener('pointerup', (event) => event.stopPropagation());
    this.root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.hide();
      }
    });
    this.root.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target === this.root) {
        const bounds = this.root.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom
        ) this.hide();
      }
    });

    host.append(this.root);
    this.refreshLocalization();
  }

  get isOpen(): boolean { return this.root.open; }

  show(): void {
    if (this.root.open) return;
    this.actions.opened?.();
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.refreshLocalization();
    this.root.showModal();
    this.closeButton.focus();
  }

  hide(): void {
    if (!this.root.open) return;
    this.root.close();
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  update(state: MonetizationViewState): void {
    this.state = state;
    this.renderState();
  }

  refreshLocalization(): void {
    this.title.textContent = t('ПОКУПКИ');
    this.coinHeading.textContent = t('МОНЕТЫ');
    this.adsHeading.textContent = t('УБРАТЬ РЕКЛАМУ');
    this.retryButton.textContent = t('ПОВТОРИТЬ');
    this.closeButton.setAttribute('aria-label', t('Закрыть'));
    this.closeButton.setAttribute('title', t('Закрыть'));
    this.renderState();
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }

  private renderState(): void {
    this.renderStatus();

    for (const row of this.coinRows) {
      row.amount.replaceChildren(createCoinInline(String(row.coins), {
        className: 'purchase-pack-coin',
        label: t('монет'),
      }));
      this.renderPurchaseButton(row.button, row.id, this.state.products[row.id]);
    }

    if (this.state.rewardedRemaining <= 0) {
      this.rewardedRemaining.textContent = t('Лимит на сегодня исчерпан');
    } else {
      this.rewardedRemaining.textContent = t('Осталось сегодня: {count}', {
        count: this.state.rewardedRemaining,
      });
    }
    this.rewardedButton.textContent = t('Смотреть рекламу · +25');
    this.rewardedButton.disabled = !this.state.rewardedAvailable
      || this.state.rewardedBusy
      || this.state.rewardedRemaining <= 0;
    this.rewardedButton.classList.toggle('is-busy', this.state.rewardedBusy);

    this.adsCopy.textContent = `${t('Отключает обычную рекламу навсегда.')} ${t('Реклама за награду остаётся добровольной.')}`;
    if (this.state.removeAdsOwned) {
      this.adsButton.replaceChildren(document.createTextNode(t('КУПЛЕНО')));
      this.adsButton.disabled = true;
      this.adsButton.classList.add('is-owned');
      this.adsButton.classList.remove('is-busy');
    } else {
      this.adsButton.classList.remove('is-owned');
      this.renderPurchaseButton(
        this.adsButton,
        REMOVE_ADS_PRODUCT_ID,
        this.state.products[REMOVE_ADS_PRODUCT_ID],
      );
    }
  }

  private renderStatus(): void {
    const { paymentsStatus, errorMessage } = this.state;
    this.retryButton.hidden = paymentsStatus !== 'error';

    if (errorMessage !== null) {
      this.note.textContent = t(errorMessage);
      return;
    }
    if (paymentsStatus === 'loading') {
      this.note.textContent = t('Покупки загружаются…');
      return;
    }
    if (paymentsStatus === 'unavailable') {
      this.note.textContent = t('Платежи сейчас недоступны.');
      return;
    }
    if (paymentsStatus === 'error') {
      this.note.textContent = t('Не удалось загрузить покупки. Повторите попытку.');
      return;
    }
    this.note.textContent = t('Цены загружаются напрямую из Яндекс Игр.');
  }

  private renderPurchaseButton(
    button: HTMLButtonElement,
    productId: MonetizationProductId,
    product: StoreProductView | undefined,
  ): void {
    const busy = this.state.busyProductId === productId;
    button.classList.toggle('is-busy', busy);
    button.disabled = busy || this.state.paymentsStatus !== 'ready' || product === undefined;

    if (busy) {
      button.replaceChildren(document.createTextNode(t('ПОКУПКА…')));
      return;
    }
    if (product === undefined) {
      button.replaceChildren(document.createTextNode(t('НЕДОСТУПНО')));
      return;
    }

    button.replaceChildren();
    if (product.currencyImageUrl) {
      const value = document.createElement('span');
      value.className = 'purchase-price-value';
      value.textContent = product.priceValue || product.price;
      const currency = document.createElement('img');
      currency.className = 'purchase-currency-icon';
      currency.src = product.currencyImageUrl;
      currency.alt = product.priceCurrencyCode;
      currency.title = product.priceCurrencyCode;
      button.append(value, currency);
    } else {
      button.append(document.createTextNode(product.price));
    }
    button.setAttribute('aria-label', product.price);
  }
}
