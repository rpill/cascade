import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVictoryRewardPresentation } from '../src/game/view/VictoryRewardPresentation.ts';

const promotedReward = {
  coins: 105,
  lines: [
    { label: 'Победа', coins: 5 },
    { label: 'Новый ранг мастерства', coins: 100 },
  ],
  rankAdvancedTo: 'player' as const,
};

test('victory reward presentation separates base win reward from mastery rank reward', () => {
  const result = buildVictoryRewardPresentation(promotedReward, { doubleBonusCoins: 5, doubled: false });
  assert.equal(result.baseCoins, 5);
  assert.equal(result.rankCoins, 100);
  assert.equal(result.totalCoins, 105);
  assert.equal(result.doubleFromCoins, 5);
  assert.equal(result.doubleToCoins, 10);
});

test('claimed x2 doubles only the base win reward and keeps rank reward fixed', () => {
  const result = buildVictoryRewardPresentation({ ...promotedReward, coins: 110 }, { doubleBonusCoins: 5, doubled: true });
  assert.equal(result.baseCoins, 10);
  assert.equal(result.rankCoins, 100);
  assert.equal(result.totalCoins, 110);
  assert.equal(result.doubleFromCoins, 5);
  assert.equal(result.doubleToCoins, 10);
});

test('ordinary first-completion win without rank promotion stays a single base reward', () => {
  const result = buildVictoryRewardPresentation({
    coins: 7,
    lines: [{ label: 'Победа', coins: 7 }],
  }, { doubleBonusCoins: 7, doubled: false });
  assert.equal(result.baseCoins, 7);
  assert.equal(result.rankCoins, 0);
  assert.equal(result.totalCoins, 7);
});
