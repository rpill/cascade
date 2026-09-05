import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { getBoardSlots, tableauCardY, wasteCardX } from '../src/game/view/layout.ts';

for (const [width, height] of [[844, 390], [960, 540], [1366, 768], [1920, 1080]] as const) {
  test(`${width}x${height} keeps a 20-card tableau pile inside board bounds`, () => {
    const layout = calculateViewportLayout(width, height);
    const boardBottom = layout.boardBounds.y + layout.boardBounds.height;

    assert.ok(
      tableauCardY(layout, 20, 19) + layout.cardHeight
        <= boardBottom - layout.bottomMargin + 1e-9,
    );
  });

  test(`${width}x${height} keeps every waste position inside the bounded lane`, () => {
    const layout = calculateViewportLayout(width, height);
    const laneRight = layout.wasteLaneBounds.x + layout.wasteLaneBounds.width;

    for (let count = 1; count <= 24; count += 1) {
      for (let index = 0; index < count; index += 1) {
        const x = wasteCardX(layout, count, index);
        assert.ok(x >= layout.wasteLaneBounds.x - 1e-9);
        assert.ok(x + layout.cardWidth <= laneRight + 1e-9);
      }
    }
  });
}

test('board slots expose four vertical foundations, one stock, and seven tableau slots', () => {
  const layout = calculateViewportLayout(1920, 1080);
  const slots = getBoardSlots(layout);
  const foundations = slots.filter((slot) => slot.kind === 'foundation');

  assert.equal(foundations.length, 4);
  assert.deepEqual(foundations.map(({ x, y }) => ({ x, y })), layout.foundations);
  assert.ok(foundations.every((slot) => slot.x === foundations[0].x));
  assert.ok(foundations[1].y > foundations[0].y);
  assert.equal(slots.filter((slot) => slot.kind === 'stock').length, 1);
  assert.equal(slots.filter((slot) => slot.kind === 'tableau').length, 7);
  assert.equal(slots.some((slot) => String(slot.kind) === 'waste'), false);
});
