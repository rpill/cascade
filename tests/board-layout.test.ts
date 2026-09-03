import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_HEIGHT,
  GAME_HEIGHT,
  getBoardSlots,
  tableauCardY,
} from '../src/game/view/layout.ts';

test('tableau begins higher and long columns remain visible', () => {
  assert.equal(tableauCardY(1, 0), 236);
  assert.ok(tableauCardY(20, 19) + CARD_HEIGHT <= GAME_HEIGHT - 18);
});

test('static board slots omit the waste placeholder', () => {
  const slots = getBoardSlots();

  assert.equal(slots.filter((slot) => slot.kind === 'foundation').length, 4);
  assert.equal(slots.filter((slot) => slot.kind === 'stock').length, 1);
  assert.equal(slots.filter((slot) => slot.kind === 'tableau').length, 7);
  assert.equal(slots.some((slot) => String(slot.kind) === 'waste'), false);
});
