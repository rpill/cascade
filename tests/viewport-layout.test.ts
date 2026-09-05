import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_ASPECT_RATIO,
  MAX_CARD_WIDTH,
  STANDARD_MIN_CARD_WIDTH,
  calculateViewportLayout,
  type LayoutBounds,
} from '../src/game/view/ViewportLayout.ts';

const VIEWPORTS = [
  [844, 390], [915, 412], [932, 430],
  [1024, 576], [960, 540], [960, 640],
  [1366, 768], [1920, 1080], [2560, 1440],
  [2560, 1080], [3440, 1440],
] as const;

function right(bounds: LayoutBounds): number {
  return bounds.x + bounds.width;
}

function bottom(bounds: LayoutBounds): number {
  return bounds.y + bounds.height;
}

function intersects(left: LayoutBounds, rightBounds: LayoutBounds): boolean {
  return left.x < right(rightBounds)
    && right(left) > rightBounds.x
    && left.y < bottom(rightBounds)
    && bottom(left) > rightBounds.y;
}

for (const [width, height] of VIEWPORTS) {
  test(`${width}x${height} keeps HUD and primary board geometry non-overlapping`, () => {
    const layout = calculateViewportLayout(width, height);

    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.ok(layout.hudBounds.y >= layout.safeArea.top);
    assert.ok(layout.hudBounds.x >= layout.safeArea.left);
    assert.ok(right(layout.hudBounds) <= width - layout.safeArea.right + 1e-9);
    assert.ok(layout.boardBounds.y >= bottom(layout.hudBounds));
    assert.ok(bottom(layout.boardBounds) <= height - layout.safeArea.bottom + 1e-9);
    assert.equal(intersects(layout.hudBounds, layout.boardBounds), false);

    assert.equal(layout.foundations.length, 4);
    assert.ok(layout.stock.x >= layout.boardBounds.x);
    assert.ok(layout.stock.y >= layout.boardBounds.y);
    assert.ok(layout.stock.x + layout.cardWidth <= right(layout.boardBounds) + 1e-9);
    assert.ok(layout.foundations.every((point) => point.x >= layout.boardBounds.x));
    assert.ok(layout.foundations.every((point) => point.x + layout.cardWidth <= right(layout.boardBounds) + 1e-9));
    assert.equal(layout.tableauX.length, 7);
    assert.ok(layout.tableauX.every((x) => x >= layout.boardBounds.x));
    assert.ok(layout.tableauX.every((x) => x + layout.cardWidth <= right(layout.boardBounds) + 1e-9));
    assert.ok(layout.tableauY >= layout.wasteLaneBounds.y + layout.cardHeight);
    assert.ok(layout.wasteLaneBounds.x >= layout.stock.x + layout.cardWidth);
    assert.ok(right(layout.wasteLaneBounds) <= layout.foundations[0].x + 1e-9);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - CARD_ASPECT_RATIO) < 1e-9);
    assert.ok(layout.cardWidth <= MAX_CARD_WIDTH);
  });
}

test('phone-sized landscapes select compact profile and may shrink below old desktop floor', () => {
  const phone = calculateViewportLayout(844, 390);
  const desktop = calculateViewportLayout(1366, 768);

  assert.equal(phone.profile, 'compact-landscape');
  assert.ok(phone.cardWidth < STANDARD_MIN_CARD_WIDTH);
  assert.ok(phone.cardWidth >= 64);
  assert.equal(desktop.profile, 'standard');
  assert.ok(desktop.cardWidth >= STANDARD_MIN_CARD_WIDTH);
});

test('synthetic safe-area insets move the usable geometry inward', () => {
  const plain = calculateViewportLayout(932, 430);
  const inset = calculateViewportLayout(932, 430, {
    top: 12,
    right: 28,
    bottom: 10,
    left: 24,
  });

  assert.equal(inset.safeArea.left, 24);
  assert.equal(inset.safeArea.right, 28);
  assert.ok(inset.hudBounds.x > plain.hudBounds.x);
  assert.ok(inset.boardBounds.x > plain.boardBounds.x);
  assert.ok(right(inset.boardBounds) < right(plain.boardBounds));
});

test('wide screens keep tableau gaps bounded instead of stretching edge-to-edge', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1080], [3440, 1440]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.ok(layout.tableauColumnGap <= layout.cardWidth * 0.4 + 1e-9);
  }
});
