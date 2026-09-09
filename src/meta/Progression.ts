import { MAX_ECONOMY_VALUE } from './MetaSave.ts';

export function getLevelProgress(totalXp: number) {
  const xp = Number.isFinite(totalXp) ? Math.min(MAX_ECONOMY_VALUE, Math.max(0, Math.floor(totalXp))) : 0;
  const level = Math.max(1, Math.floor((-1 + Math.sqrt(9 + 4 * xp / 25)) / 2));
  const threshold = 25 * (level - 1) * (level + 2);
  return {level, xpIntoLevel: xp - threshold, xpForNextLevel: 100 + 50 * (level - 1)};
}
