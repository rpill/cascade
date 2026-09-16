import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');

test('metrics card reserves bottom padding and gives more room to the info stack', () => {
  assert.match(hud, /const bottomPadding = 18 \* css/);
  assert.match(hud, /const artHeight = bounds\.height - infoHeight - 34 \* css/);
  assert.match(hud, /const contentBottom = bounds\.y \+ bounds\.height - bottomPadding/);
  assert.match(hud, /const contentHeight = Math\.max\(0, contentBottom - contentY\)/);
});
