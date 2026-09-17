import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');

test('metrics card keeps equal vertical insets and centers the compact info stack', () => {
  assert.match(hud, /const topInset = 18 \* css/);
  assert.match(hud, /const bottomInset = 18 \* css/);
  assert.match(hud, /const contentHeight = Math\.max\(0, bounds\.height - topInset - bottomInset\)/);
  assert.match(hud, /Math\.max\(0, \(contentHeight - stackHeight\) \/ 2\)/);
});
