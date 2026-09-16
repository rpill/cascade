import type { Language } from '../../settings/Preferences.ts';
import type { StandardDifficulty } from '../../meta/MetaSave.ts';
import { difficultyLabel } from '../home/HomeViewModel.ts';

export interface GameHudInput {
  readonly difficulty?: StandardDifficulty;
  readonly modeLabel?: string;
  readonly moves: number;
  readonly activeMs: number;
  readonly canUndo: boolean;
  readonly coins: number;
  readonly rewardCoins?: number;
  readonly rewardClaimed?: boolean;
  readonly hintEligible: boolean;
  readonly hintRemaining?: number;
  readonly newDealEnabled: boolean;
  readonly newDealVisible?: boolean;
}

export interface GameHudViewModel {
  readonly difficultyLabel: string;
  readonly movesLabel: string;
  readonly timeLabel: string;
  readonly undoEnabled: boolean;
  readonly hintEnabled: boolean;
  readonly newDealEnabled: boolean;
  readonly newDealVisible: boolean;
  readonly coinLabel: string;
  readonly homeLabel: string;
  readonly newDealLabel: string;
  readonly restartLabel: string;
  readonly undoLabel: string;
  readonly hintLabel: string;
}

function translate(language: Language, russian: string, english: string): string {
  return language === 'en' ? english : russian;
}

export function formatActiveTime(activeMs: number): string {
  const secondsTotal = Math.max(0, Math.floor(activeMs / 1000));
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function buildGameHudViewModel(input: GameHudInput, language: Language = 'ru'): GameHudViewModel {
  return {
    difficultyLabel: input.modeLabel ?? difficultyLabel(language, input.difficulty ?? 'easy'),
    movesLabel: translate(language, `${Math.max(0, input.moves)} ходов`, `${Math.max(0, input.moves)} moves`),
    timeLabel: formatActiveTime(input.activeMs),
    undoEnabled: input.canUndo,
    hintEnabled: input.hintEligible && (input.hintRemaining === undefined || input.hintRemaining > 0),
    newDealEnabled: input.newDealEnabled,
    newDealVisible: input.newDealVisible !== false,
    coinLabel: input.rewardCoins === undefined
      ? String(Math.max(0, Math.floor(input.coins)))
      : (input.rewardClaimed
        ? translate(language, 'Получено', 'Claimed')
        : `+${Math.max(0, Math.floor(input.rewardCoins))}`),
    homeLabel: translate(language, 'Домой', 'Home'),
    newDealLabel: translate(language, 'Новая', 'New deal'),
    restartLabel: translate(language, 'Заново', 'Restart'),
    undoLabel: translate(language, 'Отмена', 'Undo'),
    hintLabel: input.hintRemaining === undefined
      ? translate(language, 'Подсказка', 'Hint')
      : translate(language, `Подсказка ${Math.max(0, input.hintRemaining)}/1`, `Hint ${Math.max(0, input.hintRemaining)}/1`),
  };
}
