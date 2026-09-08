import type Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { createIconControl } from './ui/UiControls.ts';
import './GameControlsView.css';

export interface GameControlsActions {
  readonly undo: () => void;
  readonly restart: () => void;
  readonly newDeal: () => void;
  readonly home: () => void;
}

const HUD_PAPER_TEXTURE = './assets/ui/paper-001-color.jpg';

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

function toCssUrl(path: string): string {
  return `url("${resolveAssetUrl(path)}")`;
}

const MODE_LABELS: Readonly<Record<GameMode, string>> = {
  winnable: 'STANDARD',
  original: 'CLASSIC',
  daily: 'DAILY',
};

export class GameControlsView {
  private readonly root: HTMLDivElement;
  private readonly modeLabel: HTMLDivElement;
  private readonly newDealButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: GameControlsActions, theme: ThemeDefinition) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.style.setProperty('--game-hud-paper', toCssUrl(HUD_PAPER_TEXTURE));
    this.setTheme(theme);

    this.modeLabel = document.createElement('div');
    this.modeLabel.className = 'game-mode-label';
    this.modeLabel.setAttribute('aria-label', 'Текущий режим игры');

    const controls = document.createElement('div');
    controls.className = 'game-controls';

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

    controls.append(undo, restart, this.newDealButton, home);
    this.root.append(this.modeLabel, controls);
    scene.game.canvas.parentElement?.append(this.root);
  }

  setMode(mode: GameMode): void {
    this.modeLabel.textContent = MODE_LABELS[mode];
    this.setDaily(mode === 'daily');
  }

  setTheme(theme: ThemeDefinition): void {
    this.root.dataset.theme = theme.id;
    const palette = theme.controls;
    this.root.style.setProperty('--game-control-surface', palette.surface);
    this.root.style.setProperty('--game-control-hover', palette.hover);
    this.root.style.setProperty('--game-control-ink', palette.ink);
    this.root.style.setProperty('--game-control-edge', palette.edge);
    this.root.style.setProperty('--game-label-surface', palette.labelSurface);
    this.root.style.setProperty('--game-label-ink', palette.labelInk);
    this.root.style.setProperty('--game-focus', palette.focus);
  }

  setDaily(isDaily: boolean): void {
    this.newDealButton.hidden = isDaily;
  }

  destroy(): void {
    this.root.remove();
  }
}
