import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');

test('gameplay HUD orders safe actions before separated Home', () => {
  const undo = source.indexOf("icon: 'undo'");
  const restart = source.indexOf("icon: 'restart'");
  const next = source.indexOf("icon: 'new-deal'");
  const home = source.indexOf("icon: 'home'");
  assert.ok(undo >= 0 && undo < restart && restart < next && next < home);
  assert.match(source, /game-control-home/);
});

test('Daily hides New Deal without hiding the other controls', () => {
  assert.match(source, /setDaily\(isDaily: boolean\)/);
  assert.match(source, /this\.newDealButton\.hidden = isDaily/);
});

test('gameplay HUD exposes the intended labels and keyboard hints', () => {
  assert.match(source, /Отменить ход · Z/);
  assert.match(source, /Начать заново · R/);
  assert.match(source, /Новая раздача · N/);
  assert.match(source, /На главную/);
});
