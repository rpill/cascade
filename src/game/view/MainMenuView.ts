import type Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';

interface MainMenuActions {
  readonly select: (mode: GameMode) => void;
  readonly play: () => void;
  readonly cancel: () => void;
}

interface MainMenuShowOptions {
  readonly canCancel: boolean;
  readonly selectedMode: GameMode | null;
}

export class MainMenuView {
  private readonly actions: MainMenuActions;
  private readonly root: HTMLDivElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;
  private readonly modeButtons = new Map<GameMode, HTMLButtonElement>();

  private selectedMode: GameMode | null = null;

  constructor(scene: Phaser.Scene, actions: MainMenuActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'main-menu-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'main-menu-backdrop';

    const panel = document.createElement('section');
    panel.className = 'main-menu-panel';
    panel.setAttribute('aria-label', 'Главное меню');

    const title = document.createElement('h1');
    title.className = 'main-menu-title';
    title.textContent = 'ГЛАВНОЕ МЕНЮ';

    const intro = document.createElement('p');
    intro.className = 'main-menu-intro';
    intro.textContent = 'Выберите принцип раздачи';

    const original = this.createModeButton(
      'original',
      'ОРИГИНАЛЬНЫЙ',
      'Точный алгоритм Zachtronics. Редкие нерешаемые партии возможны.',
    );
    const winnable = this.createModeButton(
      'winnable',
      'ГАРАНТИРОВАННО РЕШАЕМЫЙ',
      'Только раздачи, для которых офлайн-решатель нашёл полный путь до победы.',
    );

    this.playButton = document.createElement('button');
    this.playButton.type = 'button';
    this.playButton.className = 'main-menu-play';
    this.playButton.textContent = 'ИГРАТЬ';
    this.playButton.addEventListener('click', () => {
      if (this.selectedMode !== null) {
        this.actions.play();
      }
    });

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'main-menu-cancel';
    this.cancelButton.textContent = 'ESC — вернуться к текущей игре';
    this.cancelButton.addEventListener('click', () => this.actions.cancel());

    panel.append(
      title,
      intro,
      original,
      winnable,
      this.playButton,
      this.cancelButton,
    );
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;

    if (host === null) {
      throw new Error('Game canvas must have a parent element for the main menu.');
    }

    host.append(this.root);
    this.hide();
  }

  show({ canCancel, selectedMode }: MainMenuShowOptions): void {
    this.selectedMode = selectedMode;
    this.cancelButton.hidden = !canCancel;
    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    this.updateModeVisuals();
    this.updatePlayState();
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createModeButton(
    mode: GameMode,
    title: string,
    description: string,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-menu-mode';
    button.dataset.mode = mode;

    const heading = document.createElement('span');
    heading.className = 'main-menu-mode-title';
    heading.textContent = title;

    const copy = document.createElement('span');
    copy.className = 'main-menu-mode-copy';
    copy.textContent = description;

    button.append(heading, copy);
    button.addEventListener('click', () => {
      this.selectedMode = mode;
      this.actions.select(mode);
      this.updateModeVisuals();
      this.updatePlayState();
    });

    this.modeButtons.set(mode, button);
    return button;
  }

  private updateModeVisuals(): void {
    this.modeButtons.forEach((button, mode) => {
      button.classList.toggle('is-selected', mode === this.selectedMode);
      button.setAttribute('aria-pressed', String(mode === this.selectedMode));
    });
  }

  private updatePlayState(): void {
    this.playButton.disabled = this.selectedMode === null;
  }
}
