import test from 'node:test';
import assert from 'node:assert/strict';

interface CardDepthTransition {
  readonly active: number;
  readonly resting: number;
}

type GetCardDepthTransition = (
  currentDepth: number,
  placementDepth: number,
  animated: boolean,
  positionChanged: boolean,
) => CardDepthTransition;

test('a returning dragged card stays above the board until it settles', async () => {
  const modulePath = '../src/game/view/CardMotionDepth.ts';
  const loaded = await import(modulePath).catch(() => ({}));
  const getCardDepthTransition = (
    loaded as { getCardDepthTransition?: GetCardDepthTransition }
  ).getCardDepthTransition;

  assert.equal(
    typeof getCardDepthTransition,
    'function',
    'card motion must define separate travelling and resting depths',
  );

  if (getCardDepthTransition === undefined) {
    assert.fail('getCardDepthTransition is unavailable');
  }

  assert.deepEqual(
    getCardDepthTransition(3007, 205, true, true),
    { active: 3007, resting: 205 },
  );
});
