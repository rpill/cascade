import type Phaser from 'phaser';

export interface StatisticsModeState {
  readonly played: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
}

export interface StatisticsViewState {
  readonly winnable: StatisticsModeState;
  readonly original: StatisticsModeState;
}

export interface StatisticsViewActions {
  readonly close: () => void;
}

interface StatisticsModeElements {
  readonly played: HTMLSpanElement;
  readonly wins: HTMLSpanElement;
  readonly winRate: HTMLSpanElement;
  readonly best: HTMLSpanElement;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getWinRate({ played, wins }: StatisticsModeState): number {
  return played === 0 ? 0 : Math.round((wins / played) * 100);
}

function formatBest(bestTimeMs: number | null): string {
  return bestTimeMs === null ? '—' : formatDuration(bestTimeMs);
}

export class StatisticsView {
  private readonly actions: StatisticsViewActions;
  private readonly root: HTMLDivElement;
  private readonly modes = new Map<'winnable' | 'original', StatisticsModeElements>();

  constructor(scene: Phaser.Scene, actions: StatisticsViewActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'statistics-dom meta-modal-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'meta-modal-backdrop';

    const panel = document.createElement('section');
    panel.className = 'meta-modal-panel statistics-panel';
    panel.setAttribute('aria-label', 'Статистика');

    const title = document.createElement('h2');
    title.className = 'meta-modal-title';
    title.textContent = 'СТАТИСТИКА';

    const standard = this.createModeBlock('winnable', 'СТАНДАРТ');
    const classic = this.createModeBlock('original', 'КЛАССИКА');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'meta-modal-close';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.actions.close());

    panel.append(title, standard, classic, close);
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;

    if (host === null) {
      throw new Error('Game canvas must have a parent element for the statistics modal.');
    }

    host.append(this.root);
    this.hide();
  }

  show(state: StatisticsViewState): void {
    this.update(state);
    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
  }

  update(state: StatisticsViewState): void {
    this.updateMode('winnable', state.winnable);
    this.updateMode('original', state.original);
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createModeBlock(
    mode: 'winnable' | 'original',
    titleText: string,
  ): HTMLElement {
    const block = document.createElement('section');
    block.className = 'statistics-mode';

    const title = document.createElement('h3');
    title.className = 'statistics-mode-title';
    title.textContent = titleText;

    const played = this.createValueRow('Партий:');
    const wins = this.createValueRow('Побед:');
    const winRate = this.createValueRow('Процент побед:');
    const best = this.createValueRow('Лучшее время:');

    block.append(title, played.row, wins.row, winRate.row, best.row);
    this.modes.set(mode, {
      played: played.value,
      wins: wins.value,
      winRate: winRate.value,
      best: best.value,
    });
    return block;
  }

  private createValueRow(labelText: string): {
    row: HTMLDivElement;
    value: HTMLSpanElement;
  } {
    const row = document.createElement('div');
    row.className = 'statistics-row';

    const label = document.createElement('span');
    label.textContent = labelText;

    const value = document.createElement('span');
    value.className = 'statistics-value';

    row.append(label, value);
    return { row, value };
  }

  private updateMode(
    mode: 'winnable' | 'original',
    state: StatisticsModeState,
  ): void {
    const elements = this.modes.get(mode);

    if (elements === undefined) {
      return;
    }

    elements.played.textContent = String(state.played);
    elements.wins.textContent = String(state.wins);
    elements.winRate.textContent = `${getWinRate(state)}%`;
    elements.best.textContent = formatBest(state.bestTimeMs);
  }
}
