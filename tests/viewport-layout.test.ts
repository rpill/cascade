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
  [844, 390], [915, 412], [932, 430], [992, 472],
  [1024, 576], [960, 540], [960, 640],
  [1366, 768], [1728, 864], [1920, 1080], [2560, 1440],
  [2560, 1080], [3440, 1440],
] as const;

function right(bounds: LayoutBounds): number {
  return bounds.x + bounds.width;
}

function bottom(bounds: LayoutBounds): number {
  return bounds.y + bounds.height;
}

function centerX(bounds: LayoutBounds): number {
  return bounds.x + bounds.width / 2;
}

function intersects(left: LayoutBounds, rightBounds: LayoutBounds): boolean {
  return left.x < right(rightBounds)
    && right(left) > rightBounds.x
    && left.y < bottom(rightBounds)
    && bottom(left) > rightBounds.y;
}

for (const [width, height] of VIEWPORTS) {
  test(`${width}x${height} keeps one centered vertical-foundation composition inside the board`, () => {
    const layout = calculateViewportLayout(width, height);
    const boardRight = right(layout.boardBounds);
    const boardBottom = bottom(layout.boardBounds);

    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.ok(layout.boardBounds.y >= bottom(layout.hudBounds));
    assert.equal(intersects(layout.hudBounds, layout.boardBounds), false);

    assert.equal(layout.foundations.length, 4);
    assert.ok(layout.foundations.every((point) => Math.abs(point.x - layout.foundations[0].x) < 1e-9));
    for (let index = 1; index < layout.foundations.length; index += 1) {
      assert.ok(layout.foundations[index].y >= layout.foundations[index - 1].y + layout.cardHeight);
    }
    assert.ok(layout.foundations[0].y >= layout.boardBounds.y - 1e-9);
    assert.ok(layout.foundations.at(-1)!.y + layout.cardHeight <= boardBottom + 1e-9);

    assert.ok(Math.abs(centerX(layout.compositionBounds) - centerX(layout.boardBounds)) < 1e-9);
    assert.ok(layout.compositionBounds.x >= layout.boardBounds.x - 1e-9);
    assert.ok(right(layout.compositionBounds) <= boardRight + 1e-9);
    assert.ok(layout.foundationRailBounds.x === layout.compositionBounds.x);
    assert.ok(layout.mainPlayBounds.x >= right(layout.foundationRailBounds));
    assert.ok(right(layout.mainPlayBounds) <= right(layout.compositionBounds) + 1e-9);

    assert.ok(layout.stock.x >= layout.mainPlayBounds.x - 1e-9);
    assert.ok(layout.stock.x + layout.cardWidth <= right(layout.mainPlayBounds) + 1e-9);
    assert.ok(layout.wasteLaneBounds.x >= layout.stock.x + layout.cardWidth);
    assert.ok(right(layout.wasteLaneBounds) <= right(layout.mainPlayBounds) + 1e-9);

    assert.equal(layout.tableauX.length, 7);
    assert.ok(layout.tableauX.every((x) => x >= layout.mainPlayBounds.x - 1e-9));
    assert.ok(layout.tableauX.every((x) => x + layout.cardWidth <= right(layout.mainPlayBounds) + 1e-9));
    assert.ok(layout.tableauY >= layout.stock.y + layout.cardHeight);

    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - CARD_ASPECT_RATIO) < 1e-9);
    assert.ok(layout.cardWidth <= MAX_CARD_WIDTH);
  });
}

test('phone-sized landscape keeps all card zones at one compact card size', () => {
  const phone = calculateViewportLayout(844, 390);
  const desktop = calculateViewportLayout(1366, 768);

  assert.equal(phone.profile, 'compact-landscape');
  assert.ok(phone.cardWidth < STANDARD_MIN_CARD_WIDTH);
  assert.ok(phone.cardWidth >= 50);
  assert.equal(desktop.profile, 'standard');
  assert.ok(desktop.cardWidth >= STANDARD_MIN_CARD_WIDTH);

  const foundation = phone.foundations[0];
  assert.equal(phone.foundationRailBounds.width, phone.cardWidth);
  assert.equal(phone.foundationRailBounds.x, foundation.x);
  assert.equal(phone.wasteLaneBounds.height, phone.cardHeight);
});

test('synthetic safe-area insets move the centered composition inward', () => {
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
  assert.ok(inset.compositionBounds.x > plain.compositionBounds.x);
});

test('wide screens keep tableau gaps bounded instead of stretching edge-to-edge', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1080], [3440, 1440]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.ok(layout.tableauColumnGap <= layout.cardWidth * 0.4 + 1e-9);
  }
});


test('compact landscape reserves side rails for controls and increases card size after removing the top HUD bar', () => {
  const phone = calculateViewportLayout(844, 390);
  assert.equal(phone.profile, 'compact-landscape');
  assert.ok(phone.boardBounds.x <= 16);
  assert.ok(right(phone.boardBounds) <= 692);
  assert.ok(phone.hudBounds.height <= 12);
  assert.ok(phone.cardWidth >= 63);
});


test('compact landscape nearly fills the board height with the foundation rail while preserving slim outer margins', () => {
  const phone = calculateViewportLayout(844, 390);
  assert.ok(phone.foundationRailBounds.y - phone.boardBounds.y <= 1e-9);
  assert.ok(bottom(phone.boardBounds) - bottom(phone.foundationRailBounds) <= 1e-9);
  assert.ok(phone.boardBounds.y >= 10);
  assert.ok(phone.viewportHeight - bottom(phone.boardBounds) >= 8);
});


test('compact landscape exposes a finger-friendly tableau gap before overflow compression', () => {
  for (const [width, height] of [[844, 390], [915, 412], [932, 430], [992, 472]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.equal(layout.profile, 'compact-landscape');
    assert.ok(layout.tableauCardGap >= 18, `${width}x${height}: ${layout.tableauCardGap}`);
    assert.ok(layout.tableauCardGap <= 28, `${width}x${height}: ${layout.tableauCardGap}`);
  }
});
