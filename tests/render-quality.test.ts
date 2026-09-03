import test from 'node:test';
import assert from 'node:assert/strict';

import { UI_TEXT_RESOLUTION } from '../src/game/view/RenderQuality.ts';

test('remaining canvas symbols keep 2x Phaser text textures', () => {
  assert.equal(UI_TEXT_RESOLUTION, 2);
});
