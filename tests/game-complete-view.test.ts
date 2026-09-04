import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/GameCompleteView.ts', import.meta.url),
  'utf8',
);

test('ordinary completion view shows mode time record stats and both actions', () => {
  assert.match(source, /ПОБЕДА/);
  assert.match(source, /winnable[^]*СТАНДАРТ/);
  assert.match(source, /original[^]*КЛАССИКА/);
  assert.match(source, /elapsedMs/);
  assert.match(source, /bestTimeMs/);
  assert.match(source, /Новый рекорд/);
  assert.match(source, /Победы:/);
  assert.match(source, /Math\.round\([^]*wins[^]*played[^]*100/);
  assert.match(source, /ЕЩЁ ПАРТИЯ/);
  assert.match(source, /actions\.newGame\(\)/);
  assert.match(source, /В МЕНЮ/);
  assert.match(source, /actions\.menu\(\)/);
});
