import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const how=readFileSync(new URL('../src/ui/scenes/HowToPlayScene.ts',import.meta.url),'utf8');

test('new players see the dealt board before the product How to Play scene opens over it',()=>{
  assert.match(scene,/startFirstRunHowToPlay\(\)/);
  assert.match(scene,/this\.pendingFirstRunHowToPlay = true/);
  assert.match(scene,/if \(this\.pendingFirstRunHowToPlay\)[\s\S]*this\.openProductHowToPlay\(true\)/);
});

test('How to Play reuses the Trifold scene layout and returns correctly for onboarding or Home',()=>{
  assert.match(how,/init\(/);
  assert.match(how,/onboarding/);
  assert.match(how,/returnToGame/);
  assert.match(how,/productBridge\.closeHowToPlay/);
  assert.match(how,/scene\.start\('HomeScene'\)/);
});
