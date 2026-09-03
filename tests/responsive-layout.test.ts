import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_ASPECT_RATIO,
  MAX_CARD_WIDTH,
  MIN_CARD_WIDTH,
  calculateLayoutMetrics,
} from '../src/game/view/LayoutMetrics.ts';

function rightEdge(x: number, width: number): number {
  return x + width;
}

for (const [width, height] of [
  [960, 640],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [2560, 1080],
] as const) {
  test(`${width}x${height} keeps every primary board zone inside the viewport`, () => {
    const layout = calculateLayoutMetrics(width, height);

    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.ok(layout.cardWidth >= MIN_CARD_WIDTH);
    assert.ok(layout.cardWidth <= MAX_CARD_WIDTH);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - CARD_ASPECT_RATIO) < 1e-9);

    assert.ok(layout.foundationX >= 0);
    assert.ok(layout.foundationY.every((y) => y >= 0 && y + layout.cardHeight <= height));
    assert.ok(layout.stock.x >= 0 && rightEdge(layout.stock.x, layout.cardWidth) <= width);
    assert.ok(layout.stock.y >= 0 && layout.stock.y + layout.cardHeight <= height);
    assert.ok(layout.waste.x >= 0 && rightEdge(layout.waste.x, layout.cardWidth) <= width);
    assert.equal(layout.tableauX.length, 7);
    assert.ok(layout.tableauX.every((x) => x >= 0 && rightEdge(x, layout.cardWidth) <= width));
    assert.ok(layout.tableauY >= 0 && layout.tableauY + layout.cardHeight <= height);
  });
}

test('ordinary larger desktops do not make cards smaller', () => {
  const base = calculateLayoutMetrics(1366, 768);
  const fullHd = calculateLayoutMetrics(1920, 1080);
  const qhd = calculateLayoutMetrics(2560, 1440);

  assert.ok(fullHd.cardWidth > base.cardWidth);
  assert.ok(qhd.cardWidth >= fullHd.cardWidth);
  assert.ok(qhd.cardWidth <= 216);
  assert.ok(qhd.cardHeight <= 302);
});

test('wide screens keep tableau columns compact instead of stretching across the viewport', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1080], [3440, 1440]] as const) {
    const layout = calculateLayoutMetrics(width, height);

    assert.ok(
      layout.tableauColumnGap <= layout.cardWidth * 0.4 + 1e-9,
      `${width}x${height} gap ${layout.tableauColumnGap} should stay compact for card width ${layout.cardWidth}`,
    );
  }
});

import { readFileSync } from 'node:fs';

const gameSceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

const mainSource = readFileSync(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

test('runtime resize keeps the camera at identity and relayouts the existing board', () => {
  assert.doesNotMatch(gameSceneSource, /ResponsiveViewport|calculateDesktopViewport/);
  assert.match(gameSceneSource, /setZoom\(1\)/);
  assert.match(gameSceneSource, /setScroll\(0,\s*0\)/);
  assert.match(gameSceneSource, /calculateLayoutMetrics\(width,\s*height\)/);
  assert.match(gameSceneSource, /this\.board\?\.relayout\(metrics\)/);
});

test('initial Phaser canvas dimensions come from the real viewport', () => {
  assert.match(mainSource, /width:\s*window\.innerWidth/);
  assert.match(mainSource, /height:\s*window\.innerHeight/);
  assert.doesNotMatch(mainSource, /GAME_WIDTH|GAME_HEIGHT/);
  assert.match(mainSource, /mode:\s*Phaser\.Scale\.RESIZE/);
});

test('ordinary widescreen keeps the utility rail at the edge while the tableau forms a compact group', () => {
  const layout = calculateLayoutMetrics(1920, 1080);
  const tableauRight = layout.tableauX.at(-1)! + layout.cardWidth;

  assert.ok(layout.foundationX <= layout.cardWidth * 0.35);
  assert.ok(layout.utilityDividerX < layout.viewportWidth * 0.2);
  assert.ok(layout.tableauColumnGap <= layout.cardWidth * 0.4 + 1e-9);
  assert.ok(tableauRight < layout.viewportWidth - layout.cardWidth * 0.5);
});
