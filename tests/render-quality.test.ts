import test from 'node:test';
import assert from 'node:assert/strict';

import { UI_TEXT_RESOLUTION } from '../src/game/view/RenderQuality.ts';

test('Phaser text uses a 2x internal texture for crisp UI labels', () => {
  assert.equal(UI_TEXT_RESOLUTION, 2);
});
