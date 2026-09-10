import { t, LocalizationBindings } from '../../localization/Localization.ts';
import { getLevelProgress } from '../../meta/Progression.ts';
import type Phaser from 'phaser';
import type { RewardSummaryState } from './RewardSummaryView.ts';
import { createVictoryProgressSequence, type VictoryProgressStep } from './VictoryProgress.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import { createCoinInline } from './ui/CoinInline.ts';

export interface GameCompleteState {
  readonly completionId: string;
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly improvedBest: boolean;
  readonly totalXpBefore: number;
  readonly reward?: RewardSummaryState;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
  readonly sound?: (cue: SfxCue) => void;
}

const FILL_DURATION_MS = 680;
const LEVEL_REWARD_DURATION_MS = 780;
const START_DELAY_MS = 720;
const CONFETTI_DURATION_MS = 1900;
const COIN_SOUND_DELAY_MS = 260;

const VICTORY_WOOD_DETAIL = './assets/theme/fine-grained-wood.jpg';
const VICTORY_PAPER = './assets/ui/paper-001-color.jpg';
const VICTORY_CORNER_TL = './assets/ui/ornaments/corners/home-corner-tl.png';
const VICTORY_CORNER_TR = './assets/ui/ornaments/corners/home-corner-tr.png';
const VICTORY_CORNER_BR = './assets/ui/ornaments/corners/home-corner-br.png';
const VICTORY_CORNER_BL = './assets/ui/ornaments/corners/home-corner-bl.png';

function toCssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class GameCompleteView {
  private readonly localization = new LocalizationBindings();
  private readonly root: HTMLDivElement;
  private readonly elapsed: HTMLParagraphElement;
  private readonly record: HTMLParagraphElement;
  private readonly coins: HTMLDivElement;
  private readonly coinAmount: HTMLElement;
  private readonly coinLabel: HTMLSpanElement;
  private readonly progression: HTMLElement;
  private readonly level: HTMLSpanElement;
  private readonly xpTrack: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly xp: HTMLSpanElement;
  private readonly levelReward: HTMLDivElement;
  private readonly levelRewardTitle: HTMLSpanElement;
  private readonly levelRewardValue: HTMLSpanElement;
  private readonly actions: GameCompleteActions;
  private currentCompletionId: string | null = null;
  private animationTimers: number[] = [];

  constructor(scene: Phaser.Scene, actions: GameCompleteActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'daily-complete-dom game-complete-dom';
    this.root.style.setProperty('--victory-wood-detail', toCssUrl(VICTORY_WOOD_DETAIL));
    this.root.style.setProperty('--victory-paper', toCssUrl(VICTORY_PAPER));
    this.root.style.setProperty('--victory-corner-tl', toCssUrl(VICTORY_CORNER_TL));
    this.root.style.setProperty('--victory-corner-tr', toCssUrl(VICTORY_CORNER_TR));
    this.root.style.setProperty('--victory-corner-br', toCssUrl(VICTORY_CORNER_BR));
    this.root.style.setProperty('--victory-corner-bl', toCssUrl(VICTORY_CORNER_BL));

    const backdrop = document.createElement('div');
    backdrop.className = 'daily-complete-backdrop game-complete-backdrop';

    const confetti = document.createElement('div');
    confetti.className = 'game-complete-confetti';
    confetti.setAttribute('aria-hidden', 'true');
    confetti.append(...Array.from({ length: 18 }, () => document.createElement('span')));

    const panel = document.createElement('section');
    panel.className = 'daily-complete-panel game-complete-panel';
    this.localization.attribute(panel, 'aria-label', () => t('Результат партии'));

    const title = document.createElement('h2');
    title.className = 'daily-complete-title game-complete-title';
    this.localization.text(title, () => t('ПОБЕДА'));

    const divider = document.createElement('div');
    divider.className = 'daily-complete-divider game-complete-divider';
    divider.setAttribute('aria-hidden', 'true');

    this.elapsed = document.createElement('p');
    this.elapsed.className = 'game-complete-time';

    this.record = document.createElement('p');
    this.record.className = 'game-complete-record';

    this.coins = document.createElement('div');
    this.coins.className = 'game-complete-coins';
    const coinIcon = document.createElement('span');
    coinIcon.className = 'game-complete-coin-icon';
    coinIcon.setAttribute('aria-hidden', 'true');
    this.coinAmount = document.createElement('strong');
    this.coinAmount.className = 'game-complete-coin-amount';
    this.coinLabel = document.createElement('span');
    this.coinLabel.className = 'game-complete-coin-label';
    this.coins.append(coinIcon, this.coinAmount, this.coinLabel);

    this.progression = document.createElement('section');
    this.progression.className = 'game-complete-progression';
    this.localization.attribute(this.progression, 'aria-label', () => t('Прогресс игрока'));

    this.level = document.createElement('span');
    this.level.className = 'game-complete-level';

    this.xpTrack = document.createElement('div');
    this.xpTrack.className = 'main-shell-xp-track game-complete-xp-track';
    this.xpTrack.setAttribute('role', 'progressbar');

    this.xpFill = document.createElement('div');
    this.xpFill.className = 'main-shell-xp-fill game-complete-xp-fill';
    this.xpTrack.append(this.xpFill);

    this.xp = document.createElement('span');
    this.xp.className = 'game-complete-xp';

    this.levelReward = document.createElement('div');
    this.levelReward.className = 'game-complete-level-reward';
    this.levelReward.hidden = true;
    this.levelRewardTitle = document.createElement('span');
    this.levelRewardTitle.className = 'game-complete-level-reward-title';
    this.levelRewardValue = document.createElement('span');
    this.levelRewardValue.className = 'game-complete-level-reward-value';
    this.levelReward.append(this.levelRewardTitle, this.levelRewardValue);

    this.progression.append(this.level, this.xpTrack, this.xp, this.levelReward);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'daily-complete-actions game-complete-actions';

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
    panel.append(title, divider, this.elapsed, this.record, this.coins, this.progression, buttonRow);
    this.root.append(backdrop, confetti, panel);

    const host = scene.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Game canvas must have a parent element for the completion view.');
    }

    host.append(this.root);
    this.hide();
  }

  refreshLocalization(): void {
    this.localization.refresh();
  }

  show(state: GameCompleteState): void {
    const isNewCompletion = state.completionId !== this.currentCompletionId;
    if (isNewCompletion) {
      this.cancelAnimation();
      this.currentCompletionId = state.completionId;
    }

    this.elapsed.textContent = formatDuration(state.elapsedMs);
    this.localization.text(this.record, () => state.improvedBest ? t('Новый рекорд') : '');
    this.record.hidden = !state.improvedBest;

    const reward = state.reward;
    const hasReward = reward !== undefined;
    this.coins.hidden = !hasReward;
    this.progression.hidden = !hasReward;
    if (reward !== undefined) {
      this.coins.classList.toggle('is-pending', reward.pending);
      this.coinAmount.textContent = reward.pending
        ? '…'
        : `${reward.coins > 0 ? '+' : ''}${reward.coins}`;
      this.localization.text(this.coinLabel, () => reward.pending ? t('Награды начисляются…') : t('монет'));
      if (isNewCompletion) {
        this.showInitialProgress(state.totalXpBefore);
      }
    }

    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    if (isNewCompletion) {
      this.root.classList.remove('is-celebrating');
      void this.root.offsetWidth;
      this.root.classList.add('is-celebrating');
      this.actions.sound?.('victory');
      if (reward !== undefined && !reward.pending && reward.coins > 0) {
        this.schedule(() => this.actions.sound?.('coin-reward'), COIN_SOUND_DELAY_MS);
      }
      this.schedule(() => this.root.classList.remove('is-celebrating'), CONFETTI_DURATION_MS);
    }

    if (isNewCompletion && reward !== undefined && reward.xp > 0) {
      this.schedule(() => this.playProgress(
        createVictoryProgressSequence(state.totalXpBefore, reward.xp),
        state.totalXpBefore + reward.xp,
        0,
      ), START_DELAY_MS);
    }
  }

  hide(): void {
    this.cancelAnimation();
    this.root.classList.remove('is-celebrating');
    this.root.style.pointerEvents = 'none';
    this.root.hidden = true;
  }

  destroy(): void {
    this.cancelAnimation();
    this.root.remove();
  }

  private showInitialProgress(totalXp: number): void {
    const progress = getLevelProgress(totalXp);
    this.setProgress(progress.level, progress.xpIntoLevel, progress.xpForNextLevel, false);
    this.levelReward.hidden = true;
    this.levelReward.classList.remove('is-visible');
  }

  private playProgress(
    steps: readonly VictoryProgressStep[],
    finalTotalXp: number,
    index: number,
  ): void {
    const step = steps[index];
    if (step === undefined) {
      const final = getLevelProgress(finalTotalXp);
      this.setProgress(final.level, final.xpIntoLevel, final.xpForNextLevel, false);
      return;
    }

    if (step.kind === 'fill') {
      this.setProgress(step.level, step.from, step.required, false);
      void this.xpFill.offsetWidth;
      this.setProgress(step.level, step.to, step.required, true);
      this.schedule(() => this.playProgress(steps, finalTotalXp, index + 1), FILL_DURATION_MS);
      return;
    }

    this.levelRewardTitle.textContent = t('Новый уровень!');
    this.levelRewardValue.replaceChildren(
      createCoinInline(`+${step.coins}`, {
        className: 'game-complete-level-reward-coin',
        label: t('монет'),
      }),
      document.createTextNode(` ${t('за уровень')}`),
    );
    this.levelReward.hidden = false;
    this.levelReward.classList.add('is-visible');
    this.actions.sound?.('level-up');
    this.schedule(() => this.actions.sound?.('coin-reward'), 150);

    this.schedule(() => {
      this.levelReward.classList.remove('is-visible');
      this.levelReward.hidden = true;
      const next = getLevelProgress(finalTotalXp);
      const required = step.toLevel === next.level ? next.xpForNextLevel : 100 + 50 * (step.toLevel - 1);
      this.setProgress(step.toLevel, 0, required, false);
      this.playProgress(steps, finalTotalXp, index + 1);
    }, LEVEL_REWARD_DURATION_MS);
  }

  private setProgress(level: number, current: number, required: number, animate: boolean): void {
    const safeRequired = Math.max(1, Math.floor(required));
    const safeCurrent = Math.min(safeRequired, Math.max(0, Math.floor(current)));
    this.level.textContent = t('Уровень {level}', { level: Math.max(1, Math.floor(level)) });
    this.xp.textContent = `${safeCurrent} / ${safeRequired} XP`;
    this.xpFill.style.transitionDuration = animate ? `${FILL_DURATION_MS}ms` : '0ms';
    this.xpFill.style.width = `${Math.round((safeCurrent / safeRequired) * 1000) / 10}%`;
    this.xpTrack.setAttribute('aria-valuemin', '0');
    this.xpTrack.setAttribute('aria-valuemax', String(safeRequired));
    this.xpTrack.setAttribute('aria-valuenow', String(safeCurrent));
    this.xpTrack.setAttribute('aria-valuetext', this.xp.textContent);
  }

  private schedule(callback: () => void, delayMs: number): void {
    const timer = window.setTimeout(() => {
      this.animationTimers = this.animationTimers.filter((value) => value !== timer);
      callback();
    }, delayMs);
    this.animationTimers.push(timer);
  }

  private cancelAnimation(): void {
    this.animationTimers.forEach((timer) => window.clearTimeout(timer));
    this.animationTimers = [];
    this.root.classList.remove('is-celebrating');
  }
}
