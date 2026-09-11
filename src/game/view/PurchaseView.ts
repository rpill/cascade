import { t } from '../../localization/Localization.ts';
import { createCoinInline } from './ui/CoinInline.ts';

const COIN_PACKS = [500, 1500, 4000] as const;

const PURCHASE_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const PURCHASE_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const PURCHASE_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.png';
const PURCHASE_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.png';
const PURCHASE_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.png';
const PURCHASE_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.png';

function toCssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

export class PurchaseView {
  private readonly root: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly note: HTMLParagraphElement;
  private readonly coinHeading: HTMLHeadingElement;
  private readonly coinRows: readonly { amount: HTMLSpanElement; button: HTMLButtonElement }[];
  private readonly adsHeading: HTMLHeadingElement;
  private readonly adsCopy: HTMLParagraphElement;
  private readonly adsButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private previousFocus: HTMLElement | null = null;

  constructor(host: HTMLElement) {
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
    this.closeButton.textContent = '×';
    this.closeButton.addEventListener('click', () => this.hide());

    this.note = document.createElement('p');
    this.note.className = 'purchase-note';

    this.coinHeading = document.createElement('h3');
    this.coinHeading.className = 'purchase-section-title';

    const packList = document.createElement('div');
    packList.className = 'purchase-pack-list';
    this.coinRows = COIN_PACKS.map((coins) => {
      const row = document.createElement('div');
      row.className = 'purchase-pack';
      const amount = document.createElement('span');
      amount.className = 'purchase-pack-amount';
      amount.dataset.coins = String(coins);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'purchase-pack-button';
      button.disabled = true;
      row.append(amount, button);
      packList.append(row);
      return { amount, button };
    });

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
    this.adsButton.disabled = true;

    this.root.append(
      this.closeButton,
      this.title,
      this.note,
      this.coinHeading,
      packList,
      divider,
      this.adsHeading,
      this.adsCopy,
      this.adsButton,
      this.closeButton,
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

  refreshLocalization(): void {
    this.title.textContent = t('ПОКУПКИ');
    this.note.textContent = t('Покупки будут доступны после подключения платежей Яндекс Игр.');
    this.coinHeading.textContent = t('МОНЕТЫ');
    for (const { amount, button } of this.coinRows) {
      amount.replaceChildren(createCoinInline(String(Number(amount.dataset.coins ?? 0)), {
        className: 'purchase-pack-coin',
        label: t('монет'),
      }));
      button.textContent = t('СКОРО');
    }
    this.adsHeading.textContent = t('УБРАТЬ РЕКЛАМУ');
    this.adsCopy.textContent = t('Отключает обычную рекламу навсегда.');
    this.adsButton.textContent = t('СКОРО');
    this.closeButton.setAttribute('aria-label', t('Закрыть'));
    this.closeButton.setAttribute('title', t('Закрыть'));
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }
}
