import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('ordinary and Daily completion use the shared Trifold-style Phaser win overlay', () => {
  assert.equal(existsSync('src/ui/win/WinOverlay.ts'), true);
  const ordinary=readFileSync('src/game/view/GameCompleteView.ts','utf8');
  const daily=readFileSync('src/game/view/DailyCompleteView.ts','utf8');
  for (const source of [ordinary,daily]) {
    assert.match(source,/WinOverlay/);
    assert.doesNotMatch(source,/document\.createElement/);
    assert.match(source,/layout\(layout:ViewportLayout\)/);
  }
});

test('GameScene relayouts completion overlays with the table viewport', () => {
  const source=readFileSync('src/game/scenes/GameScene.ts','utf8');
  assert.match(source,/gameCompleteView\?\.layout\(layout\)/);
  assert.match(source,/dailyCompleteView\?\.layout\(layout\)/);
});
