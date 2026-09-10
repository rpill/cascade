import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/GameCompleteView.ts', import.meta.url),
  'utf8',
);

test('ordinary completion view celebrates the win without loading the player with statistics', () => {
  assert.match(source, /ПОБЕДА/);
  assert.match(source, /winnable[^]*СТАНДАРТ/);
  assert.match(source, /original[^]*КЛАССИКА/);
  assert.match(source, /elapsedMs/);
  assert.match(source, /Новый рекорд/);
  assert.doesNotMatch(source, /Победы:/);
  assert.doesNotMatch(source, /winRate/);
  assert.doesNotMatch(source, /Лучшее:/);
  assert.match(source, /game-complete-xp-track/);
  assert.match(source, /game-complete-level-reward/);
  assert.match(source, /createVictoryProgressSequence/);
  assert.match(source, /ЕЩЁ ПАРТИЯ/);
  assert.match(source, /В МЕНЮ/);
});


test('ordinary completion celebrates each completed attempt only once across reward refreshes', () => {
  assert.match(source, /completionId:\s*string/);
  assert.match(source, /currentCompletionId/);
  assert.match(source, /isNewCompletion/);
  assert.match(source, /if \(isNewCompletion\)[^]*sound\?\.\('victory'\)/);
  assert.match(source, /if \(isNewCompletion[^]*createVictoryProgressSequence/);
});
