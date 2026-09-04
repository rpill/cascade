import type Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';

interface MainMenuActions {
  readonly play: (mode: GameMode) => void;
  readonly leaderboard: () => void;
  readonly cancel: () => void;
}

export interface DailyMenuState {
  readonly available: boolean;
  readonly dailyId: string | null;
  readonly completed: boolean;
  readonly bestTimeMs: number | null;
  readonly weekId: string | null;
  readonly weekDailyIds: readonly string[];
  readonly completedDailyIds: readonly string[];
}

export interface MenuModeStats {
  readonly played: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
}

export interface OrdinaryMenuState {
  readonly winnable: MenuModeStats;
  readonly original: MenuModeStats;
  readonly leaderboardsAvailable: boolean;
}

interface MainMenuShowOptions {
  readonly canCancel: boolean;
  readonly selectedMode: GameMode | null;
  readonly daily: DailyMenuState;
  readonly ordinary: OrdinaryMenuState;
}

const UNAVAILABLE_DAILY_STATE: DailyMenuState = {
  available: false,
  dailyId: null,
  completed: false,
  bestTimeMs: null,
  weekId: null,
  weekDailyIds: [],
  completedDailyIds: [],
};

const UNAVAILABLE_ORDINARY_STATE: OrdinaryMenuState = {
  winnable: { played: 0, wins: 0, bestTimeMs: null },
  original: { played: 0, wins: 0, bestTimeMs: null },
  leaderboardsAvailable: false,
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const WEEKLY_MILESTONES = [3, 5, 7] as const;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getWinRate({ played, wins }: MenuModeStats): number {
  return played === 0 ? 0 : Math.round((wins / played) * 100);
}

function formatBest(bestTimeMs: number | null): string {
  return bestTimeMs === null ? '—' : formatDuration(bestTimeMs);
}

function formatWeekLabel(weekId: string): string {
  const match = /^\d{4}-W(\d{2})$/.exec(weekId);
  return match === null ? weekId : String(Number(match[1]));
}

export class MainMenuView {
  private readonly actions: MainMenuActions;
  private readonly root: HTMLDivElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly leaderboardButton: HTMLButtonElement;
  private readonly modeButtons = new Map<GameMode, HTMLButtonElement>();
  private readonly modeCopies = new Map<GameMode, HTMLSpanElement>();
  private readonly statSummaries = new Map<'winnable' | 'original', HTMLDivElement>();
  private readonly statBests = new Map<'winnable' | 'original', HTMLDivElement>();
  private readonly weekly: HTMLElement;
  private readonly weeklyTitle: HTMLDivElement;
  private readonly weeklyDays: HTMLDivElement;
  private readonly weeklyMilestones: HTMLDivElement;

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
    intro.textContent = 'Выберите режим игры';

    const divider = document.createElement('div');
    divider.className = 'main-menu-divider';
    divider.setAttribute('aria-hidden', 'true');

    const winnable = this.createModeButton(
      'winnable',
      'СТАНДАРТ',
      'Проверенные решаемые раздачи для обычной игры.',
    );
    const original = this.createModeButton(
      'original',
      'КЛАССИКА',
      'Оригинальный алгоритм раздачи. Редкие нерешаемые партии возможны.',
    );
    const daily = this.createModeButton(
      'daily',
      'ИСПЫТАНИЕ ДНЯ',
      'Серверное время недоступно',
    );

    this.weekly = document.createElement('section');
    this.weekly.className = 'main-menu-weekly';
    this.weekly.setAttribute('aria-label', 'Прогресс недели');

    this.weeklyTitle = document.createElement('div');
    this.weeklyTitle.className = 'main-menu-weekly-title';

    this.weeklyDays = document.createElement('div');
    this.weeklyDays.className = 'main-menu-weekly-days';

    this.weeklyMilestones = document.createElement('div');
    this.weeklyMilestones.className = 'main-menu-weekly-milestones';

    this.weekly.append(
      this.weeklyTitle,
      this.weeklyDays,
      this.weeklyMilestones,
    );

    const stats = document.createElement('section');
    stats.className = 'main-menu-stats';
    stats.setAttribute('aria-label', 'Статистика');

    const statsTitle = document.createElement('div');
    statsTitle.className = 'main-menu-stats-title';
    statsTitle.textContent = 'СТАТИСТИКА';

    const standardStats = this.createStatMode('winnable', 'СТАНДАРТ');
    const classicStats = this.createStatMode('original', 'КЛАССИКА');

    this.leaderboardButton = document.createElement('button');
    this.leaderboardButton.type = 'button';
    this.leaderboardButton.className = 'main-menu-leaderboard';
    this.leaderboardButton.textContent = 'ТАБЛИЦА ЛИДЕРОВ';
    this.leaderboardButton.addEventListener('click', () => {
      if (!this.leaderboardButton.disabled) {
        this.actions.leaderboard();
      }
    });

    stats.append(
      statsTitle,
      standardStats,
      classicStats,
      this.leaderboardButton,
    );

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'main-menu-cancel';
    this.cancelButton.textContent = 'ЗАКРЫТЬ';
    this.cancelButton.setAttribute('aria-label', 'Закрыть меню и вернуться к текущей игре');
    this.cancelButton.addEventListener('click', () => this.actions.cancel());

    panel.append(
      title,
      intro,
      divider,
      winnable,
      original,
      daily,
      this.weekly,
      stats,
      this.cancelButton,
    );
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;

    if (host === null) {
      throw new Error('Game canvas must have a parent element for the main menu.');
    }

    host.append(this.root);
    this.updateDailyState(UNAVAILABLE_DAILY_STATE);
    this.updateOrdinaryState(UNAVAILABLE_ORDINARY_STATE);
    this.hide();
  }

  show({
    canCancel,
    selectedMode,
    daily,
    ordinary,
  }: MainMenuShowOptions): void {
    this.selectedMode = selectedMode;
    this.updateDailyState(daily);
    this.updateOrdinaryState(ordinary);
    this.cancelButton.hidden = !canCancel;
    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    this.updateModeVisuals();
  }

  updateDailyState(state: DailyMenuState): void {
    const dailyButton = this.modeButtons.get('daily');
    const dailyCopy = this.modeCopies.get('daily');

    if (dailyButton !== undefined) {
      dailyButton.disabled = !state.available;
      dailyButton.classList.toggle('is-disabled', !state.available);
    }

    if (dailyCopy !== undefined) {
      if (!state.available) {
        dailyCopy.textContent = 'Серверное время недоступно';
      } else if (state.completed) {
        dailyCopy.textContent = state.bestTimeMs === null
          ? 'Пройдено'
          : `Пройдено · Лучшее время ${formatDuration(state.bestTimeMs)}`;
      } else {
        dailyCopy.textContent = state.dailyId ?? 'Сегодня';
      }
    }

    const completed = new Set(state.completedDailyIds);
    const weekCompleted = state.weekDailyIds
      .filter((dailyId) => completed.has(dailyId)).length;
    const hasWeek = state.available
      && state.weekId !== null
      && state.weekDailyIds.length === WEEKDAY_LABELS.length;

    this.weekly.hidden = !hasWeek;

    if (hasWeek) {
      this.weeklyTitle.textContent = `НЕДЕЛЯ ${formatWeekLabel(state.weekId!)} · ${weekCompleted}/7`;
      this.weeklyDays.textContent = state.weekDailyIds
        .map((dailyId, index) => `${WEEKDAY_LABELS[index]} ${completed.has(dailyId) ? '✓' : '○'}`)
        .join(' · ');
      this.weeklyMilestones.textContent = WEEKLY_MILESTONES
        .map((milestone) => `${milestone} ${weekCompleted >= milestone ? '✓' : '○'}`)
        .join(' · ');
    } else {
      this.weeklyTitle.textContent = '';
      this.weeklyDays.textContent = '';
      this.weeklyMilestones.textContent = '';
    }

    this.updateModeVisuals();
  }

  updateOrdinaryState(state: OrdinaryMenuState): void {
    this.updateModeStats('winnable', state.winnable);
    this.updateModeStats('original', state.original);
    this.leaderboardButton.disabled = !state.leaderboardsAvailable;
    this.leaderboardButton.classList.toggle('is-disabled', !state.leaderboardsAvailable);
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
      if (button.disabled) {
        return;
      }

      this.selectedMode = mode;
      this.updateModeVisuals();
      this.actions.play(mode);
    });

    this.modeButtons.set(mode, button);
    this.modeCopies.set(mode, copy);
    return button;
  }

  private createStatMode(
    mode: 'winnable' | 'original',
    title: string,
  ): HTMLElement {
    const block = document.createElement('div');
    block.className = 'main-menu-stat-mode';

    const heading = document.createElement('div');
    heading.className = 'main-menu-stat-heading';
    heading.textContent = title;

    const summary = document.createElement('div');
    summary.className = 'main-menu-stat-line';

    const best = document.createElement('div');
    best.className = 'main-menu-stat-line main-menu-stat-best';

    block.append(heading, summary, best);
    this.statSummaries.set(mode, summary);
    this.statBests.set(mode, best);
    return block;
  }

  private updateModeStats(
    mode: 'winnable' | 'original',
    stats: MenuModeStats,
  ): void {
    const summary = this.statSummaries.get(mode);
    const best = this.statBests.get(mode);

    if (summary !== undefined) {
      summary.textContent = `${stats.played} партий · ${stats.wins} побед · ${getWinRate(stats)}%`;
    }

    if (best !== undefined) {
      best.textContent = `Лучшее время: ${formatBest(stats.bestTimeMs)}`;
    }
  }

  private updateModeVisuals(): void {
    this.modeButtons.forEach((button, mode) => {
      const selected = mode === this.selectedMode && !button.disabled;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
}
