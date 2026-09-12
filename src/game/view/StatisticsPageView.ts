import { t, LocalizationBindings } from '../../localization/Localization.ts';
import { hasGlobalLeaderboard, type StatisticsMode } from '../../leaderboards/LeaderboardConfig.ts';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';

export interface StatisticsPageModeState {
  readonly played: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
  readonly bestWinStreak?: number;
  readonly dailyId?: string | null;
  readonly completed?: boolean;
}

export interface StatisticsPageLeaderboardState {
  readonly status: 'loading' | 'ready' | 'unavailable' | 'error' | 'disabled';
  readonly entries: readonly LeaderboardRow[];
  readonly authorized: boolean;
  readonly playerEntry: LeaderboardRow | null;
  readonly authPending: boolean;
  readonly authorizationAllowed: boolean;
  readonly message?: string;
}

export interface StatisticsPageState {
  readonly mode: StatisticsMode;
  readonly statistics: {
    readonly winnable: StatisticsPageModeState;
    readonly original: StatisticsPageModeState;
    readonly daily: StatisticsPageModeState;
  };
  readonly leaderboard: StatisticsPageLeaderboardState;
}

export interface StatisticsPageActions {
  readonly selectMode: (mode: StatisticsMode) => void;
  readonly authorize: () => void;
}

interface StatisticElement {
  readonly label: HTMLSpanElement;
  readonly value: HTMLSpanElement;
}

interface StatisticElements {
  readonly first: StatisticElement;
  readonly second: StatisticElement;
  readonly third: StatisticElement;
  readonly fourth: StatisticElement;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatBest(bestTimeMs: number | null): string {
  return bestTimeMs === null ? '—' : formatDuration(bestTimeMs);
}

function getWinRate(state: StatisticsPageModeState): number {
  return state.played === 0 ? 0 : Math.round((state.wins / state.played) * 100);
}

function formatStreak(value: number): string {
  return t('Серия: {count}', { count: value });
}

function getVisiblePlayerRank(
  visibleEntries: readonly LeaderboardRow[],
  playerEntry: LeaderboardRow,
): number {
  const visibleIndex = visibleEntries.findIndex((entry) =>
    entry.rank === playerEntry.rank && entry.value === playerEntry.value,
  );
  return visibleIndex >= 0 ? visibleIndex + 1 : playerEntry.rank;
}

export class StatisticsPageView {
  private readonly localization = new LocalizationBindings();
  private readonly actions: StatisticsPageActions;
  private readonly root: HTMLElement;
  private readonly gameTab: HTMLButtonElement;
  private readonly dailyTab: HTMLButtonElement;
  private readonly statsTitle: HTMLHeadingElement;
  private readonly statsValues: StatisticElements;
  private readonly leaderboardPane: HTMLElement;
  private readonly leaderboardTitle: HTMLHeadingElement;
  private readonly leaderboardStatus: HTMLDivElement;
  private readonly leaderboardList: HTMLDivElement;
  private readonly playerResult: HTMLDivElement;
  private readonly authBlock: HTMLDivElement;
  private readonly authCopy: HTMLDivElement;
  private readonly authButton: HTMLButtonElement;

