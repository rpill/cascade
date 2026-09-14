export interface GameplayActivityInput {
  readonly attemptStarted: boolean;
  readonly attemptFinalized: boolean;
  readonly flowPlaying: boolean;
  readonly menuPaused: boolean;
  readonly localInteractionBlocked: boolean;
  readonly documentVisible: boolean;
  readonly platformPaused: boolean;
}

export type GameplayMarkupAction = 'start' | 'stop' | 'keep';

export interface GameplayActivityDecision {
  readonly timerShouldRun: boolean;
  readonly sceneShouldPause: boolean;
  readonly markupAction: GameplayMarkupAction;
}

export function deriveGameplayActivity(
  input: GameplayActivityInput,
): GameplayActivityDecision {
  const locallyPlayable =
    input.attemptStarted
    && !input.attemptFinalized
    && input.flowPlaying
    && !input.localInteractionBlocked
    && input.documentVisible;

  return {
    timerShouldRun: locallyPlayable && !input.platformPaused,
    sceneShouldPause: input.platformPaused || input.menuPaused,
    markupAction: !locallyPlayable
      ? 'stop'
      : input.platformPaused
        ? 'keep'
        : 'start',
  };
}
