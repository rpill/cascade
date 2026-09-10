import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { createIconControl, refreshIconControls } from './ui/UiControls.ts';
import './GameControlsView.css';

export interface GameControlsActions {
  readonly undo: () => void;
  readonly hint: () => void;
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

export class GameControlsView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
    refreshIconControls(this.root);
  }

  private readonly root: HTMLDivElement;
  private readonly modeLabel: HTMLDivElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly newDealButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: GameControlsActions, theme: ThemeDefinition) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.style.setProperty('--game-hud-paper', toCssUrl(HUD_PAPER_TEXTURE));
    this.setTheme(theme);

    this.modeLabel = document.createElement('div');
    this.modeLabel.className = 'game-mode-label';
    this.localization.attribute(this.modeLabel, 'aria-label', () => t('Текущий режим игры'));

    const controls = document.createElement('div');
    controls.className = 'game-controls';

    const assistGroup = document.createElement('div');
    assistGroup.className = 'game-control-assist-group';

    const undo = createIconControl({
      icon: 'undo',
      label: 'Отменить ход',
      tooltip: 'Отменить ход · Z',
      className: 'game-control-assist game-control-undo',
      onClick: actions.undo,
    });
    this.undoButton = undo;
    this.undoButton.disabled = true;

    const hint = createIconControl({
      icon: 'hint',
      label: 'Подсказка',
      tooltip: 'Подсказка',
      className: 'game-control-assist game-control-hint',
      onClick: actions.hint,
    });
    this.hintButton = hint;
    this.setHintEnabled(false);
    assistGroup.append(undo, hint);

    const dealGroup = document.createElement('div');
    dealGroup.className = 'game-control-deal-group';

    const restart = createIconControl({
      icon: 'restart',
      label: 'Начать раздачу заново',
      tooltip: 'Начать заново · R',
      className: 'game-control-restart',
      onClick: actions.restart,
    });

    this.newDealButton = createIconControl({
      icon: 'new-deal',
      label: 'Новая раздача',
      tooltip: 'Новая раздача · N',
      className: 'game-control-new-deal',
      onClick: actions.newDeal,
    });
    const newDealLabel = document.createElement('span');
    newDealLabel.className = 'game-control-new-deal-label';
    this.localization.text(newDealLabel, () => t('Новая раздача'));
    this.newDealButton.append(newDealLabel);
    dealGroup.append(restart, this.newDealButton);

    const home = createIconControl({
      icon: 'home',
      label: 'На главную',
      tooltip: 'На главную',
      className: 'game-control-home',
      onClick: actions.home,
    });

    controls.append(assistGroup, dealGroup, home);
    this.root.append(this.modeLabel, controls);
    scene.game.canvas.parentElement?.append(this.root);
  }

  setUndoEnabled(enabled: boolean): void {
    this.undoButton.disabled = !enabled;
  }

  setHintEnabled(enabled: boolean): void {
    this.hintButton.disabled = !enabled;
  }

  emphasizeUndo(): void {
    this.undoButton.classList.remove('is-hint-attention');
    void this.undoButton.offsetWidth;
    this.undoButton.classList.add('is-hint-attention');
    window.setTimeout(() => this.undoButton.classList.remove('is-hint-attention'), 650);
  }

  setMode(mode: GameMode): void {
    this.modeLabel.hidden = mode !== 'daily';
    this.localization.text(this.modeLabel, () => mode === 'daily' ? t('ИСПЫТАНИЕ ДНЯ') : '');
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