  constructor(host: HTMLElement, actions: StatisticsPageActions) {
    this.actions = actions;
    this.root = document.createElement('section');
    this.root.className = 'main-shell-statistics';
    this.localization.attribute(this.root, 'aria-label', () => t('Статистика и таблица лидеров'));

    const modeTabs = document.createElement('div');
    modeTabs.className = 'main-shell-statistics-tabs';
    this.gameTab = this.createModeTab('ИГРА', 'winnable');
    this.dailyTab = this.createModeTab('ЕЖЕДНЕВНЫЕ', 'daily');
    modeTabs.append(this.gameTab, this.dailyTab);

    const summary = document.createElement('section');
    summary.className = 'main-shell-statistics-summary';
    this.statsTitle = document.createElement('h2');
    this.statsTitle.className = 'main-shell-statistics-title';
    this.localization.text(this.statsTitle, () => t('СТАТИСТИКА'));

    const statRows = document.createElement('div');
    statRows.className = 'main-shell-statistics-values';
    const first = this.createStatRow();
    const second = this.createStatRow();
    const third = this.createStatRow();
    const fourth = this.createStatRow();
    statRows.append(first.row, second.row, third.row, fourth.row);
    this.statsValues = {
      first: first.element,
      second: second.element,
      third: third.element,
      fourth: fourth.element,
    };
    summary.append(this.statsTitle, statRows);

    this.leaderboardPane = document.createElement('section');
    this.leaderboardPane.className = 'main-shell-statistics-leaderboard';
    this.leaderboardTitle = document.createElement('h2');
    this.leaderboardTitle.className = 'main-shell-statistics-title main-shell-statistics-leaderboard-title';
    this.leaderboardTitle.tabIndex = -1;

    this.leaderboardStatus = document.createElement('div');
    this.leaderboardStatus.className = 'main-shell-statistics-status';

    this.leaderboardList = document.createElement('div');
    this.leaderboardList.className = 'main-shell-statistics-list';
    this.localization.attribute(this.leaderboardList, 'aria-label', () => t('Лучшие результаты'));

    this.playerResult = document.createElement('div');
    this.playerResult.className = 'main-shell-statistics-player';

    this.authBlock = document.createElement('div');
    this.authBlock.className = 'main-shell-statistics-auth';
    this.authCopy = document.createElement('div');
    this.authCopy.className = 'main-shell-statistics-auth-copy';
    this.authButton = document.createElement('button');
    this.authButton.type = 'button';
    this.authButton.className = 'main-shell-statistics-auth-button';
    this.localization.text(this.authButton, () => t('ВОЙТИ'));
    this.authButton.addEventListener('click', () => this.actions.authorize());
    this.authBlock.append(this.authCopy, this.authButton);

    this.leaderboardPane.append(
      this.leaderboardTitle,
      this.leaderboardStatus,
      this.leaderboardList,
      this.playerResult,
      this.authBlock,
    );

    const content = document.createElement('div');
    content.className = 'main-shell-statistics-content';
    content.append(summary, this.leaderboardPane);
    this.root.append(modeTabs, content);
    host.append(this.root);
    this.hide();
  }

  refreshLocalization(): void {
    this.localization.refresh();
  }

  show(state: StatisticsPageState, focusLeaderboard = false): void {
    this.root.hidden = false;
    this.update(state);
    this.setLeaderboardFocus(focusLeaderboard);
  }

  update(state: StatisticsPageState): void {
    this.updateTabs(state.mode);
    this.updateStats(state.mode, state.statistics[state.mode]);
    this.renderLeaderboard(state.mode, state.leaderboard);
  }

  focusLeaderboard(): void {
    this.setLeaderboardFocus(true);
  }

  hide(): void {
    this.root.hidden = true;
    this.setLeaderboardFocus(false);
  }

  destroy(): void {
    this.root.remove();
  }

  private createModeTab(label: string, mode: StatisticsMode): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-shell-statistics-tab';
    this.localization.text(button, () => t(label));
    button.addEventListener('click', () => this.actions.selectMode(mode));
    return button;
  }

  private createStatRow(): { row: HTMLDivElement; element: StatisticElement } {
    const row = document.createElement('div');
    row.className = 'main-shell-statistics-row';
    const label = document.createElement('span');
    const value = document.createElement('span');
    value.className = 'main-shell-statistics-value';
    row.append(label, value);
    return { row, element: { label, value } };
  }

  private setStat(element: StatisticElement, label: string, value: string): void {
    this.localization.text(element.label, () => t(label));
    this.localization.text(element.value, () => t(value));
  }

  private updateTabs(mode: StatisticsMode): void {
    const tabs: ReadonlyArray<[HTMLButtonElement, StatisticsMode]> = [
      [this.gameTab, 'winnable'],
      [this.dailyTab, 'daily'],
    ];
    for (const [tab, tabMode] of tabs) {
      const selected = mode === tabMode;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    }
  }

  private updateStats(mode: StatisticsMode, state: StatisticsPageModeState): void {
    if (mode === 'daily') {
      this.setStat(this.statsValues.first, 'Попыток сегодня', String(state.played));
      this.setStat(this.statsValues.second, 'Статус', state.completed ? 'пройдено' : 'не пройдено');
      this.setStat(this.statsValues.third, 'Лучшее время', formatBest(state.bestTimeMs));
      this.setStat(this.statsValues.fourth, 'Дата', state.dailyId ?? '—');
      return;
    }

    this.setStat(this.statsValues.first, 'Сыграно', String(state.played));
    this.setStat(this.statsValues.second, 'Побед', String(state.wins));
    this.setStat(this.statsValues.third, 'Процент побед', `${getWinRate(state)}%`);
    if (mode === 'winnable') {
      this.setStat(this.statsValues.fourth, 'Лучшая серия', String(state.bestWinStreak ?? 0));
    } else {
      this.setStat(this.statsValues.fourth, 'Лучшее время', formatBest(state.bestTimeMs));
    }
  }

