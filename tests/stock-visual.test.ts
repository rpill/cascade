import test from 'node:test';
import assert from 'node:assert/strict';

interface StockVisualStateLike {
  readonly cardCount: number;
  readonly layerCount: number;
  readonly layerOffsets: readonly number[];
  removeDealtCard(): void;
  sync(cardCount: number): void;
}

type StockVisualStateConstructor = new (
  stockCards: number,
  pendingDealCards: number,
) => StockVisualStateLike;

test('stock thickness shrinks from the full deck to the remaining stock', async () => {
  const modulePath = '../src/game/view/StockVisualState.ts';
  const loaded = await import(modulePath).catch(() => ({}));
  const StockVisualState = (
    loaded as { StockVisualState?: StockVisualStateConstructor }
  ).StockVisualState;

  assert.equal(
    typeof StockVisualState,
    'function',
    'StockVisualState must model the cards still visible in the deck',
  );

  if (StockVisualState === undefined) {
    assert.fail('StockVisualState is unavailable');
  }

  const visual = new StockVisualState(24, 28);

  assert.equal(visual.cardCount, 52);
  assert.equal(visual.layerCount, 11);
  assert.deepEqual(visual.layerOffsets, [0, -3, -6, -9, -12, -15, -18, -21, -24, -27, -30]);

  for (let index = 0; index < 28; index += 1) {
    visual.removeDealtCard();
  }

  assert.equal(visual.cardCount, 24);
  assert.equal(visual.layerCount, 5);
  assert.deepEqual(
    visual.layerOffsets,
    [0, -3, -6, -9, -12],
    'the bottom stays on the slot while the visible stack rises above it',
  );

  visual.sync(18);
  assert.equal(visual.layerCount, 4);

  visual.sync(0);
  assert.equal(visual.layerCount, 0);
});
