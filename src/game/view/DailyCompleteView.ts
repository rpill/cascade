import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type Phaser from 'phaser';
import { RewardSummaryView, type RewardSummaryState } from './RewardSummaryView.ts';
import type { SfxCue } from '../../settings/SfxController.ts';

export interface DailyCompleteState {
  readonly completionId: string;
  readonly elapsedMs: number;
  readonly bestTimeMs: number;
  readonly improvedBest: boolean;
  readonly weekCompleted: number;
  readonly reward?: RewardSummaryState;
}

export interface DailyCompleteActions {
  readonly retry: () => void;
  readonly menu: () => void;
  readonly sound?: (cue: SfxCue) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class DailyCompleteView {
  private readonly localization = new LocalizationBindings();
  private readonly actions: DailyCompleteActions;
  private lastCelebratedCompletionId: string | null = null;

  refreshLocalization(): void {
    this.localization.refresh();
    this.rewardSummary.refreshLocalization();
  }

  private readonly root: HTMLDivElement;
  private readonly elapsed: HTMLParagraphElement;
  private readonly best: HTMLParagraphElement;
  private readonly weekly: HTMLParagraphElement;
  private readonly rewardSummary: RewardSummaryView;

  constructor(scene: Phaser.Scene, actions: DailyCompleteActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'daily-complete-dom';

    const backdrop = document.createElement('div');
    backdrop.className = 'daily-complete-backdrop';

    const panel = document.createElement('section');
    panel.className = 'daily-complete-panel';
    this.localization.attribute(panel, 'aria-label', () => t('Результат испытания дня'));

    const title = document.createElement('h2');
    title.className = 'daily-complete-title';
    this.localization.text(title, () => t('ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО'));

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
    this.localization.text(retryButton, () => t('ПОВТОРИТЬ'));
    retryButton.addEventListener('click', () => actions.retry());

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'daily-complete-button daily-complete-menu';
    this.localization.text(menuButton, () => t('В МЕНЮ'));
    menuButton.addEventListener('click', () => actions.menu());

    buttonRow.append(retryButton, menuButton);
    panel.append(
      title,
      divider,
      this.elapsed,
      this.best,
      this.weekly,
    );
    this.rewardSummary = new RewardSummaryView(panel);
    panel.append(buttonRow);
    this.root.append(backdrop, panel);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the Daily completion view.');
    }

    host.append(this.root);
    this.hide();
  }

  show(state: DailyCompleteState): void {
    this.localization.text(this.elapsed, () => t("Время: {value0}", {value0: formatDuration(state.elapsedMs)}));
    this.localization.text(this.best, () => state.improvedBest
      ? t("Новый рекорд · {value0}", {value0: formatDuration(state.bestTimeMs)})
      : t("Лучшее: {value0}", {value0: formatDuration(state.bestTimeMs)}));
    this.localization.text(this.weekly, () => t("Эта неделя: {value0} / 7", {value0: state.weekCompleted}));
    this.rewardSummary.update(state.reward);

    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    if (state.completionId !== this.lastCelebratedCompletionId) {
      this.lastCelebratedCompletionId = state.completionId;
      this.actions.sound?.('victory');
    }
  }

  hide(): void {
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }
}
