import test from 'node:test';
import assert from 'node:assert/strict';

type CardMotionKind = 'stock' | 'foundation' | 'player' | 'undo';

interface CardAnimationModule {
  getCardMotionDuration?: (kind: CardMotionKind) => number;
  getFoundationStepDelay?: () => number;
  getStockFlightOriginY?: (
    stockY: number,
    layerOffsets: readonly number[],
  ) => number;
}

async function loadCardAnimation(): Promise<CardAnimationModule> {
  const modulePath = '../src/game/view/CardAnimation.ts';
  return import(modulePath).catch(() => ({}));
}

test('a card leaves from the upper visible layer of the stock', async () => {
  const { getStockFlightOriginY } = await loadCardAnimation();

  assert.equal(
    typeof getStockFlightOriginY,
    'function',
    'card animation must derive its launch point from the visible stock layers',
  );

  if (getStockFlightOriginY === undefined) {
    assert.fail('getStockFlightOriginY is unavailable');
  }

  assert.equal(getStockFlightOriginY(62, [0, -3, -6, -9]), 53);
  assert.equal(getStockFlightOriginY(62, []), 62);
});

test('automatic flights are slower than player-controlled settling', async () => {
  const { getCardMotionDuration } = await loadCardAnimation();

  assert.equal(
    typeof getCardMotionDuration,
    'function',
    'card animation must keep automatic and player motion profiles separate',
  );

  if (getCardMotionDuration === undefined) {
    assert.fail('getCardMotionDuration is unavailable');
  }

  const playerDuration = getCardMotionDuration('player');

  assert.ok(getCardMotionDuration('stock') > playerDuration);
  assert.ok(getCardMotionDuration('foundation') > playerDuration);
});

test('foundation cards settle before the next automatic step starts', async () => {
  const {
    getCardMotionDuration,
    getFoundationStepDelay,
  } = await loadCardAnimation();

  assert.equal(typeof getCardMotionDuration, 'function');
  assert.equal(typeof getFoundationStepDelay, 'function');

  if (
    getCardMotionDuration === undefined
    || getFoundationStepDelay === undefined
  ) {
    assert.fail('foundation animation timing is unavailable');
  }

  assert.ok(
    getFoundationStepDelay() >= getCardMotionDuration('foundation'),
  );
});


test('undo uses the same quick settle duration as a player move', async () => {
  const { getCardMotionDuration } = await loadCardAnimation();

  assert.equal(typeof getCardMotionDuration, 'function');
  if (getCardMotionDuration === undefined) {
    assert.fail('card motion durations are unavailable');
  }

  assert.equal(
    getCardMotionDuration('undo'),
    getCardMotionDuration('player'),
  );
});
