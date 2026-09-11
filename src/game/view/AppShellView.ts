import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type Phaser from 'phaser';

import { createIconControl, refreshIconControls } from './ui/UiControls.ts';
import { createUiIcon } from './ui/UiIcons.ts';
import { createHomeArtIcon } from './ui/HomeArtIcons.ts';
import { deferClickThroughAction } from './UiClickBarrier.ts';

export type ShellDestination = 'play' | 'statistics' | 'collection' | 'rules';

export interface AppShellActions {
  readonly navigate: (destination: ShellDestination) => void;
  readonly cancel: () => void;
  readonly settings: () => void;
  readonly purchases: () => void;
}

export interface AppShellShowOptions {
  readonly canCancel: boolean;
  readonly destination: ShellDestination;
}

const MENU_HOME_BACKGROUND = './assets/ui/backgrounds/home-main-menu-ambience.webp';
const MENU_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const MENU_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const MENU_SHELL_FRAME = './assets/ui/frames/home-shell-frame-9slice.webp';
const MENU_CARD_FRAME = './assets/ui/frames/home-mode-card-frame-9slice.webp';
const MENU_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.webp';
const MENU_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.webp';
const MENU_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.webp';
const MENU_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.webp';
const MENU_BRAND_FLOURISH = './assets/ui/ornaments/harpels-flourish.svg';

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

function toCssUrl(path: string): string {
  return `url("${resolveAssetUrl(path)}")`;
}

export class AppShellView {
  private readonly localization = new LocalizationBindings();

  readonly contentHost: HTMLDivElement;

  private readonly root: HTMLDivElement;
  private readonly returnButton: HTMLButtonElement;
  private readonly walletButton: HTMLButtonElement;
  private readonly wallet: HTMLSpanElement;
  private readonly navButtons = new Map<ShellDestination, HTMLButtonElement>();
  private collectionPurchaseAvailable = false;

