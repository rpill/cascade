import type { GameMode } from '../model/types.ts';
import { createHomeArtIcon, type HomeArtIconName } from './ui/HomeArtIcons.ts';

export interface DailyMenuState {
  readonly available: boolean;
  readonly dailyId: string | null;
  readonly completed: boolean;
  readonly bestTimeMs: number | null;
  readonly weekId: string | null;
  readonly weekDailyIds: readonly string[];
  readonly completedDailyIds: readonly string[];
}

export interface PlayPageActions {
  readonly play: (mode: GameMode) => void;
  readonly leaderboard: () => void;
}

interface ModeCardParts {
  readonly root: HTMLElement;
  readonly copy: HTMLParagraphElement;
  readonly button: HTMLButtonElement;
  readonly dailyProgress?: HTMLDivElement;
  readonly dailyDots?: HTMLDivElement;
  readonly dailyCount?: HTMLSpanElement;
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

const RUSSIAN_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

function formatDailyDate(dailyId: string | null): string {
  if (dailyId === null) {
    return 'Сегодня';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dailyId);
  if (match === null) {
    return 'Сегодня';
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return 'Сегодня';
  }

  return `${day} ${RUSSIAN_MONTHS[month - 1]}`;
}

export class PlayPageView {
  private readonly actions: PlayPageActions;
  private readonly root: HTMLElement;
  private readonly modeCards = new Map<GameMode, ModeCardParts>();
  private readonly weekly: HTMLElement;
  private readonly weeklyDots: HTMLDivElement;
  private readonly weeklyCount: HTMLSpanElement;
  private readonly leaderboardButton: HTMLButtonElement;
  private selectedMode: GameMode | null = null;

  constructor(host: HTMLElement, actions: PlayPageActions) {
    this.actions = actions;
    this.root = document.createElement('section');
    this.root.className = 'main-shell-play';
    this.root.setAttribute('aria-label', 'Играть');

    const grid = document.createElement('div');
    grid.className = 'main-shell-mode-grid';
    grid.append(
      this.createModeCard('winnable', 'spade', 'СТАНДАРТ', 'Проверенные раздачи'),
      this.createModeCard('daily', 'crown', 'ИСПЫТАНИЕ ДНЯ', 'Серверное время недоступно'),
      this.createModeCard('original', 'heart', 'КЛАССИКА', 'Случайные раздачи'),
    );

    const footer = document.createElement('div');
    footer.className = 'main-shell-play-footer';

    this.weekly = document.createElement('section');
    this.weekly.className = 'main-shell-weekly';
    this.weekly.setAttribute('aria-label', 'Прогресс недели');

    const weeklyIcon = document.createElement('span');
    weeklyIcon.className = 'main-shell-weekly-icon';
    weeklyIcon.setAttribute('aria-hidden', 'true');
    weeklyIcon.append(createHomeArtIcon('calendar'));

    const weeklyLabel = document.createElement('span');
    weeklyLabel.className = 'main-shell-weekly-label';
    weeklyLabel.textContent = 'На этой неделе';

    this.weeklyDots = document.createElement('div');
    this.weeklyDots.className = 'main-shell-week-dots';
    this.weeklyCount = document.createElement('span');
    this.weeklyCount.className = 'main-shell-week-count';
    this.weekly.append(weeklyIcon, weeklyLabel, this.weeklyDots, this.weeklyCount);

    this.leaderboardButton = document.createElement('button');
    this.leaderboardButton.type = 'button';
    this.leaderboardButton.className = 'main-shell-secondary-action main-shell-leaderboard';
    const leaderboardIcon = document.createElement('span');
    leaderboardIcon.className = 'main-shell-leaderboard-icon';
    leaderboardIcon.setAttribute('aria-hidden', 'true');
    leaderboardIcon.append(createHomeArtIcon('trophy'));
    const leaderboardLabel = document.createElement('span');
    leaderboardLabel.textContent = 'Таблица лидеров';
    this.leaderboardButton.append(leaderboardIcon, leaderboardLabel);
    this.leaderboardButton.addEventListener('click', () => {
      if (!this.leaderboardButton.disabled) {
        this.actions.leaderboard();
      }
    });

    footer.append(this.weekly, this.leaderboardButton);
    this.root.append(grid, footer);
    host.append(this.root);
    this.updateDailyState(UNAVAILABLE_DAILY_STATE);
    this.updateLeaderboardsAvailable(false);
  }

