import test from 'node:test';
import assert from 'node:assert/strict';
import { createVictoryProgressSequence } from '../src/game/view/VictoryProgress.ts';

test('victory XP fills the current level without a level-up when threshold is not reached', () => {
  assert.deepEqual(createVictoryProgressSequence(40, 50), [
    { kind:'fill', level:1, from:40, to:90, required:100 },
  ]);
});

test('victory XP shows level reward before carrying overflow into the next level', () => {
  assert.deepEqual(createVictoryProgressSequence(80, 70), [
    { kind:'fill', level:1, from:80, to:100, required:100 },
    { kind:'level-up', fromLevel:1, toLevel:2, coins:50 },
    { kind:'fill', level:2, from:0, to:50, required:150 },
  ]);
});

test('victory XP supports more than one level-up in one reward', () => {
  assert.deepEqual(createVictoryProgressSequence(90, 190), [
    { kind:'fill', level:1, from:90, to:100, required:100 },
    { kind:'level-up', fromLevel:1, toLevel:2, coins:50 },
    { kind:'fill', level:2, from:0, to:150, required:150 },
    { kind:'level-up', fromLevel:2, toLevel:3, coins:50 },
    { kind:'fill', level:3, from:0, to:30, required:200 },
  ]);
});
