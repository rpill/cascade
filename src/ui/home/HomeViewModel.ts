import type { GameMode } from '../../game/model/types.ts';
import { ENGLISH } from '../../localization/English.ts';
import type { Language } from '../../settings/Preferences.ts';
import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import type { MasteryRank, MasteryStageProgress, MetaSave, StandardDifficulty } from '../../meta/MetaSave.ts';

export interface HomeViewModel {
  readonly primary: { readonly title: string; readonly subtitle: string; readonly hasActiveGame: boolean };
  readonly newDeal: { readonly title: string };
  readonly selectedDifficulty: StandardDifficulty;
  readonly daily: { readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly mastery: { readonly rank: MasteryRank; readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly leaders: { readonly title: string; readonly subtitle: string; readonly enabled: boolean };
}

export interface HomeViewModelInput {
  readonly state: MetaSave;
  readonly activeMode: GameMode | null;
  readonly activeDifficulty: StandardDifficulty | null;
  readonly currentDailyId: string | null;
  readonly leaderboardsEnabled: boolean;
  readonly language?: Language;
}

function tr(language: Language, source: string): string {
  return language === 'en' ? ENGLISH[source] ?? source : source;
}

export function difficultyLabel(language: Language, difficulty: StandardDifficulty): string {
  const source = difficulty === 'easy' ? 'Лёгкая' : difficulty === 'medium' ? 'Средняя' : 'Сложная';
  return tr(language, source);
}

export function masteryRankLabel(language: Language, rank: MasteryRank): string {
  const source: Record<MasteryRank, string> = {
    novice: 'Новичок', player: 'Игрок', tactician: 'Тактик', expert: 'Эксперт', master: 'Мастер', grandmaster: 'Грандмастер',
  };
  return tr(language, source[rank]);
}

function requirementPart(language: Language, label: string, current: number, total: number): string {
  return `${tr(language, label)} ${current} / ${total}`;
}

function masterySummary(rank: MasteryRank, stage: MasteryStageProgress, language: Language): string {
  const requirements = getMasteryRequirements(rank);
  if (!requirements) return tr(language, 'Максимальный ранг');
  const parts: string[] = [];
  if (requirements.anyWins > 0) parts.push(requirementPart(language, 'Победы', stage.anyWins, requirements.anyWins));
  if (requirements.mediumWins > 0) parts.push(requirementPart(language, 'Средние', stage.mediumWins, requirements.mediumWins));
  if (requirements.hardWins > 0) parts.push(requirementPart(language, 'Сложные', stage.hardWins, requirements.hardWins));
  if (requirements.onTimeDailyWins > 0) parts.push(requirementPart(language, 'Daily', stage.onTimeDailyWins, requirements.onTimeDailyWins));
  return parts.join(' · ');
}

function shiftDateKey(dateKey: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentDailyStreak(state: MetaSave, todayKey: string): number {
  const todayCompleted = state.daily.records[todayKey]?.completedOnTime === true;
  let cursor = todayCompleted ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (cursor && state.daily.records[cursor]?.completedOnTime === true) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function activeSubtitle(language: Language, mode: GameMode | null, activeDifficulty: StandardDifficulty | null, selected: StandardDifficulty): string {
  if (mode === 'daily') return 'Daily';
  if (mode === 'original') return tr(language, 'Классика');
  return `Standard · ${difficultyLabel(language, activeDifficulty ?? selected)}`;
}

export function buildHomeViewModel(input: HomeViewModelInput): HomeViewModel {
  const language = input.language ?? 'ru';
  const selected = input.state.standard.selectedDifficulty;
  const hasActiveGame = input.activeMode !== null;
  const todayRecord = input.currentDailyId ? input.state.daily.records[input.currentDailyId] : undefined;
  const streak = input.currentDailyId ? currentDailyStreak(input.state, input.currentDailyId) : 0;
  const dailyState = todayRecord?.completed
    ? `${tr(language, 'Сегодня выполнено')} · ${tr(language, 'серия')} ${streak}`
    : `${tr(language, 'Сегодня новая')} · ${tr(language, 'серия')} ${streak}`;

  return {
    primary: {
      title: tr(language, hasActiveGame ? 'ПРОДОЛЖИТЬ' : 'ИГРАТЬ'),
      subtitle: activeSubtitle(language, input.activeMode, input.activeDifficulty, selected),
      hasActiveGame,
    },
    newDeal: { title: tr(language, 'НОВАЯ РАЗДАЧА') },
    selectedDifficulty: selected,
    daily: { title: 'Daily', subtitle: dailyState, enabled: input.currentDailyId !== null },
    mastery: {
      rank: input.state.mastery.rank,
      title: masteryRankLabel(language, input.state.mastery.rank),
      subtitle: masterySummary(input.state.mastery.rank, input.state.mastery.stage, language),
      enabled: true,
    },
    leaders: {
      title: tr(language, 'Лидеры'),
      subtitle: input.leaderboardsEnabled ? tr(language, 'Лучшие результаты игроков') : tr(language, 'Результаты и рекорды'),
      enabled: true,
    },
  };
}
