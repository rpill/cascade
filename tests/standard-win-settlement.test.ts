import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';

test('standard first completion grants difficulty coins and records seed once', () => {
  const initial = createDefaultMetaSave();
  const first = settleStandardWin(initial, { seed: '101', partition: 'easy', difficulty: 'easy' });
  assert.equal(first.baseCoinsGranted, 5);
  assert.equal(first.state.progression.coins, 5);
  assert.deepEqual(first.state.standard.completed.easy, ['101']);
  assert.equal(first.firstCompletion, true);

  const replay = settleStandardWin(first.state, { seed: '101', partition: 'easy', difficulty: 'easy' });
  assert.equal(replay.baseCoinsGranted, 0);
  assert.equal(replay.state.progression.coins, 5);
  assert.equal(replay.firstCompletion, false);
});

test('standard rewards medium and hard with Trifold values', () => {
  const medium = settleStandardWin(createDefaultMetaSave(), { seed: '201', partition: 'medium', difficulty: 'medium' });
  const hard = settleStandardWin(createDefaultMetaSave(), { seed: '301', partition: 'hard', difficulty: 'hard' });
  assert.equal(medium.baseCoinsGranted, 7);
  assert.equal(hard.baseCoinsGranted, 10);
});

test('onboarding uses easy reward and increments onboarding wins', () => {
  const result = settleStandardWin(createDefaultMetaSave(), { seed: '1', partition: 'onboarding', difficulty: 'easy' });
  assert.equal(result.baseCoinsGranted, 5);
  assert.equal(result.state.standard.onboardingWins, 1);
  assert.deepEqual(result.state.standard.completed.onboarding, ['1']);
});

test('a unique standard completion advances mastery once', () => {
  let state = createDefaultMetaSave();
  for (let seed = 1; seed <= 10; seed += 1) {
    state = settleStandardWin(state, { seed: String(seed), partition: 'easy', difficulty: 'easy' }).state;
  }
  assert.equal(state.mastery.rank, 'player');
  assert.equal(state.progression.coins, 150); // ten easy wins (50) + novice rank reward (100)
});

test('partition and difficulty mismatch is rejected', () => {
  assert.throws(() => settleStandardWin(createDefaultMetaSave(), {
    seed: '5', partition: 'easy', difficulty: 'hard',
  }), /partition/u);
});
