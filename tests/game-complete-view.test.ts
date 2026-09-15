import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game/view/GameCompleteView.ts', import.meta.url), 'utf8');

test('ordinary completion is a Trifold-style Phaser WinOverlay and celebrates once per attempt', () => {
  assert.match(source, /new WinOverlay/);
  assert.match(source, /completionId/);
  assert.match(source, /lastCelebratedCompletionId/);
  assert.match(source, /actions\.sound\?\.\('victory'\)/);
  assert.match(source, /primaryActionLabel:t\('НОВАЯ РАЗДАЧА'\)/);
  assert.match(source, /secondaryActionLabel:t\('В МЕНЮ'\)/);
  assert.doesNotMatch(source, /document\.createElement/);
});
