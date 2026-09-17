import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { buildMasteryViewModel } from '../src/ui/mastery/MasteryViewModel.ts';

test('Mastery view model shows current rank requirements and full path', () => {
  const state = createDefaultMetaSave();
  state.mastery = { rank: 'player', stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 } };
  const vm = buildMasteryViewModel(state, 'ru');
  assert.equal(vm.rank, 'player');
  assert.equal(vm.rankLabel, 'Игрок');
  assert.deepEqual(vm.requirements.map(item => [item.key, item.current, item.total]), [
    ['mediumWins', 4, 15],
    ['hardWins', 1, 3],
  ]);
  assert.equal(vm.path.length, 6);
  assert.equal(vm.path[0]?.completed, true);
  assert.equal(vm.path[1]?.current, true);
});

test('Grandmaster has no remaining requirements', () => {
  const state = createDefaultMetaSave();
  state.mastery = { rank: 'grandmaster', stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } };
  const vm = buildMasteryViewModel(state, 'ru');
  assert.deepEqual(vm.requirements, []);
});
