import type { GameMode } from './types.ts';

export function shouldRecordStandardFailure(input: {
  readonly currentMode: GameMode | null;
  readonly currentSeed: bigint | null;
  readonly replacementMode: GameMode;
  readonly replacementSeed: bigint | null;
  readonly attemptStarted: boolean;
  readonly attemptFinalized: boolean;
}): boolean {
  if (
    input.currentMode !== 'winnable'
    || input.currentSeed === null
    || !input.attemptStarted
    || input.attemptFinalized
  ) {
    return false;
  }

  return !(
    input.replacementMode === 'winnable'
    && input.replacementSeed === input.currentSeed
  );
}
