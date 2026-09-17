import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/main.ts','utf8');
const scene = readFileSync('src/game/scenes/GameScene.ts','utf8');
const bridge = readFileSync('src/ui/bridge/CascadeProductBridge.ts','utf8');

const productScenes = ['HomeScene','DailyScene','MasteryScene','LeaderboardsScene','SettingsScene','HowToPlayScene'];

test('Phaser registers the full product shell alongside gameplay', () => {
  for (const name of productScenes) assert.match(main,new RegExp(name));
  assert.match(main,/scene:\s*\[BootScene, GameScene, HomeScene, DailyScene, MasteryScene, LeaderboardsScene, SettingsScene, HowToPlayScene\]/);
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

test('bridge exposes gameplay, leaderboard and settings actions but does not own screen routing', () => {
  for (const token of ['startDaily', 'leaderboardSnapshot', 'loadLeaderboard', 'authorizeLeaderboard', 'settingsSnapshot', 'setSoundEnabled', 'setLanguage']) {
    assert.match(bridge,new RegExp(token));
  }
  assert.doesNotMatch(bridge,/themesSnapshot|buyTheme|equipTheme|rewardedCoins|coins/);
  for (const legacyRoute of ['openDaily','openLeaderboards','openHowToPlay','openSettings']) {
    assert.doesNotMatch(bridge,new RegExp(legacyRoute));
  }
});
