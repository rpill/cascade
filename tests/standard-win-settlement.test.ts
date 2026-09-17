import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';

test('standard first completion records seed once', () => {
  const first = settleStandardWin(createDefaultMetaSave(), { seed: '101', partition: 'easy', difficulty: 'easy' });
  assert.deepEqual(first.state.standard.completed.easy, ['101']);
  assert.equal(first.firstCompletion, true);
  const replay = settleStandardWin(first.state, { seed: '101', partition: 'easy', difficulty: 'easy' });
  assert.equal(replay.firstCompletion, false);
  assert.deepEqual(replay.state.standard.completed.easy, ['101']);
});

test('onboarding increments onboarding wins', () => {
  const result = settleStandardWin(createDefaultMetaSave(), { seed: '1', partition: 'onboarding', difficulty: 'easy' });
  assert.equal(result.state.standard.onboardingWins, 1);
  assert.deepEqual(result.state.standard.completed.onboarding, ['1']);
});

test('ten unique standard completions promote novice to player', () => {
  let state = createDefaultMetaSave();
  for (let seed = 1; seed <= 10; seed += 1) {
    state = settleStandardWin(state, { seed: String(seed), partition: 'easy', difficulty: 'easy' }).state;
  }
  assert.equal(state.mastery.rank, 'player');
});

test('partition and difficulty mismatch is rejected', () => {
  assert.throws(() => settleStandardWin(createDefaultMetaSave(), {
    seed: '5', partition: 'easy', difficulty: 'hard',
  }), /partition/u);
});
