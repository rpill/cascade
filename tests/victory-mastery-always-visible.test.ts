import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { buildVictoryMasteryState, presentVictoryMastery } from '../src/game/view/VictoryMastery.ts';

test('victory keeps Mastery visible even when this win does not advance the current rank', () => {
  const before = createDefaultMetaSave();
  before.mastery = {
    rank: 'player',
    stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
  };
  const after = structuredClone(before);

  const state = buildVictoryMasteryState(before, after, null);
  assert.ok(state, 'Mastery must still be present on every victory screen');

  const content = presentVictoryMastery(state, 'ru');
  assert.equal(content.afterRankLabel, 'Игрок');
  assert.match(content.afterCaption, /Средняя: 0 \/ 15/);
  assert.match(content.afterCaption, /Сложная: 0 \/ 3/);
  assert.equal(content.promoted, false);
});
