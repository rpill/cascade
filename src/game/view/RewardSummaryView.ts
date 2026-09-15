import { t, LocalizationBindings } from '../../localization/Localization.ts';
import type { MasteryRank } from '../../meta/MetaSave.ts';
import { createCoinInline } from './ui/CoinInline.ts';

export interface RewardSummaryLine {
  readonly label: string;
  readonly coins: number;
}

export interface RewardSummaryState {
  readonly coins: number;
  readonly lines: readonly RewardSummaryLine[];
  readonly rankAdvancedTo?: MasteryRank | null;
  readonly pending?: boolean;
  readonly themePurchaseUnlocked?: boolean;
}

const RANK_LABELS: Readonly<Record<MasteryRank, string>> = {
  novice: 'Новичок',
  player: 'Игрок',
  tactician: 'Тактик',
  expert: 'Эксперт',
  master: 'Мастер',
  grandmaster: 'Грандмастер',
};

export function translateRewardLabel(label: string): string {
  return t(label);
}

function createCoinValue(coins: number): DocumentFragment {
  const content = document.createDocumentFragment();
  if (coins === 0) {
    content.append(document.createTextNode('—'));
    return content;
  }
  content.append(createCoinInline(`${coins > 0 ? '+' : ''}${coins}`, {
    className: 'reward-summary-coin-inline',
    label: t('монет'),
  }));
  return content;
}

export class RewardSummaryView {
  private readonly localization = new LocalizationBindings();
  private readonly root: HTMLElement;
  private readonly total: HTMLParagraphElement;
  private readonly rank: HTMLParagraphElement;
  private readonly lines: HTMLDivElement;
  private readonly purchaseNotice: HTMLParagraphElement;
  private state: RewardSummaryState | undefined;

  constructor(host: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'reward-summary';
    this.localization.attribute(this.root, 'aria-label', () => t('Награды'));
    this.root.setAttribute('aria-live', 'polite');
    this.total = document.createElement('p');
    this.total.className = 'reward-summary-total';
    this.rank = document.createElement('p');
    this.rank.className = 'reward-summary-level';
    this.lines = document.createElement('div');
    this.lines.className = 'reward-summary-lines';
    this.purchaseNotice = document.createElement('p');
    this.purchaseNotice.className = 'reward-summary-purchase-notice';
    this.root.append(this.total, this.rank, this.lines, this.purchaseNotice);
    host.append(this.root);
    this.update(undefined);
  }

  refreshLocalization(): void {
    this.localization.refresh();
    this.update(this.state);
  }

  update(reward: RewardSummaryState | undefined): void {
    this.state = reward;
    this.root.hidden = reward === undefined;
    if (reward === undefined) return;

    this.root.toggleAttribute('aria-busy', reward.pending === true);
    if (reward.pending) {
      this.localization.text(this.total, () => t('Награды начисляются…'));
      this.rank.textContent = '';
      this.lines.replaceChildren();
      this.purchaseNotice.hidden = true;
      return;
    }

    if (reward.coins === 0) this.total.textContent = t('Без повторной награды');
    else this.total.replaceChildren(createCoinValue(reward.coins));

    this.rank.textContent = reward.rankAdvancedTo
      ? t('Новый ранг: {rank}', { rank: t(RANK_LABELS[reward.rankAdvancedTo]) })
      : '';
    this.rank.hidden = !reward.rankAdvancedTo;

    this.lines.replaceChildren(...reward.lines.map((line) => {
      const row = document.createElement('div');
      row.className = 'reward-summary-line';
      const label = document.createElement('span');
      label.textContent = translateRewardLabel(line.label);
      const value = document.createElement('span');
      value.className = 'reward-summary-line-value';
      value.replaceChildren(createCoinValue(line.coins));
      row.append(label, value);
      return row;
    }));

    this.purchaseNotice.textContent = reward.themePurchaseUnlocked
      ? t('Доступны новые темы в коллекции')
      : '';
    this.purchaseNotice.hidden = reward.themePurchaseUnlocked !== true;
  }
}
