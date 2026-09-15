import { ENGLISH } from '../../localization/English.ts';
import type { Language } from '../../settings/Preferences.ts';
import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import type { MasteryRank, MasteryStageProgress, MetaSave } from '../../meta/MetaSave.ts';

export const MASTERY_RANK_ORDER = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'] as const satisfies readonly MasteryRank[];

export interface MasteryRequirementViewModel {
  readonly key: keyof MasteryStageProgress;
  readonly label: string;
  readonly current: number;
  readonly total: number;
}
export interface MasteryPathItemViewModel { readonly rank: MasteryRank; readonly label: string; readonly current: boolean; readonly completed: boolean }
export interface MasteryViewModel {
  readonly rank: MasteryRank;
  readonly rankLabel: string;
  readonly requirements: readonly MasteryRequirementViewModel[];
  readonly nextRewardCoins: number;
  readonly path: readonly MasteryPathItemViewModel[];
}

function tr(language: Language, source: string): string { return language === 'en' ? ENGLISH[source] ?? source : source; }
function rankLabel(language: Language, rank: MasteryRank): string {
  const labels: Record<MasteryRank, string> = { novice:'Новичок',player:'Игрок',tactician:'Тактик',expert:'Эксперт',master:'Мастер',grandmaster:'Грандмастер' };
  return tr(language, labels[rank]);
}
function requirementLabel(language: Language, key: keyof MasteryStageProgress): string {
  const labels: Record<keyof MasteryStageProgress, string> = { anyWins:'Любые победы',mediumWins:'Средняя сложность',hardWins:'Сложная сложность',onTimeDailyWins:'Daily вовремя' };
  return tr(language, labels[key]);
}

export function buildMasteryViewModel(state: MetaSave, language: Language = 'ru'): MasteryViewModel {
  const { rank, stage } = state.mastery;
  const currentIndex = MASTERY_RANK_ORDER.indexOf(rank);
  const requirements = getMasteryRequirements(rank);
  const keys: readonly (keyof MasteryStageProgress)[] = ['anyWins','mediumWins','hardWins','onTimeDailyWins'];
  return {
    rank,
    rankLabel: rankLabel(language, rank),
    requirements: requirements ? keys.filter(key => requirements[key] > 0).map(key => ({ key, label: requirementLabel(language,key), current: stage[key], total: requirements[key] })) : [],
    nextRewardCoins: requirements?.rewardCoins ?? 0,
    path: MASTERY_RANK_ORDER.map((pathRank,index)=>({ rank:pathRank,label:rankLabel(language,pathRank),current:pathRank===rank,completed:index<currentIndex })),
  };
}
