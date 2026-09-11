import { t } from '../../localization/Localization.ts';

const CONFIRM_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const CONFIRM_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const CONFIRM_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.webp';
const CONFIRM_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.webp';
const CONFIRM_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.webp';
const CONFIRM_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.webp';

function toCssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

export class NewDealConfirmView {
  private readonly root: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly copy: HTMLParagraphElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly confirmButton: HTMLButtonElement;
  private resolver: ((confirmed: boolean) => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement('dialog');
    this.root.className = 'new-deal-confirm-dialog';
    this.root.style.setProperty('--new-deal-wood-detail', toCssUrl(CONFIRM_WOOD_DETAIL));
    this.root.style.setProperty('--app-shell-paper-primary', toCssUrl(CONFIRM_PAPER_PRIMARY));
    this.root.style.setProperty('--home-corner-tl', toCssUrl(CONFIRM_CORNER_TL));
    this.root.style.setProperty('--home-corner-tr', toCssUrl(CONFIRM_CORNER_TR));
    this.root.style.setProperty('--home-corner-br', toCssUrl(CONFIRM_CORNER_BR));
    this.root.style.setProperty('--home-corner-bl', toCssUrl(CONFIRM_CORNER_BL));
    this.root.setAttribute('aria-labelledby', 'new-deal-confirm-title');
    this.root.setAttribute('aria-describedby', 'new-deal-confirm-copy');

    this.title = document.createElement('h2');
    this.title.id = 'new-deal-confirm-title';
    this.title.className = 'new-deal-confirm-title';

    this.copy = document.createElement('p');
    this.copy.id = 'new-deal-confirm-copy';
    this.copy.className = 'new-deal-confirm-copy';

    const actions = document.createElement('div');
    actions.className = 'new-deal-confirm-actions';

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'new-deal-confirm-button new-deal-confirm-cancel';
    this.cancelButton.addEventListener('click', () => this.finish(false));

    this.confirmButton = document.createElement('button');
    this.confirmButton.type = 'button';
    this.confirmButton.className = 'new-deal-confirm-button new-deal-confirm-accept';
    this.confirmButton.addEventListener('click', () => this.finish(true));

    actions.append(this.cancelButton, this.confirmButton);
    this.root.append(this.title, this.copy, actions);

    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.finish(false);
    });
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.root.addEventListener('pointerup', (event) => event.stopPropagation());
    this.root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.finish(false);
      }
    });
    this.root.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target !== this.root) return;
      const bounds = this.root.getBoundingClientRect();
      if (
        event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom
      ) {
        this.finish(false);
      }
    });

    host.append(this.root);
    this.refreshLocalization();
  }

  confirm(): Promise<boolean> {
    if (this.resolver !== null) this.finish(false);
    this.previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.refreshLocalization();
    this.root.showModal();
    this.cancelButton.focus();
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  refreshLocalization(): void {
    this.title.textContent = t('Начать новую раздачу?');
    this.copy.textContent = t('Текущая партия будет завершена.');
    this.cancelButton.textContent = t('ОТМЕНА');
    this.confirmButton.textContent = t('НОВАЯ РАЗДАЧА');
  }

  destroy(): void {
    if (this.resolver !== null) this.finish(false);
    else if (this.root.open) this.root.close();
    this.root.remove();
  }

  private finish(confirmed: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    if (this.root.open) this.root.close();
    const previousFocus = this.previousFocus;
    this.previousFocus = null;
    previousFocus?.focus({ preventScroll: true });
    resolve?.(confirmed);
  }
}
