import { getLevelProgress } from '../../meta/Progression.ts';

export const LEVEL_UP_COIN_REWARD = 50;

export type VictoryProgressStep =
  | {
      readonly kind: 'fill';
      readonly level: number;
      readonly from: number;
      readonly to: number;
      readonly required: number;
    }
  | {
      readonly kind: 'level-up';
      readonly fromLevel: number;
      readonly toLevel: number;
      readonly coins: number;
    };

export function createVictoryProgressSequence(
  totalXpBefore: number,
  awardedXp: number,
): readonly VictoryProgressStep[] {
  let totalXp = Math.max(0, Math.floor(Number.isFinite(totalXpBefore) ? totalXpBefore : 0));
  let remaining = Math.max(0, Math.floor(Number.isFinite(awardedXp) ? awardedXp : 0));
  const steps: VictoryProgressStep[] = [];

  while (remaining > 0) {
    const progress = getLevelProgress(totalXp);
    const room = Math.max(0, progress.xpForNextLevel - progress.xpIntoLevel);
    if (room === 0) break;

    const amount = Math.min(remaining, room);
    const nextTotalXp = totalXp + amount;
    steps.push({
      kind: 'fill',
      level: progress.level,
      from: progress.xpIntoLevel,
      to: progress.xpIntoLevel + amount,
      required: progress.xpForNextLevel,
    });

    totalXp = nextTotalXp;
    remaining -= amount;

    const nextProgress = getLevelProgress(totalXp);
    if (nextProgress.level > progress.level) {
      steps.push({
        kind: 'level-up',
        fromLevel: progress.level,
        toLevel: nextProgress.level,
        coins: LEVEL_UP_COIN_REWARD,
      });
    }
  }

  return steps;
}
