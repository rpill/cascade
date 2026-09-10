import { t, LocalizationBindings } from '../../localization/Localization.ts';
import { createCoinInline } from './ui/CoinInline.ts';
export interface RewardSummaryLine {
  readonly label: string;
  readonly xp: number;
  readonly coins: number;
}

export interface RewardSummaryState {
  readonly xp: number;
  readonly coins: number;
  readonly level: number;
  readonly lines: readonly RewardSummaryLine[];
  readonly pending?: boolean;
}

export function translateRewardLabel(label: string): string {
  const weekly = /^(\d+) испытаний за неделю$/.exec(label);
  if (weekly) return t('{count} испытаний за неделю', { count: weekly[1]! });
  const levels = /^Новые уровни ×(\d+)$/.exec(label);
  if (levels) return t('Новые уровни ×{count}', { count: levels[1]! });
  return t(label);
}

function createRewardValueContent(xp: number, coins: number): DocumentFragment {
  const content = document.createDocumentFragment();
  let hasPart = false;

  if (xp !== 0) {
    content.append(document.createTextNode(`${xp > 0 ? '+' : ''}${xp} XP`));
    hasPart = true;
  }

  if (coins !== 0) {
    if (hasPart) {
      content.append(document.createTextNode(' · '));
    }
    content.append(createCoinInline(`${coins > 0 ? '+' : ''}${coins}`, {
      className: 'reward-summary-coin-inline',
      label: t('монет'),
    }));
  }

  return content;
}

export class RewardSummaryView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
    this.update(this.state);
  }

  private readonly root: HTMLElement;
  private readonly total: HTMLParagraphElement;
  private readonly level: HTMLParagraphElement;
  private readonly lines: HTMLDivElement;
  private state: RewardSummaryState | undefined;

  constructor(host: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'reward-summary';
    this.localization.attribute(this.root, 'aria-label', () => t('Награды'));
    this.root.setAttribute('aria-live', 'polite');
    this.total = document.createElement('p');
    this.total.className = 'reward-summary-total';
    this.level = document.createElement('p');
    this.level.className = 'reward-summary-level';
    this.lines = document.createElement('div');
    this.lines.className = 'reward-summary-lines';
    this.root.append(this.total, this.level, this.lines);
    host.append(this.root);
    this.update(undefined);
  }

  update(reward: RewardSummaryState | undefined): void {
    this.state = reward;
    this.root.hidden = reward === undefined;
    if (reward === undefined) {
      return;
    }

    this.root.toggleAttribute('aria-busy', reward.pending === true);
    if (reward.pending) {
      this.localization.text(this.total, () => t('Награды начисляются…'));
      this.localization.text(this.level, () => '');
      this.lines.replaceChildren();
      return;
    }

    if (reward.xp === 0 && reward.coins === 0) {
      this.total.textContent = t('Без повторной награды');
    } else {
      this.total.replaceChildren(createRewardValueContent(reward.xp, reward.coins));
    }
    this.level.textContent = t("Уровень {value0}", {value0: Math.max(1, Math.floor(reward.level))});
    this.lines.replaceChildren(...reward.lines.map((line) => {
      const row = document.createElement('div');
      row.className = 'reward-summary-line';
      const label = document.createElement('span');
      label.textContent = translateRewardLabel(line.label);
      const value = document.createElement('span');
      value.className = 'reward-summary-line-value';
      if (line.xp === 0 && line.coins === 0) {
        value.textContent = '—';
      } else {
        value.replaceChildren(createRewardValueContent(line.xp, line.coins));
      }
      row.append(label, value);
      return row;
    }));
  }
}
