import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const boardSource = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

test('the scene uses a persistent main menu and N starts immediately', () => {
  assert.match(sceneSource, /MainMenuView/);
  assert.match(sceneSource, /startNewInCurrentMode\(\)/);
  assert.match(sceneSource, /openMainMenu\(\)/);
  assert.match(sceneSource, /playMenuMode\(mode: GameMode\)/);
  assert.doesNotMatch(sceneSource, /openNewGameMenu/);
});

test('board exposes separate menu, new game, undo, and restart controls', () => {
  assert.match(boardSource, /readonly mainMenu:\s*\(\) => void/);
  assert.match(boardSource, /В МЕНЮ/);
  assert.match(boardSource, /НОВАЯ ИГРА\s+N/);
  assert.match(boardSource, /ОТМЕНА\s+Z/);
  assert.match(boardSource, /РЕСТАРТ\s+R/);
});

test('Daily hides duplicate New Game and ignores the N shortcut', () => {
  assert.match(
    boardSource,
    /if \(this\.game\.mode !== 'daily'\)[\s\S]*НОВАЯ ИГРА\s+N/,
  );
  assert.match(
    sceneSource,
    /startNewDeal\(\): void {[\s\S]*currentDeal\?\.mode === 'daily'/,
  );
});

test('clicking a menu mode starts it immediately and there is no extra Play button', () => {
  const mainMenuPath = new URL('../src/game/view/MainMenuView.ts', import.meta.url);
  const oldMenuPath = new URL('../src/game/view/ModeMenuView.ts', import.meta.url);

  assert.equal(existsSync(mainMenuPath), true);
  assert.equal(existsSync(oldMenuPath), false);

  if (!existsSync(mainMenuPath)) {
    return;
  }

  const menuSource = readFileSync(mainMenuPath, 'utf8');
  assert.doesNotMatch(menuSource, /ИГРАТЬ/);
  assert.match(menuSource, /actions\.play\(mode\)/);
  assert.match(menuSource, /ЗАКРЫТЬ/);
  assert.match(menuSource, /canCancel/);
});

test('main menu exposes Standard Classic and Daily with weekly progress', () => {
  const menuSource = readFileSync(
    new URL('../src/game/view/MainMenuView.ts', import.meta.url),
    'utf8',
  );

  assert.match(menuSource, /СТАНДАРТ/);
  assert.match(menuSource, /КЛАССИКА/);
  assert.match(menuSource, /ИСПЫТАНИЕ ДНЯ/);
  assert.match(menuSource, /main-menu-weekly/);
  assert.match(menuSource, /main-menu-stats/);
  assert.match(menuSource, /ТАБЛИЦА ЛИДЕРОВ/);
  assert.match(menuSource, /bestTimeMs/);
  assert.doesNotMatch(menuSource, /ГАРАНТИРОВАННО РЕШАЕМЫЙ/);
});
