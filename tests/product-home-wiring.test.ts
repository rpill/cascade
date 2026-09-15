import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/main.ts','utf8');
const scene = readFileSync('src/game/scenes/GameScene.ts','utf8');
const bridge = readFileSync('src/ui/bridge/CascadeProductBridge.ts','utf8');

const productScenes = ['HomeScene','DailyScene','MasteryScene','ThemesScene','LeaderboardsScene','SettingsScene','HowToPlayScene'];

test('Phaser registers the full Trifold-style product shell alongside gameplay', () => {
  for (const name of productScenes) assert.match(main,new RegExp(name));
  assert.match(main,/scene:\s*\[BootScene, GameScene, HomeScene, DailyScene, MasteryScene, ThemesScene, LeaderboardsScene, SettingsScene, HowToPlayScene\]/);
});

test('GameScene installs a Cascade product bridge and uses HomeScene as the main product hub', () => {
  assert.match(scene,/productBridge\.install/);
  assert.match(scene,/private showProductHome/);
  assert.match(scene,/this\.scene\.launch\('HomeScene'\)/);
  const openStart=scene.indexOf('private openMainMenu');
  const openEnd=scene.indexOf('\n  private ',openStart+1);
  const open=scene.slice(openStart,openEnd);
  assert.match(open,/showProductHome/);
  assert.doesNotMatch(open,/showShellPlay/);
});

test('bridge exposes product state and gameplay actions but does not own screen routing', () => {
  for (const token of ['startDaily', 'themesSnapshot', 'buyTheme', 'equipTheme', 'leaderboardSnapshot', 'loadLeaderboard', 'authorizeLeaderboard', 'settingsSnapshot', 'setSoundEnabled', 'setLanguage']) {
    assert.match(bridge,new RegExp(token));
  }
  for (const legacyRoute of ['openDaily','openThemes','openLeaderboards','openHowToPlay','openSettings']) {
    assert.doesNotMatch(bridge,new RegExp(legacyRoute));
  }
});
