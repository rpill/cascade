import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type Phaser from 'phaser';
import { RewardSummaryView, type RewardSummaryState } from './RewardSummaryView.ts';

export interface GameCompleteState {
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly bestTimeMs: number;
  readonly improvedBest: boolean;
  readonly wins: number;
  readonly played: number;
  readonly reward?: RewardSummaryState;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getModeLabel(mode: GameCompleteState['mode']): string {
  return mode === 'winnable' ? t('СТАНДАРТ') : t('КЛАССИКА');
}

export class GameCompleteView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
    this.rewardSummary.refreshLocalization();
  }

  private readonly root: HTMLDivElement;
  private readonly mode: HTMLParagraphElement;
  private readonly elapsed: HTMLParagraphElement;
  private readonly best: HTMLParagraphElement;
  private readonly record: HTMLParagraphElement;
  private readonly stats: HTMLParagraphElement;
  private readonly rewardSummary: RewardSummaryView;

  constructor(scene: Phaser.Scene, actions: GameCompleteActions) {
    this.root = document.createElement('div');
    this.root.className = 'daily-complete-dom game-complete-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'daily-complete-backdrop game-complete-backdrop';

    const panel = document.createElement('section');
    panel.className = 'daily-complete-panel game-complete-panel';
    this.localization.attribute(panel, 'aria-label', () => t('Результат партии'));

    const title = document.createElement('h2');
    title.className = 'daily-complete-title game-complete-title';
    this.localization.text(title, () => t('ПОБЕДА'));

    const divider = document.createElement('div');
    divider.className = 'daily-complete-divider game-complete-divider';
    divider.setAttribute('aria-hidden', 'true');

    this.mode = document.createElement('p');
    this.mode.className = 'daily-complete-stat game-complete-mode';

    this.elapsed = document.createElement('p');
    this.elapsed.className = 'daily-complete-stat';

    this.best = document.createElement('p');
    this.best.className = 'daily-complete-stat';

    this.record = document.createElement('p');
    this.record.className = 'daily-complete-stat daily-complete-best game-complete-record';

    this.stats = document.createElement('p');
    this.stats.className = 'daily-complete-weekly game-complete-stats';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'daily-complete-actions';

    const newGameButton = document.createElement('button');
    newGameButton.type = 'button';
    newGameButton.className = 'daily-complete-button game-complete-new-game';
    this.localization.text(newGameButton, () => t('ЕЩЁ ПАРТИЯ'));
    newGameButton.addEventListener('click', () => actions.newGame());

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'daily-complete-button game-complete-menu';
    this.localization.text(menuButton, () => t('В МЕНЮ'));
    menuButton.addEventListener('click', () => actions.menu());

    buttonRow.append(newGameButton, menuButton);
    panel.append(
      title,
      divider,
      this.mode,
      this.elapsed,
      this.best,
      this.record,
      this.stats,
    );
    this.rewardSummary = new RewardSummaryView(panel);
    panel.append(buttonRow);
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the completion view.');
    }

    host.append(this.root);
    this.hide();
  }

  show(state: GameCompleteState): void {
    const winRate = state.played === 0
      ? 0
      : Math.round(state.wins / state.played * 100);

    this.localization.text(this.mode, () => getModeLabel(state.mode));
    this.localization.text(this.elapsed, () => t("Время: {value0}", {value0: formatDuration(state.elapsedMs)}));
    this.localization.text(this.best, () => t("Лучшее: {value0}", {value0: formatDuration(state.bestTimeMs)}));
    this.localization.text(this.record, () => state.improvedBest ? t('Новый рекорд') : '');
    this.record.hidden = !state.improvedBest;
    this.localization.text(this.stats, () => t("Победы: {value0} / {value1} · {value2}%", {value0: state.wins, value1: state.played, value2: winRate}));
    this.rewardSummary.update(state.reward);

    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }
}
