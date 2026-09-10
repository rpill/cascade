import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);
const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);
const playSource = readFileSync(
  new URL('../src/game/view/PlayPageView.ts', import.meta.url),
  'utf8',
);

test('the scene uses one persistent app shell and N still starts immediately', () => {
  assert.match(sceneSource, /AppShellView/);
  assert.match(sceneSource, /PlayPageView/);
  assert.doesNotMatch(sceneSource, /MainMenuView/);
  assert.match(sceneSource, /startNewInCurrentMode\(\)/);
  assert.match(sceneSource, /openMainMenu\(\)/);
  assert.match(sceneSource, /playMenuMode\(mode: GameMode\)/);
});

test('gameplay HUD exposes separate undo restart new-deal and Home controls outside BoardView', () => {
  assert.match(controlsSource, /icon: 'undo'/);
  assert.match(controlsSource, /icon: 'restart'/);
  assert.match(controlsSource, /icon: 'new-deal'/);
  assert.match(controlsSource, /icon: 'home'/);
  assert.match(sceneSource, /new GameControlsView\(this/);
});

test('Daily hides duplicate New Deal and ignores the N shortcut', () => {
  assert.match(controlsSource, /this\.newDealButton\.hidden = isDaily/);
  assert.match(controlsSource, /this\.setDaily\(mode === 'daily'\)/);
  assert.match(sceneSource, /gameControls\.setMode\(gameState\.mode\)/);
  assert.match(
    sceneSource,
    /startNewDeal\(\): void \{[\s\S]*currentDeal\.mode === 'daily'/,
  );
});

test('old MainMenuView is removed and mode cards start their selected mode immediately', () => {
  const oldMainMenuPath = new URL('../src/game/view/MainMenuView.ts', import.meta.url);
  assert.equal(existsSync(oldMainMenuPath), false);
  assert.match(playSource, /actions\.play\(mode\)/);
  assert.match(playSource, /ИГРАТЬ/);
  assert.match(shellSource, /К игре/);
  assert.doesNotMatch(shellSource, /ЗАКРЫТЬ/);
});

test('Play destination exposes balanced Standard Daily Classic cards and player progress', () => {
  assert.match(playSource, /СТАНДАРТ/);
  assert.match(playSource, /ИСПЫТАНИЕ ДНЯ/);
  assert.match(playSource, /КЛАССИКА/);
  assert.match(playSource, /main-shell-mode-grid/);
  assert.match(playSource, /main-shell-player-progress/);
  assert.match(playSource, /updateProgression/);
  assert.doesNotMatch(playSource, /WEEKLY_MILESTONES|НЕДЕЛЯ \$\{|Пн|Вт|Ср|Чт|Пт|Сб|Вс/);
});
