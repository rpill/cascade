import type Phaser from 'phaser';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import type { OrdinaryGameMode } from '../../meta/GameStats.ts';

export type LeaderboardViewStatus =
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error';

export interface LeaderboardViewState {
  readonly mode: OrdinaryGameMode;
  readonly status: LeaderboardViewStatus;
  readonly entries: readonly LeaderboardRow[];
  readonly authorized: boolean;
  readonly playerEntry: LeaderboardRow | null;
  readonly authPending: boolean;
  readonly authorizationAllowed: boolean;
  readonly message?: string;
}

export interface LeaderboardViewActions {
  readonly selectMode: (mode: OrdinaryGameMode) => void;
  readonly authorize: () => void;
  readonly close: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class LeaderboardView {
  private readonly actions: LeaderboardViewActions;
  private readonly root: HTMLDivElement;
  private readonly standardTab: HTMLButtonElement;
  private readonly classicTab: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly playerResult: HTMLDivElement;
  private readonly authBlock: HTMLDivElement;
  private readonly authCopy: HTMLDivElement;
  private readonly authButton: HTMLButtonElement;

  constructor(scene: Phaser.Scene, actions: LeaderboardViewActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'leaderboard-dom meta-modal-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'meta-modal-backdrop';

    const panel = document.createElement('section');
    panel.className = 'meta-modal-panel leaderboard-panel';
    panel.setAttribute('aria-label', 'Таблица лидеров');

    const title = document.createElement('h2');
    title.className = 'meta-modal-title';
    title.textContent = 'ТАБЛИЦА ЛИДЕРОВ';

    const tabs = document.createElement('div');
    tabs.className = 'leaderboard-tabs';

    this.standardTab = this.createTab('СТАНДАРТ', () => this.actions.selectMode('winnable'));
    this.classicTab = this.createTab('КЛАССИКА', () => this.actions.selectMode('original'));
    tabs.append(this.standardTab, this.classicTab);

    this.status = document.createElement('div');
    this.status.className = 'leaderboard-status';

    this.list = document.createElement('div');
    this.list.className = 'leaderboard-list';
    this.list.setAttribute('aria-label', 'Лучшие результаты');

    this.playerResult = document.createElement('div');
    this.playerResult.className = 'leaderboard-player-result';

    this.authBlock = document.createElement('div');
    this.authBlock.className = 'leaderboard-auth';

    this.authCopy = document.createElement('div');
    this.authCopy.className = 'leaderboard-auth-copy';

    this.authButton = document.createElement('button');
    this.authButton.type = 'button';
    this.authButton.className = 'leaderboard-auth-button';
    this.authButton.textContent = 'ВОЙТИ';
    this.authButton.addEventListener('click', () => this.actions.authorize());
    this.authBlock.append(this.authCopy, this.authButton);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'meta-modal-close leaderboard-close';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.actions.close());

    panel.append(
      title,
      tabs,
      this.status,
      this.list,
      this.playerResult,
      this.authBlock,
      close,
    );
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the leaderboard modal.');
    }

    host.append(this.root);
    this.hide();
  }

  show(state: LeaderboardViewState): void {
    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    this.update(state);
  }

  update(state: LeaderboardViewState): void {
    this.updateTabs(state.mode);
    this.renderEntries(state);
    this.renderIdentity(state);
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createTab(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'leaderboard-tab';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  private updateTabs(mode: OrdinaryGameMode): void {
    const standardSelected = mode === 'winnable';
    this.standardTab.classList.toggle('leaderboard-tab-selected', standardSelected);
    this.classicTab.classList.toggle('leaderboard-tab-selected', !standardSelected);
    this.standardTab.setAttribute('aria-pressed', String(standardSelected));
    this.classicTab.setAttribute('aria-pressed', String(!standardSelected));
  }

  private renderEntries(state: LeaderboardViewState): void {
    this.list.replaceChildren();

    if (state.status === 'loading') {
      this.setStatus('Загрузка…');
      return;
    }

    if (state.status === 'unavailable' || state.status === 'error') {
      this.setStatus(state.message ?? 'Таблица лидеров временно недоступна');
      return;
    }

    if (state.entries.length === 0) {
      this.setStatus('Пока нет результатов');
      return;
    }

    this.setStatus('');
    for (const entry of state.entries.slice(0, 10)) {
      this.list.append(this.createLeaderboardRow(entry));
    }
  }

  private renderIdentity(state: LeaderboardViewState): void {
    if (state.authorized) {
      this.authBlock.hidden = true;
      this.playerResult.hidden = false;
      this.playerResult.textContent = state.playerEntry === null
        ? 'Ваш результат: пока нет результата'
        : `Ваш результат: ${state.playerEntry.rank} место · ${formatDuration(state.playerEntry.scoreMs)}`;
      return;
    }

    this.playerResult.hidden = true;
    this.authBlock.hidden = false;

    if (!state.authorizationAllowed) {
      this.authCopy.textContent = 'Завершите текущую партию, чтобы войти и сохранить рекорд.';
    } else if (state.message !== undefined) {
      this.authCopy.textContent = state.message;
    } else {
      this.authCopy.textContent = 'Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.';
    }

    this.authButton.disabled = state.authPending || !state.authorizationAllowed;
    this.authButton.textContent = state.authPending ? 'Вход…' : 'ВОЙТИ';
  }

  private createLeaderboardRow(entry: LeaderboardRow): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${entry.rank}.`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.publicName;

    const time = document.createElement('span');
    time.className = 'leaderboard-time';
    time.textContent = formatDuration(entry.scoreMs);

    row.append(rank, name, time);
    return row;
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
    this.status.hidden = message.length === 0;
  }
}
