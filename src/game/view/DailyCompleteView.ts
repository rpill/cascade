import type Phaser from 'phaser';

export interface DailyCompleteState {
  readonly elapsedMs: number;
  readonly bestTimeMs: number;
  readonly improvedBest: boolean;
  readonly weekCompleted: number;
}

export interface DailyCompleteActions {
  readonly retry: () => void;
  readonly menu: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class DailyCompleteView {
  private readonly root: HTMLDivElement;
  private readonly elapsed: HTMLParagraphElement;
  private readonly best: HTMLParagraphElement;
  private readonly weekly: HTMLParagraphElement;

  constructor(scene: Phaser.Scene, actions: DailyCompleteActions) {
    this.root = document.createElement('div');
    this.root.className = 'daily-complete-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'daily-complete-backdrop';

    const panel = document.createElement('section');
    panel.className = 'daily-complete-panel';
    panel.setAttribute('aria-label', 'Результат испытания дня');

    const title = document.createElement('h2');
    title.className = 'daily-complete-title';
    title.textContent = 'ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО';

    const divider = document.createElement('div');
    divider.className = 'daily-complete-divider';
    divider.setAttribute('aria-hidden', 'true');

    this.elapsed = document.createElement('p');
    this.elapsed.className = 'daily-complete-stat';

    this.best = document.createElement('p');
    this.best.className = 'daily-complete-stat daily-complete-best';

    this.weekly = document.createElement('p');
    this.weekly.className = 'daily-complete-weekly';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'daily-complete-actions';

    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'daily-complete-button daily-complete-retry';
    retryButton.textContent = 'ПОВТОРИТЬ';
    retryButton.addEventListener('click', () => actions.retry());

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'daily-complete-button daily-complete-menu';
    menuButton.textContent = 'В МЕНЮ';
    menuButton.addEventListener('click', () => actions.menu());

    buttonRow.append(retryButton, menuButton);
    panel.append(
      title,
      divider,
      this.elapsed,
      this.best,
      this.weekly,
      buttonRow,
    );
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the Daily completion view.');
    }

    host.append(this.root);
    this.hide();
  }

  show(state: DailyCompleteState): void {
    this.elapsed.textContent = `Время: ${formatDuration(state.elapsedMs)}`;
    this.best.textContent = state.improvedBest
      ? `Новый рекорд · ${formatDuration(state.bestTimeMs)}`
      : `Лучшее: ${formatDuration(state.bestTimeMs)}`;
    this.weekly.textContent = `Эта неделя: ${state.weekCompleted} / 7`;

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
