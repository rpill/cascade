import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { getMasteryRequirements, recordMasteryEligibleStandardWin } from '../src/meta/mastery/Mastery.ts';

test('Mastery requirements match the progression ladder without currency rewards', () => {
  assert.deepEqual(getMasteryRequirements('novice'), { anyWins: 10, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 });
  assert.deepEqual(getMasteryRequirements('player'), { anyWins: 0, mediumWins: 15, hardWins: 3, onTimeDailyWins: 0 });
  assert.deepEqual(getMasteryRequirements('tactician'), { anyWins: 0, mediumWins: 25, hardWins: 10, onTimeDailyWins: 0 });
  assert.deepEqual(getMasteryRequirements('expert'), { anyWins: 0, mediumWins: 0, hardWins: 25, onTimeDailyWins: 5 });
  assert.deepEqual(getMasteryRequirements('master'), { anyWins: 0, mediumWins: 0, hardWins: 60, onTimeDailyWins: 15 });
  assert.equal(getMasteryRequirements('grandmaster'), null);
});

test('ten unique wins promote novice to player', () => {
  let state = createDefaultMetaSave();
  for (let seed = 1; seed <= 10; seed += 1) state = recordMasteryEligibleStandardWin(state, { seed: String(seed), difficulty: 'easy' }).state;
  assert.equal(state.mastery.rank, 'player');
  assert.deepEqual(state.mastery.stage, { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 });
});

test('same Standard seed cannot credit mastery twice', () => {
  const base = createDefaultMetaSave();
  const state = { ...base, mastery: { rank: 'player' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } } };
  const first = recordMasteryEligibleStandardWin(state, { seed: '42', difficulty: 'hard' }).state;
  const second = recordMasteryEligibleStandardWin(first, { seed: '42', difficulty: 'hard' }).state;
  assert.equal(second.mastery.stage.hardWins, 1);
  assert.deepEqual(second.standard.masteryCreditedSeeds, ['42']);
});