  constructor(scene: Phaser.Scene, actions: AppShellActions) {
    this.root = document.createElement('div');
    this.root.className = 'app-shell-dom';
    this.root.style.setProperty('--app-shell-wood', toCssUrl(MENU_HOME_BACKGROUND));
    this.root.style.setProperty('--app-shell-wood-detail', toCssUrl(MENU_WOOD_DETAIL));
    this.root.style.setProperty('--app-shell-paper-primary', toCssUrl(MENU_PAPER_PRIMARY));
    this.root.style.setProperty('--app-shell-ornate-frame', toCssUrl(MENU_SHELL_FRAME));
    this.root.style.setProperty('--app-shell-card-frame', toCssUrl(MENU_CARD_FRAME));
    this.root.style.setProperty('--home-corner-tl', toCssUrl(MENU_CORNER_TL));
    this.root.style.setProperty('--home-corner-tr', toCssUrl(MENU_CORNER_TR));
    this.root.style.setProperty('--home-corner-br', toCssUrl(MENU_CORNER_BR));
    this.root.style.setProperty('--home-corner-bl', toCssUrl(MENU_CORNER_BL));
    this.root.style.setProperty('--app-shell-flourish', toCssUrl(MENU_BRAND_FLOURISH));

    const topbar = document.createElement('header');
    topbar.className = 'app-shell-topbar';

    this.returnButton = document.createElement('button');
    this.returnButton.type = 'button';
    this.returnButton.className = 'app-shell-return';
    this.localization.attribute(this.returnButton, 'aria-label', () => t('К игре'));
    this.localization.attribute(this.returnButton, 'title', () => t('К игре'));
    this.returnButton.append(createUiIcon('back'));
    const returnLabel = document.createElement('span');
    this.localization.text(returnLabel, () => t('К игре'));
    this.returnButton.append(returnLabel);
    this.returnButton.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.returnButton.addEventListener('pointerup', (event) => event.stopPropagation());
    this.returnButton.addEventListener('click', (event) => {
      deferClickThroughAction(event, () => actions.cancel());
    });

    const brand = document.createElement('div');
    brand.className = 'app-shell-brand';
    const brandTitle = document.createElement('div');
    brandTitle.className = 'app-shell-brand-title';
    this.localization.text(brandTitle, () => t('КАСКАД'));
    const brandFlourish = document.createElement('span');
    brandFlourish.className = 'app-shell-brand-flourish';
    brandFlourish.setAttribute('aria-hidden', 'true');
    brand.append(brandTitle, brandFlourish);

    const utilities = document.createElement('div');
    utilities.className = 'app-shell-utilities';
    const walletGroup = document.createElement('button');
    walletGroup.type = 'button';
    walletGroup.className = 'app-shell-wallet-group';
    walletGroup.addEventListener('click', () => actions.purchases());
    this.walletButton = walletGroup;
    this.wallet = document.createElement('span');
    this.wallet.className = 'app-shell-wallet';
    this.wallet.setAttribute('aria-hidden', 'true');
    const walletAddButton = document.createElement('span');
    walletAddButton.className = 'app-shell-wallet-add';
    walletAddButton.textContent = '+';
    walletAddButton.setAttribute('aria-hidden', 'true');
    walletGroup.append(this.wallet, walletAddButton);

    const rulesButton = createIconControl({
      icon: 'rules',
      label: 'Как играть',
      tooltip: 'Как играть',
      className: 'app-shell-utility',
      onClick: () => actions.navigate('rules'),
    });
    rulesButton.replaceChildren(createHomeArtIcon('rules'));

    const settingsButton = createIconControl({
      icon: 'settings',
      label: 'Настройки',
      tooltip: 'Настройки',
      className: 'app-shell-utility',
      onClick: () => actions.settings(),
    });
    settingsButton.replaceChildren(createHomeArtIcon('settings'));
    utilities.append(walletGroup, rulesButton, settingsButton);

    topbar.append(this.returnButton, brand, utilities);

    const surface = document.createElement('section');
    surface.className = 'app-shell-surface';
    this.localization.attribute(surface, 'aria-label', () => t('Пасьянс Каскад'));

    const nav = document.createElement('nav');
    nav.className = 'app-shell-nav';
    this.localization.attribute(nav, 'aria-label', () => t('Разделы'));
    nav.append(
      this.createNavButton('play', 'ИГРАТЬ', actions),
      this.createNavButton('statistics', 'СТАТИСТИКА', actions),
      this.createNavButton('collection', 'КОЛЛЕКЦИЯ', actions),
    );

    this.contentHost = document.createElement('div');
    this.contentHost.className = 'app-shell-content';

    surface.append(nav, this.contentHost);
    this.root.append(topbar, surface);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the application shell.');
    }
    host.append(this.root);
    this.setCoins(null);
    this.hide();
  }

  refreshLocalization(): void {
    this.localization.refresh();
    refreshIconControls(this.root);
    this.applyCollectionPurchaseIndicator();
  }

  setCoins(coins: number | null): void {
    const value = coins === null ? '—' : String(Math.max(0, Math.floor(coins)));
    this.localization.text(this.wallet, () => value);
    this.wallet.dataset.ready = String(coins !== null);
    this.localization.attribute(this.walletButton, 'aria-label', () => coins === null
      ? t('Купить монеты. Баланс монет загружается')
      : t('Купить монеты. Монеты: {value0}', { value0: value }));
    this.localization.attribute(this.walletButton, 'title', () => t('Купить монеты'));
  }

  setCollectionPurchaseAvailable(available: boolean): void {
    this.collectionPurchaseAvailable = available;
    this.applyCollectionPurchaseIndicator();
  }

  private applyCollectionPurchaseIndicator(): void {
    const button = this.navButtons.get('collection');
    if (button === undefined) return;
    button.classList.toggle('has-theme-purchase', this.collectionPurchaseAvailable);
    button.toggleAttribute('data-theme-purchase', this.collectionPurchaseAvailable);
    const label = this.collectionPurchaseAvailable
      ? t('КОЛЛЕКЦИЯ. Доступны темы для покупки')
      : t('КОЛЛЕКЦИЯ');
    button.setAttribute('aria-label', label);
    button.title = this.collectionPurchaseAvailable ? t('Доступны темы для покупки') : '';
  }

  show({ canCancel, destination }: AppShellShowOptions): void {
    this.returnButton.hidden = !canCancel;
    this.setDestination(destination);
    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
  }

  setDestination(destination: ShellDestination): void {
    for (const [itemDestination, button] of this.navButtons) {
      const active = itemDestination === destination;
      button.classList.toggle('is-active', active);
      if (active) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }
    this.root.dataset.destination = destination;
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createNavButton(destination: ShellDestination, label: string, actions: AppShellActions): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-shell-nav-button';
    button.dataset.destination = destination;
    button.setAttribute('data-destination', destination);
    this.localization.text(button, () => t(label));
    button.addEventListener('click', (event) => {
      deferClickThroughAction(event, () => actions.navigate(destination));
    });
    this.navButtons.set(destination, button);
    return button;
  }
}
