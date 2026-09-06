import type Phaser from 'phaser';

import { createIconControl } from './ui/UiControls.ts';
import { createUiIcon } from './ui/UiIcons.ts';
import { createHomeArtIcon } from './ui/HomeArtIcons.ts';

export type ShellDestination = 'play' | 'statistics' | 'collection' | 'shop' | 'rules';

export interface AppShellActions {
  readonly navigate: (destination: ShellDestination) => void;
  readonly cancel: () => void;
}

export interface AppShellShowOptions {
  readonly canCancel: boolean;
  readonly destination: ShellDestination;
}

const MENU_WOOD_TEXTURE = './assets/theme/menu-dark-wood.jpg';
const MENU_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const MENU_PAPER_PRIMARY = './assets/ui/paper-001-color.jpg';
const MENU_SHELL_FRAME = './assets/ui/frames/home-shell-frame-9slice.png';
const MENU_CARD_FRAME = './assets/ui/frames/home-mode-card-frame-9slice.png';
const MENU_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.png';
const MENU_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.png';
const MENU_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.png';
const MENU_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.png';
const MENU_BRAND_FLOURISH = './assets/ui/ornaments/harpels-flourish.svg';
const MENU_DECOR_BACK = './assets/ui/decor/decor-card-back-red.png';
const MENU_DECOR_QUEEN = './assets/ui/decor/decor-card-queen-spades.png';

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

function toCssUrl(path: string): string {
  return `url("${resolveAssetUrl(path)}")`;
}

export class AppShellView {
  readonly contentHost: HTMLDivElement;

  private readonly root: HTMLDivElement;
  private readonly returnButton: HTMLButtonElement;
  private readonly navButtons = new Map<ShellDestination, HTMLButtonElement>();

  constructor(scene: Phaser.Scene, actions: AppShellActions) {
    this.root = document.createElement('div');
    this.root.className = 'app-shell-dom';
    this.root.style.setProperty('--app-shell-wood', toCssUrl(MENU_WOOD_TEXTURE));
    this.root.style.setProperty('--app-shell-wood-detail', toCssUrl(MENU_WOOD_DETAIL));
    this.root.style.setProperty('--app-shell-paper-primary', toCssUrl(MENU_PAPER_PRIMARY));
    this.root.style.setProperty('--app-shell-ornate-frame', toCssUrl(MENU_SHELL_FRAME));
    this.root.style.setProperty('--app-shell-card-frame', toCssUrl(MENU_CARD_FRAME));
    this.root.style.setProperty('--home-corner-tl', toCssUrl(MENU_CORNER_TL));
    this.root.style.setProperty('--home-corner-tr', toCssUrl(MENU_CORNER_TR));
    this.root.style.setProperty('--home-corner-br', toCssUrl(MENU_CORNER_BR));
    this.root.style.setProperty('--home-corner-bl', toCssUrl(MENU_CORNER_BL));
    this.root.style.setProperty('--app-shell-flourish', toCssUrl(MENU_BRAND_FLOURISH));

    const decor = document.createElement('div');
    decor.className = 'app-shell-decor';
    decor.setAttribute('aria-hidden', 'true');
    decor.append(
      this.createDecorativeCard(MENU_DECOR_BACK, 'app-shell-decor-left'),
      this.createDecorativeCard(MENU_DECOR_BACK, 'app-shell-decor-right-back'),
      this.createDecorativeCard(MENU_DECOR_QUEEN, 'app-shell-decor-right-front'),
    );

    const topbar = document.createElement('header');
    topbar.className = 'app-shell-topbar';

    this.returnButton = document.createElement('button');
    this.returnButton.type = 'button';
    this.returnButton.className = 'app-shell-return';
    this.returnButton.setAttribute('aria-label', 'К игре');
    this.returnButton.title = 'К игре';
    this.returnButton.append(createUiIcon('back'));
    const returnLabel = document.createElement('span');
    returnLabel.textContent = 'К игре';
    this.returnButton.append(returnLabel);
    this.returnButton.addEventListener('click', () => actions.cancel());

    const brand = document.createElement('div');
    brand.className = 'app-shell-brand';
    const brandTitle = document.createElement('div');
    brandTitle.className = 'app-shell-brand-title';
    brandTitle.textContent = 'CASCADE';
    const brandSubtitle = document.createElement('div');
    brandSubtitle.className = 'app-shell-brand-subtitle';
    brandSubtitle.textContent = 'КЛАССИЧЕСКИЙ ПАСЬЯНС';
    const brandFlourish = document.createElement('span');
    brandFlourish.className = 'app-shell-brand-flourish';
    brandFlourish.setAttribute('aria-hidden', 'true');
    brand.append(brandTitle, brandSubtitle, brandFlourish);

    const utilities = document.createElement('div');
    utilities.className = 'app-shell-utilities';
    const rulesButton = createIconControl({
      icon: 'rules',
      label: 'Правила',
      tooltip: 'Правила',
      className: 'app-shell-utility',
      onClick: () => actions.navigate('rules'),
    });
    rulesButton.replaceChildren(createHomeArtIcon('rules'));

    const settingsButton = createIconControl({
      icon: 'settings',
      label: 'Настройки',
      tooltip: 'Настройки',
      className: 'app-shell-utility',
    });
    settingsButton.replaceChildren(createHomeArtIcon('settings'));
    settingsButton.disabled = true;
    settingsButton.setAttribute('aria-disabled', 'true');
    utilities.append(rulesButton, settingsButton);

    topbar.append(this.returnButton, brand, utilities);

    const surface = document.createElement('section');
    surface.className = 'app-shell-surface';
    surface.setAttribute('aria-label', 'CASCADE');

    const nav = document.createElement('nav');
    nav.className = 'app-shell-nav';
    nav.setAttribute('aria-label', 'Разделы');
    nav.append(
      this.createNavButton('play', 'ИГРАТЬ', actions, false),
      this.createNavButton('statistics', 'СТАТИСТИКА', actions, false),
      this.createNavButton('collection', 'КОЛЛЕКЦИЯ', actions, true),
      this.createNavButton('shop', 'МАГАЗИН', actions, true),
    );

    this.contentHost = document.createElement('div');
    this.contentHost.className = 'app-shell-content';

    surface.append(nav, this.contentHost);
    this.root.append(decor, topbar, surface);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the application shell.');
    }
    host.append(this.root);
    this.hide();
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


  private createDecorativeCard(src: string, className: string): HTMLImageElement {
    const image = document.createElement('img');
    image.className = `app-shell-decor-card ${className}`;
    image.src = src;
    image.alt = '';
    image.draggable = false;
    return image;
  }

  private createNavButton(
    destination: ShellDestination,
    label: string,
    actions: AppShellActions,
    disabled: boolean,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-shell-nav-button';
    button.setAttribute('data-destination', destination);
    button.textContent = label;
    button.disabled = disabled;
    if (disabled) {
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.addEventListener('click', () => actions.navigate(destination));
    }
    this.navButtons.set(destination, button);
    return button;
  }
}
