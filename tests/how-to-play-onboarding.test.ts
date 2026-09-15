import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sceneSource=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const how=readFileSync(new URL('../src/ui/scenes/HowToPlayScene.ts',import.meta.url),'utf8');

test('first launch finishes initial Standard deal before opening the Trifold HowToPlay scene',()=>{
  assert.match(sceneSource,/const firstRun = !preferences\.howToPlaySeen/);
  assert.match(sceneSource,/startFirstRunHowToPlay\(\)/);
  assert.match(sceneSource,/private pendingFirstRunHowToPlay = false/);
  assert.match(sceneSource,/this\.pendingFirstRunHowToPlay = true;[\s\S]*this\.startDeal\(deal\)/);
  assert.match(sceneSource,/if \(this\.pendingFirstRunHowToPlay\)[\s\S]*this\.openProductHowToPlay\(true\)/);
  assert.match(sceneSource,/preferences\.markHowToPlaySeen\(\)/);
});

test('How to Play is a reusable Phaser product scene with paper panel and responsive actions',()=>{
  assert.match(how,/extends BaseUiScene/);
  assert.match(how,/PaperPanel/);
  assert.match(how,/ActionCard/);
  assert.match(how,/bindResponsiveLayout/);
  assert.doesNotMatch(how,/document\.createElement/);
});
