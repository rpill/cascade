import { t, getLanguage } from '../../localization/Localization.ts';
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

function formatDailyDate(dailyId: string | null): string {
  if (dailyId === null) return t('Сегодня');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dailyId);
  if (match === null) return t('Сегодня');
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return t('Сегодня');
  return new Intl.DateTimeFormat(getLanguage(), { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${dailyId}T12:00:00Z`));
}

/** Legacy DOM fallback kept only while GameScene is being dismantled; the live product Home is Phaser-based. */
export class PlayPageView {
  private readonly actions: PlayPageActions;
  private readonly root: HTMLElement;
  private readonly modeCards = new Map<GameMode, ModeCardParts>();
  private readonly leaderboardButton: HTMLButtonElement;
  private dailyState = UNAVAILABLE_DAILY_STATE;
  private selectedMode: GameMode | null = null;
  private continueMode: GameMode | null = null;

  constructor(host: HTMLElement, actions: PlayPageActions) {
    this.actions = actions;
    this.root = document.createElement('section');
    this.root.className = 'main-shell-play';
    this.root.setAttribute('aria-label', 'Играть');

    const grid = document.createElement('div');
    grid.className = 'main-shell-mode-grid';
    grid.append(
      this.createModeCard('winnable', 'spade', 'ИГРА', 'Соберите пасьянс в своём темпе'),
      this.createModeCard('daily', 'crown', 'ИСПЫТАНИЕ ДНЯ', 'Серверное время недоступно'),
    );

    const footer = document.createElement('div');
    footer.className = 'main-shell-play-footer';
    this.leaderboardButton = document.createElement('button');
    this.leaderboardButton.type = 'button';
    this.leaderboardButton.className = 'main-shell-secondary-action main-shell-leaderboard';
    const icon = document.createElement('span');
    icon.className = 'main-shell-leaderboard-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.append(createHomeArtIcon('trophy'));
    const label = document.createElement('span');
    label.textContent = 'Таблица лидеров';
    this.leaderboardButton.append(icon, label);
    this.leaderboardButton.addEventListener('click', () => {
      if (!this.leaderboardButton.disabled) this.actions.leaderboard();
    });
    footer.append(this.leaderboardButton);

    this.root.append(grid, footer);
    host.append(this.root);
    this.updateDailyState(UNAVAILABLE_DAILY_STATE);
    this.updateLeaderboardsAvailable(false);
    this.refreshLocalization();
  }

  updateDailyState(state: DailyMenuState): void {
    this.dailyState = state;
    const completed = new Set(state.completedDailyIds);
    const completedCount = state.weekDailyIds.filter((id) => completed.has(id)).length;
    const hasWeek = state.available && state.weekDailyIds.length === 7;
    const daily = this.modeCards.get('daily');
    if (daily !== undefined) {
      daily.button.disabled = !state.available;
      daily.root.classList.toggle('is-disabled', !state.available);
      daily.root.classList.toggle('is-complete', state.completed);
      daily.copy.textContent = state.available ? formatDailyDate(state.dailyId) : t('Серверное время недоступно');
      daily.dailyProgress?.removeAttribute('hidden');
      daily.dailyProgress?.setAttribute('aria-label', t(hasWeek ? 'Прогресс недели' : 'Прогресс недели пока недоступен'));
      daily.dailyCount?.replaceChildren(document.createTextNode(hasWeek ? t('{current} из 7', { current: completedCount }) : t('— из 7')));
      daily.dailyDots?.replaceChildren(...this.createProgressDots(state, 'main-shell-daily-dot'));
    }
    this.updateModeVisuals();
  }

  updateLeaderboardsAvailable(available: boolean): void {
    this.leaderboardButton.dataset.available = String(available);
    this.leaderboardButton.disabled = false;
    this.leaderboardButton.removeAttribute('aria-disabled');
  }

  setSelectedMode(mode: GameMode | null): void { this.selectedMode = mode; this.updateModeVisuals(); }
  setContinueMode(mode: GameMode | null): void { this.continueMode = mode; this.renderModeButtonLabels(); }

  refreshLocalization(): void {
    const labels: Partial<Record<GameMode, [string, string]>> = {
      winnable: ['ИГРА', 'Соберите пасьянс в своём темпе'],
      daily: ['ИСПЫТАНИЕ ДНЯ', 'Серверное время недоступно'],
    };
    this.root.setAttribute('aria-label', t('Играть'));
    for (const [mode, parts] of this.modeCards) {
      const label = labels[mode];
      if (label === undefined) continue;
      parts.root.querySelector('h2')!.textContent = t(label[0]);
      parts.copy.textContent = t(label[1]);
    }
    this.renderModeButtonLabels();
    this.leaderboardButton.lastElementChild!.textContent = t('Таблица лидеров');
    this.updateDailyState(this.dailyState);
  }

  show(): void { this.root.hidden = false; }
  hide(): void { this.root.hidden = true; }
  destroy(): void { this.root.remove(); }

  private renderModeButtonLabels(): void {
    for (const [mode, parts] of this.modeCards) parts.button.textContent = t(mode === this.continueMode ? 'ПРОДОЛЖИТЬ' : 'ИГРАТЬ');
  }

  private createModeCard(mode: GameMode, icon: HomeArtIconName, title: string, description: string): HTMLElement {
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
      if (button.disabled) return;
      this.selectedMode = mode;
      this.updateModeVisuals();
      this.actions.play(mode);
    });
    card.append(emblemNode, heading, copy);
    if (dailyProgress !== undefined) card.append(dailyProgress);
    card.append(button);
    this.modeCards.set(mode, { root: card, copy, button, dailyProgress, dailyDots, dailyCount });
    return card;
  }

  private createProgressDots(state: DailyMenuState, className: string): HTMLSpanElement[] {
    const completed = new Set(state.completedDailyIds);
    const ids = state.weekDailyIds.length === 7 ? state.weekDailyIds : Array.from({ length: 7 }, () => '');
    return ids.map((id, index) => {
      const dot = document.createElement('span');
      const isComplete = completed.has(id);
      const isToday = id === state.dailyId;
      dot.className = className;
      dot.classList.toggle('is-complete', isComplete);
      dot.classList.toggle('is-today', isToday);
      dot.setAttribute('aria-label', id ? `${id}: ${t(isComplete ? 'пройдено' : 'не пройдено')}` : t('День {day}: недоступно', { day: index + 1 }));
      if (isToday) dot.setAttribute('aria-current', 'date');
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
