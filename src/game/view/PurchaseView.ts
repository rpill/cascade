import { t } from '../../localization/Localization.ts';
import type { MonetizationViewState } from '../../monetization/MonetizationController.ts';
import { REWARDED_DAILY_LIMIT } from '../../monetization/Products.ts';
import { createCoinInline } from './ui/CoinInline.ts';

const PURCHASE_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const PURCHASE_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const PURCHASE_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.webp';
const PURCHASE_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.webp';
const PURCHASE_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.webp';
const PURCHASE_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.webp';

export interface PurchaseViewActions {
  readonly opened?: () => void;
  readonly rewarded: () => void;
}

function toCssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

function createInitialState(): MonetizationViewState {
  return {
    rewardedBusy: false,
    rewardedAvailable: false,
    rewardedRemaining: REWARDED_DAILY_LIMIT,
    errorMessage: null,
  };
}

export class PurchaseView {
  private readonly root: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly note: HTMLParagraphElement;
  private readonly rewardedRemaining: HTMLSpanElement;
  private readonly rewardedButton: HTMLButtonElement;
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

    const packList = document.createElement('div');
    packList.className = 'purchase-pack-list';
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

    this.root.append(this.closeButton, this.title, this.note, packList);
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
    this.title.textContent = t('МОНЕТЫ');
    this.closeButton.setAttribute('aria-label', t('Закрыть'));
    this.closeButton.setAttribute('title', t('Закрыть'));
    this.renderState();
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }

  private renderState(): void {
    if (this.state.errorMessage !== null) {
      this.note.textContent = t(this.state.errorMessage);
    } else if (!this.state.rewardedAvailable) {
      this.note.textContent = t('Реклама сейчас недоступна.');
    } else {
      this.note.textContent = t('Получайте монеты за просмотр рекламы.');
    }

    if (this.state.rewardedRemaining <= 0) {
      this.rewardedRemaining.textContent = t('Лимит на сегодня исчерпан');
    } else {
      this.rewardedRemaining.textContent = t('Осталось сегодня: {count}', {
        count: this.state.rewardedRemaining,
      });
    }
    this.rewardedButton.replaceChildren(
      document.createTextNode(`${t('Смотреть рекламу')} · `),
      createCoinInline('+25', { className: 'purchase-pack-coin' }),
    );
    this.rewardedButton.setAttribute('aria-label', t('Смотреть рекламу · +25'));
    this.rewardedButton.disabled = !this.state.rewardedAvailable
      || this.state.rewardedBusy
      || this.state.rewardedRemaining <= 0;
    this.rewardedButton.classList.toggle('is-busy', this.state.rewardedBusy);
  }
}