  updateDailyState(state: DailyMenuState): void {
    const completed = new Set(state.completedDailyIds);
    const completedCount = state.weekDailyIds.filter((id) => completed.has(id)).length;
    const hasWeek = state.available && state.weekDailyIds.length === 7;

    const daily = this.modeCards.get('daily');
    if (daily !== undefined) {
      daily.button.disabled = !state.available;
      daily.root.classList.toggle('is-disabled', !state.available);
      daily.root.classList.toggle('is-complete', state.completed);
      daily.copy.textContent = state.available
        ? formatDailyDate(state.dailyId)
        : 'Серверное время недоступно';
      daily.dailyProgress?.toggleAttribute('hidden', !hasWeek);
      daily.dailyCount?.replaceChildren(document.createTextNode(hasWeek ? `${completedCount}/7` : ''));
      daily.dailyDots?.replaceChildren(...this.createProgressDots(
        state,
        'main-shell-daily-dot',
      ));
    }

    this.weekly.hidden = !hasWeek;
    this.weeklyCount.textContent = hasWeek ? `${completedCount}/7` : '';
    this.weeklyDots.replaceChildren(...this.createProgressDots(
      state,
      'main-shell-week-dot',
    ));
    this.updateModeVisuals();
  }

  updateLeaderboardsAvailable(available: boolean): void {
    this.leaderboardButton.disabled = !available;
    this.leaderboardButton.setAttribute('aria-disabled', String(!available));
  }

  setSelectedMode(mode: GameMode | null): void {
    this.selectedMode = mode;
    this.updateModeVisuals();
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createModeCard(
    mode: GameMode,
    icon: HomeArtIconName,
    title: string,
    description: string,
  ): HTMLElement {
    const card = document.createElement('article');
    card.className = 'main-shell-mode-card';
    card.dataset.mode = mode;

    const emblemNode = document.createElement('div');
    emblemNode.className = 'main-shell-mode-emblem';
    emblemNode.setAttribute('aria-hidden', 'true');
    emblemNode.append(createHomeArtIcon(icon));

    const heading = document.createElement('h2');
    heading.className = 'main-shell-mode-title';
    heading.textContent = title;

    const copy = document.createElement('p');
    copy.className = 'main-shell-mode-copy';
    copy.textContent = description;

    let dailyProgress: HTMLDivElement | undefined;
    let dailyDots: HTMLDivElement | undefined;
    let dailyCount: HTMLSpanElement | undefined;
    if (mode === 'daily') {
      dailyProgress = document.createElement('div');
      dailyProgress.className = 'main-shell-daily-progress';
      dailyDots = document.createElement('div');
      dailyDots.className = 'main-shell-daily-dots';
      dailyCount = document.createElement('span');
      dailyCount.className = 'main-shell-daily-count';
      dailyProgress.append(dailyDots, dailyCount);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-shell-mode-play';
    button.textContent = 'ИГРАТЬ';
    button.addEventListener('click', () => {
      if (!button.disabled) {
        this.selectedMode = mode;
        this.updateModeVisuals();
        this.actions.play(mode);
      }
    });

    card.append(emblemNode, heading, copy);
    if (dailyProgress !== undefined) {
      card.append(dailyProgress);
    }
    card.append(button);
    this.modeCards.set(mode, {
      root: card,
      copy,
      button,
      dailyProgress,
      dailyDots,
      dailyCount,
    });
    return card;
  }


  private createProgressDots(
    state: DailyMenuState,
    className: string,
  ): HTMLSpanElement[] {
    const completed = new Set(state.completedDailyIds);
    return state.weekDailyIds.map((id) => {
      const dot = document.createElement('span');
      const isComplete = completed.has(id);
      const isToday = id === state.dailyId;
      dot.className = className;
      dot.classList.toggle('is-complete', isComplete);
      dot.classList.toggle('is-today', isToday);
      dot.setAttribute('aria-label', `${id}: ${isComplete ? 'пройдено' : 'не пройдено'}`);
      if (isToday) {
        dot.setAttribute('aria-current', 'date');
      }
      return dot;
    });
  }

  private updateModeVisuals(): void {
    for (const [mode, parts] of this.modeCards) {
      const selected = mode === this.selectedMode && !parts.button.disabled;
      parts.root.classList.toggle('is-selected', selected);
      parts.root.setAttribute('aria-selected', String(selected));
    }
  }
}