  private renderLeaderboard(mode: StatisticsMode, state: StatisticsPageLeaderboardState): void {
    this.leaderboardList.replaceChildren();
    if (!hasGlobalLeaderboard(mode)) {
      this.leaderboardList.hidden = true;
      this.playerResult.hidden = true;
      this.authBlock.hidden = true;
      return;
    }

    this.localization.text(this.leaderboardTitle, () => t(
      mode === 'daily' ? 'СЕГОДНЯШНИЙ РЕЙТИНГ' : 'ЛУЧШИЕ СЕРИИ',
    ));

    if (state.status === 'disabled') {
      this.leaderboardList.hidden = true;
      this.playerResult.hidden = true;
      this.authBlock.hidden = true;
      return;
    }

    this.leaderboardList.hidden = false;
    if (state.status === 'loading') {
      this.setStatus('Загрузка…');
    } else if (state.status === 'unavailable') {
      this.setStatus(state.message ?? 'Таблица лидеров недоступна');
    } else if (state.status === 'error') {
      this.setStatus(state.message ?? 'Не удалось загрузить таблицу лидеров');
    } else if (state.entries.length === 0) {
      this.setStatus('Пока нет результатов');
    } else {
      this.setStatus('');
      const visibleEntries = state.entries.slice(0, 10);
      for (const [index, entry] of visibleEntries.entries()) {
        const displayRank = index + 1;
        this.leaderboardList.append(this.createLeaderboardRow(entry, mode, displayRank));
      }
    }

    if (state.authorized) {
      this.authBlock.hidden = true;
      this.playerResult.hidden = false;
      const visibleEntries = state.entries.slice(0, 10);
      this.localization.text(this.playerResult, () => state.playerEntry === null
        ? t('Ваш результат: пока нет результата')
        : t('Ваш результат: {value0} место · {value1}', {
            value0: getVisiblePlayerRank(visibleEntries, state.playerEntry),
            value1: mode === 'daily' ? formatDuration(state.playerEntry.value) : formatStreak(state.playerEntry.value),
          }));
      return;
    }

    this.playerResult.hidden = true;
    this.authBlock.hidden = false;
    if (!state.authorizationAllowed) {
      this.localization.text(this.authCopy, () => t('Завершите текущую партию, чтобы войти и сохранить результат.'));
    } else if (state.message !== undefined) {
      this.localization.text(this.authCopy, () => t(state.message ?? ''));
    } else {
      this.localization.text(this.authCopy, () => t('Войдите с Яндекс ID, чтобы сохранить результат и увидеть своё место в таблице.'));
    }
    this.authButton.disabled = state.authPending || !state.authorizationAllowed;
    this.localization.text(this.authButton, () => state.authPending ? t('Вход…') : t('ВОЙТИ'));
  }

  private createLeaderboardRow(
    entry: LeaderboardRow,
    mode: 'winnable' | 'daily',
    displayRank: number,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'main-shell-statistics-leaderboard-row';

    const rank = document.createElement('span');
    rank.className = 'main-shell-statistics-rank';
    this.localization.text(rank, () => `${displayRank}.`);

    const name = document.createElement('span');
    name.className = 'main-shell-statistics-name';
    this.localization.text(name, () => entry.publicName || t('Игрок'));

    const value = document.createElement('span');
    value.className = 'main-shell-statistics-time';
    this.localization.text(value, () => mode === 'daily'
      ? formatDuration(entry.value)
      : formatStreak(entry.value));

    row.append(rank, name, value);
    return row;
  }

  private setStatus(message: string): void {
    this.localization.text(this.leaderboardStatus, () => t(message));
    this.leaderboardStatus.hidden = message.length === 0;
  }

  private setLeaderboardFocus(focused: boolean): void {
    this.leaderboardPane.classList.toggle('is-focused', focused);
    if (focused) this.leaderboardTitle.focus({ preventScroll: true });
  }
}
