import type {
  MetaSave,
  MetaSaveV2,
  ModeStats,
} from './MetaSave.ts';

export type OrdinaryGameMode = 'original' | 'winnable';

export interface ModeCompletionResult {
  readonly state: MetaSaveV2;
  readonly stats: ModeStats;
  readonly improvedBest: boolean;
}

export function getModeStats(
  state: MetaSave,
  mode: OrdinaryGameMode,
): ModeStats {
  return { ...state.stats[mode] };
}

export function beginModeAttempt(
  state: MetaSave,
  mode: OrdinaryGameMode,
): MetaSaveV2 {
  const previous = state.stats[mode];

  return {
    ...state,
    stats: {
      ...state.stats,
      [mode]: {
        ...previous,
        played: previous.played + 1,
      },
    },
  };
}

export function completeModeAttempt(
  state: MetaSave,
  mode: OrdinaryGameMode,
  elapsedMs: number,
): ModeCompletionResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error('Ordinary elapsed time must be positive.');
  }

  const previous = state.stats[mode];
  if (previous.wins >= previous.played) {
    throw new Error('Begin an attempt before completing it.');
  }

  const improvedBest = previous.bestTimeMs === undefined || elapsedMs < previous.bestTimeMs;
  const bestTimeMs = improvedBest ? elapsedMs : previous.bestTimeMs;
  const stats: ModeStats = {
    ...previous,
    wins: previous.wins + 1,
    ...(bestTimeMs === undefined ? {} : { bestTimeMs }),
  };

  return {
    state: {
      ...state,
      stats: {
        ...state.stats,
        [mode]: stats,
      },
    },
    stats: { ...stats },
    improvedBest,
  };
}
