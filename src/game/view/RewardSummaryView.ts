import { t, LocalizationBindings } from '../../localization/Localization.ts';
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

function formatRewardValue(xp: number, coins: number): string {
  const parts: string[] = [];
  if (xp !== 0) {
    parts.push(`${xp > 0 ? '+' : ''}${xp} XP`);
  }
  if (coins !== 0) {
    parts.push(t("{value0}{value1} монет", {value0: coins > 0 ? '+' : '', value1: coins}));
  }
  return parts.join(' · ');
}

export class RewardSummaryView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
  }

  private readonly root: HTMLElement;
  private readonly total: HTMLParagraphElement;
  private readonly level: HTMLParagraphElement;
  private readonly lines: HTMLDivElement;

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

    this.localization.text(this.total, () => formatRewardValue(reward.xp, reward.coins) || t('Без повторной награды'));
    this.localization.text(this.level, () => t("Уровень {value0}", {value0: Math.max(1, Math.floor(reward.level))}));
    this.lines.replaceChildren(...reward.lines.map((line) => {
      const row = document.createElement('div');
      row.className = 'reward-summary-line';
      const label = document.createElement('span');
      this.localization.text(label, () => translateRewardLabel(line.label));
      const value = document.createElement('span');
      value.className = 'reward-summary-line-value';
      this.localization.text(value, () => formatRewardValue(line.xp, line.coins) || '—');
      row.append(label, value);
      return row;
    }));
  }
}
