import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getContinuableMenuMode } from '../src/game/model/MenuPlayAction.ts';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const playSource = readFileSync(
  new URL('../src/game/view/PlayPageView.ts', import.meta.url),
  'utf8',
);
const englishSource = readFileSync(
  new URL('../src/localization/English.ts', import.meta.url),
  'utf8',
);

test('only an unfinished deal paused in the menu is resumable', () => {
  assert.equal(getContinuableMenuMode('menu-required', null, false), null);
  assert.equal(getContinuableMenuMode('playing', 'winnable', false), null);
  assert.equal(getContinuableMenuMode('menu-paused', 'winnable', false), 'winnable');
  assert.equal(getContinuableMenuMode('menu-paused', 'daily', false), 'daily');
  assert.equal(getContinuableMenuMode('menu-paused', 'winnable', true), null);
  assert.equal(getContinuableMenuMode('menu-paused', 'daily', true), null);
});

test('menu Play continues the matching unfinished deal instead of replacing it', () => {
  assert.match(sceneSource, /getContinuableMenuMode/);
  assert.match(
    sceneSource,
    /if \(mode === this\.getContinuableMenuMode\(\)\) \{\s*this\.closeMainMenu\(\);\s*return;\s*\}/,
  );
  assert.match(sceneSource, /this\.playPage\.setContinueMode\(this\.getContinuableMenuMode\(\)\)/);
});

test('the active mode card is labeled Continue in both languages', () => {
  assert.match(playSource, /setContinueMode\(mode: GameMode \| null\)/);
  assert.match(playSource, /t\(mode === this\.continueMode \? 'ПРОДОЛЖИТЬ' : 'ИГРАТЬ'\)/);
  assert.match(englishSource, /'ПРОДОЛЖИТЬ': 'CONTINUE'/);
});
