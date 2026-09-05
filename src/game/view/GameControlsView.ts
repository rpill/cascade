import type Phaser from 'phaser';

import { createIconControl } from './ui/UiControls.ts';

export interface GameControlsActions {
  readonly undo: () => void;
  readonly restart: () => void;
  readonly newDeal: () => void;
  readonly home: () => void;
}

export class GameControlsView {
  private readonly root: HTMLDivElement;
  private readonly newDealButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: GameControlsActions) {
    this.root = document.createElement('div');
    this.root.className = 'game-controls';
    this.root.setAttribute('aria-label', 'Управление игрой');

    const undo = createIconControl({
      icon: 'undo',
      label: 'Отменить ход',
      tooltip: 'Отменить ход · Z',
      onClick: actions.undo,
    });
    const restart = createIconControl({
      icon: 'restart',
      label: 'Начать раздачу заново',
      tooltip: 'Начать заново · R',
      onClick: actions.restart,
    });
    this.newDealButton = createIconControl({
      icon: 'new-deal',
      label: 'Новая раздача',
      tooltip: 'Новая раздача · N',
      onClick: actions.newDeal,
    });
    const home = createIconControl({
      icon: 'home',
      label: 'На главную',
      tooltip: 'На главную',
      className: 'game-control-home',
      onClick: actions.home,
    });

    this.root.append(undo, restart, this.newDealButton, home);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for screen-space controls.');
    }
    host.append(this.root);
  }

  setDaily(isDaily: boolean): void {
    this.newDealButton.hidden = isDaily;
  }

  destroy(): void {
    this.root.remove();
  }
}
