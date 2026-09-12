import type { GameFlowState } from './GameFlow.ts';
import type { GameMode } from './types.ts';

export function getContinuableMenuMode(
  flowState: GameFlowState,
  currentMode: GameMode | null,
  currentDealWon: boolean,
): GameMode | null {
  if (flowState !== 'menu-paused' || currentMode === null || currentDealWon) {
    return null;
  }

  return currentMode;
}
