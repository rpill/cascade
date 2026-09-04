import type { OrdinaryGameMode } from '../meta/GameStats.ts';

export const LEADERBOARD_NAMES = {
  winnable: 'standardbesttime',
  original: 'classicbesttime',
} as const satisfies Record<OrdinaryGameMode, string>;

export function getLeaderboardName(mode: OrdinaryGameMode): string {
  return LEADERBOARD_NAMES[mode];
}
