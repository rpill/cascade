import { recordMasteryEligibleStandardWin } from '../mastery/Mastery.ts';
import type { MasteryRank, MetaSave, StandardDifficulty, StandardPartition } from '../MetaSave.ts';

export interface StandardWinResultInput {
  readonly seed: string;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
}

export interface StandardWinSettlementResult {
  readonly state: MetaSave;
  readonly firstCompletion: boolean;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

function appendUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

export function settleStandardWin(state: MetaSave, input: StandardWinResultInput): StandardWinSettlementResult {
  if (!/^[1-9]\d{0,9}$/u.test(input.seed)) throw new Error('Standard seed must be a positive integer string.');
  if (input.partition === 'onboarding' && input.difficulty !== 'easy') throw new Error('Onboarding partition must use easy difficulty.');
  if (input.partition !== 'onboarding' && input.partition !== input.difficulty) throw new Error('Standard partition and difficulty must match.');

  const completed = state.standard.completed[input.partition];
  const firstCompletion = !completed.includes(input.seed);
  let next = state;
  if (firstCompletion) {
    next = {
      ...next,
      standard: {
        ...next.standard,
        completed: { ...next.standard.completed, [input.partition]: appendUnique(completed, input.seed) },
        onboardingWins: Math.min(5, next.standard.onboardingWins + 1),
      },
    };
  }

  let masteryAdvanced = false;
  let rankAdvancedTo: MasteryRank | null = null;
  if (!next.standard.masteryCreditedSeeds.includes(input.seed)) {
    const mastery = recordMasteryEligibleStandardWin(next, { seed: input.seed, difficulty: input.difficulty });
    next = mastery.state;
    masteryAdvanced = mastery.masteryAdvanced;
    rankAdvancedTo = mastery.rankAdvancedTo;
  }
  return { state: next, firstCompletion, masteryAdvanced, rankAdvancedTo };
}
