import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import type { OrdinaryGameMode } from '../../meta/GameStats.ts';

export interface StatisticsPageModeState {
  readonly played: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
}

export interface StatisticsPageLeaderboardState {
  readonly status: 'loading' | 'ready' | 'unavailable' | 'error';
  readonly entries: readonly LeaderboardRow[];
  readonly authorized: boolean;
  readonly playerEntry: LeaderboardRow | null;
  readonly authPending: boolean;
  readonly authorizationAllowed: boolean;
  readonly message?: string;
}

export interface StatisticsPageState {
  readonly mode: OrdinaryGameMode;
  readonly statistics: {
    readonly winnable: StatisticsPageModeState;
    readonly original: StatisticsPageModeState;
  };
  readonly leaderboard: StatisticsPageLeaderboardState;
}

export interface StatisticsPageActions {
  readonly selectMode: (mode: OrdinaryGameMode) => void;
  readonly authorize: () => void;
}

interface StatisticValueElements {
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

function formatBest(bestTimeMs: number | null): string {
  return bestTimeMs === null ? '—' : formatDuration(bestTimeMs);
}

function getWinRate(state: StatisticsPageModeState): number {
  return state.played === 0 ? 0 : Math.round((state.wins / state.played) * 100);
}

export class StatisticsPageView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
  }

  private readonly actions: StatisticsPageActions;
  private readonly root: HTMLElement;
  private readonly standardTab: HTMLButtonElement;
  private readonly classicTab: HTMLButtonElement;
  private readonly statsTitle: HTMLHeadingElement;
  private readonly statsValues: StatisticValueElements;
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
    this.standardTab = this.createModeTab('СТАНДАРТ', 'winnable');
    this.classicTab = this.createModeTab('КЛАССИКА', 'original');
    modeTabs.append(this.standardTab, this.classicTab);

    const summary = document.createElement('section');
    summary.className = 'main-shell-statistics-summary';
    this.statsTitle = document.createElement('h2');
    this.statsTitle.className = 'main-shell-statistics-title';
    this.localization.text(this.statsTitle, () => t('СТАТИСТИКА'));

    const statRows = document.createElement('div');
    statRows.className = 'main-shell-statistics-values';
    const played = this.createStatRow('Сыграно');
    const wins = this.createStatRow('Побед');
    const winRate = this.createStatRow('Процент побед');
    const best = this.createStatRow('Лучшее время');
    statRows.append(played.row, wins.row, winRate.row, best.row);
    this.statsValues = {
      played: played.value,
      wins: wins.value,
      winRate: winRate.value,
      best: best.value,
    };
    summary.append(this.statsTitle, statRows);

    this.leaderboardPane = document.createElement('section');
    this.leaderboardPane.className = 'main-shell-statistics-leaderboard';
    this.leaderboardTitle = document.createElement('h2');
    this.leaderboardTitle.className = 'main-shell-statistics-title main-shell-statistics-leaderboard-title';
    this.localization.text(this.leaderboardTitle, () => t('ТАБЛИЦА ЛИДЕРОВ'));
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

  show(state: StatisticsPageState, focusLeaderboard = false): void {
    this.root.hidden = false;
    this.update(state);
    this.setLeaderboardFocus(focusLeaderboard);
  }

  update(state: StatisticsPageState): void {
    this.updateTabs(state.mode);
    this.updateStats(state.statistics[state.mode]);
    this.renderLeaderboard(state.leaderboard);
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

  private createModeTab(label: string, mode: OrdinaryGameMode): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-shell-statistics-tab';
    this.localization.text(button, () => t(label));
    button.addEventListener('click', () => this.actions.selectMode(mode));
    return button;
  }

  private createStatRow(labelText: string): {
    row: HTMLDivElement;
    value: HTMLSpanElement;
  } {
    const row = document.createElement('div');
    row.className = 'main-shell-statistics-row';
    const label = document.createElement('span');
    this.localization.text(label, () => t(labelText));
    const value = document.createElement('span');
    value.className = 'main-shell-statistics-value';
    row.append(label, value);
    return { row, value };
  }

  private updateTabs(mode: OrdinaryGameMode): void {
    const standard = mode === 'winnable';
    this.standardTab.classList.toggle('is-active', standard);
    this.classicTab.classList.toggle('is-active', !standard);
    this.standardTab.setAttribute('aria-pressed', String(standard));
    this.classicTab.setAttribute('aria-pressed', String(!standard));
  }

  private updateStats(state: StatisticsPageModeState): void {
    this.localization.text(this.statsValues.played, () => String(state.played));
    this.localization.text(this.statsValues.wins, () => String(state.wins));
    this.localization.text(this.statsValues.winRate, () => `${getWinRate(state)}%`);
    this.localization.text(this.statsValues.best, () => formatBest(state.bestTimeMs));
  }

  private renderLeaderboard(state: StatisticsPageLeaderboardState): void {
    this.leaderboardList.replaceChildren();

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
      for (const entry of state.entries.slice(0, 10)) {
        this.leaderboardList.append(this.createLeaderboardRow(entry));
      }
    }

    if (state.authorized) {
      this.authBlock.hidden = true;
      this.playerResult.hidden = false;
      this.localization.text(this.playerResult, () => state.playerEntry === null
        ? t('Ваш результат: пока нет результата')
        : t("Ваш результат: {value0} место · {value1}", {value0: state.playerEntry.rank, value1: formatDuration(state.playerEntry.scoreMs)}));
      return;
    }

    this.playerResult.hidden = true;
    this.authBlock.hidden = false;
    if (!state.authorizationAllowed) {
      this.localization.text(this.authCopy, () => t('Завершите текущую партию, чтобы войти и сохранить рекорд.'));
    } else if (state.message !== undefined) {
      this.localization.text(this.authCopy, () => t(state.message ?? ''));
    } else {
      this.localization.text(this.authCopy, () => t('Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.'));
    }
    this.authButton.disabled = state.authPending || !state.authorizationAllowed;
    this.localization.text(this.authButton, () => state.authPending ? t('Вход…') : t('ВОЙТИ'));
  }

  private createLeaderboardRow(entry: LeaderboardRow): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'main-shell-statistics-leaderboard-row';

    const rank = document.createElement('span');
    rank.className = 'main-shell-statistics-rank';
    this.localization.text(rank, () => `${entry.rank}.`);

    const name = document.createElement('span');
    name.className = 'main-shell-statistics-name';
    this.localization.text(name, () => entry.publicName || t('Игрок'));

    const time = document.createElement('span');
    time.className = 'main-shell-statistics-time';
    this.localization.text(time, () => formatDuration(entry.scoreMs));

    row.append(rank, name, time);
    return row;
  }

  private setStatus(message: string): void {
    this.localization.text(this.leaderboardStatus, () => t(message));
    this.leaderboardStatus.hidden = message.length === 0;
  }

  private setLeaderboardFocus(focused: boolean): void {
    this.leaderboardPane.classList.toggle('is-focused', focused);
    if (focused) {
      this.leaderboardTitle.focus({ preventScroll: true });
    }
  }
}
