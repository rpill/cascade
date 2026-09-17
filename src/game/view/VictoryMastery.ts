import { t } from '../../localization/Localization.ts';
import type { Language } from '../../settings/Preferences.ts';
import { ENGLISH } from '../../localization/English.ts';
import type { MasteryRank, MasteryStageProgress, MetaSave } from '../../meta/MetaSave.ts';
import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';

export interface VictoryMasteryMetric {
  readonly key: keyof MasteryStageProgress;
  readonly current: number;
  readonly total: number;
}

export interface VictoryMasterySnapshot {
  readonly rank: MasteryRank;
  readonly metrics: readonly VictoryMasteryMetric[];
}

export interface VictoryMasteryState {
  readonly before: VictoryMasterySnapshot;
  readonly after: VictoryMasterySnapshot;
  readonly rankAdvancedTo: MasteryRank | null;
}

export interface WinOverlayMasteryContent {
  readonly title: string;
  readonly beforeRank: MasteryRank;
  readonly afterRank: MasteryRank;
  readonly beforeRankLabel: string;
  readonly afterRankLabel: string;
  readonly beforeProgressCurrent: number;
  readonly beforeProgressTotal: number;
  readonly afterProgressCurrent: number;
  readonly afterProgressTotal: number;
  readonly beforeCaption: string;
  readonly afterCaption: string;
  readonly progressLabel: string;
  readonly promoted: boolean;
  readonly rewardLine: string | null;
}

const METRIC_KEYS: readonly (keyof MasteryStageProgress)[] = ['anyWins', 'mediumWins', 'hardWins', 'onTimeDailyWins'];
const RANK_LABELS: Readonly<Record<MasteryRank, string>> = {
  novice: 'Новичок',
  player: 'Игрок',
  tactician: 'Тактик',
  expert: 'Эксперт',
  master: 'Мастер',
  grandmaster: 'Грандмастер',
};
const METRIC_LABELS: Readonly<Record<keyof MasteryStageProgress, string>> = {
  anyWins: 'Победы',
  mediumWins: 'Средняя',
  hardWins: 'Сложная',
  onTimeDailyWins: 'Daily вовремя',
};

function tr(language: Language, source: string): string {
  return language === 'en' ? ENGLISH[source] ?? source : source;
}

function snapshotFromState(state: MetaSave): VictoryMasterySnapshot {
  const requirements = getMasteryRequirements(state.mastery.rank);
  const metrics = requirements
    ? METRIC_KEYS
      .filter((key) => requirements[key] > 0)
      .map((key) => ({ key, current: state.mastery.stage[key], total: requirements[key] }))
    : [];
  return { rank: state.mastery.rank, metrics };
}

function aggregateProgress(metrics: readonly VictoryMasteryMetric[]): { current: number; total: number } {
  if (metrics.length === 0) return { current: 1, total: 1 };
  return {
    current: metrics.reduce((sum, metric) => sum + Math.min(metric.current, metric.total), 0),
    total: metrics.reduce((sum, metric) => sum + metric.total, 0),
  };
}

function formatCaption(metrics: readonly VictoryMasteryMetric[], language: Language): string {
  if (metrics.length === 0) return tr(language, 'Все ранги открыты');
  return metrics
    .map((metric) => `${tr(language, METRIC_LABELS[metric.key])}: ${metric.current} / ${metric.total}`)
    .join('\n');
}

export function buildVictoryMasteryState(before: MetaSave, after: MetaSave, rankAdvancedTo: MasteryRank | null): VictoryMasteryState {
  const previous = snapshotFromState(before);
  const next = snapshotFromState(after);
  return {
    before: previous,
    after: next,
    rankAdvancedTo,
  };
}

export function presentVictoryMastery(content: VictoryMasteryState, language: Language = 'ru'): WinOverlayMasteryContent {
  const beforeProgress = aggregateProgress(content.before.metrics);
  const afterProgress = aggregateProgress(content.after.metrics);
  return {
    title: tr(language, 'МАСТЕРСТВО'),
    beforeRank: content.before.rank,
    afterRank: content.after.rank,
    beforeRankLabel: tr(language, RANK_LABELS[content.before.rank]),
    afterRankLabel: tr(language, RANK_LABELS[content.after.rank]),
    beforeProgressCurrent: beforeProgress.current,
    beforeProgressTotal: beforeProgress.total,
    afterProgressCurrent: afterProgress.current,
    afterProgressTotal: afterProgress.total,
    beforeCaption: formatCaption(content.before.metrics, language),
    afterCaption: formatCaption(content.after.metrics, language),
    progressLabel: tr(language, 'До следующего ранга'),
    promoted: content.rankAdvancedTo !== null,
    rewardLine: content.rankAdvancedTo !== null
      ? t('Новый ранг достигнут: {rank}', { rank: tr(language, RANK_LABELS[content.after.rank]) })
      : null,
  };
}
