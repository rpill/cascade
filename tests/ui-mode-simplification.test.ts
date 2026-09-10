import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const play = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const statistics = readFileSync(new URL('../src/game/view/StatisticsPageView.ts', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');
const completion = readFileSync(new URL('../src/game/view/GameCompleteView.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('player-facing play page exposes only Game and Daily', () => {
  assert.match(play, /createModeCard\('winnable',[\s\S]*?'ИГРА'/);
  assert.match(play, /createModeCard\('daily'/);
  assert.doesNotMatch(play, /createModeCard\('original'/);
  assert.doesNotMatch(play, /КЛАССИКА|СТАНДАРТ/);
  assert.match(styles, /\.main-shell-mode-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
});

test('statistics exposes Game and Daily tabs only', () => {
  assert.match(statistics, /createModeTab\('ИГРА', 'winnable'\)/);
  assert.match(statistics, /createModeTab\('ЕЖЕДНЕВНЫЕ', 'daily'\)/);
  assert.doesNotMatch(statistics, /createModeTab\('КЛАССИКА'/);
  assert.doesNotMatch(statistics, /createModeTab\('СТАНДАРТ'/);
});

test('ordinary gameplay and ordinary victory do not display a mode label', () => {
  assert.match(controls, /this\.modeLabel\.hidden\s*=\s*mode\s*!==\s*'daily'/);
  assert.doesNotMatch(controls, /winnable:\s*'СТАНДАРТ'|original:\s*'КЛАССИКА'/);
  assert.doesNotMatch(completion, /game-complete-mode|getModeLabel|СТАНДАРТ|КЛАССИКА/);
});
