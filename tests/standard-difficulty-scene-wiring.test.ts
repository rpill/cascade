import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
function method(name:string):string{let start=scene.indexOf(`private ${name}`);if(start===-1)start=scene.indexOf(`private async ${name}`);assert.notEqual(start,-1,`missing ${name}`);const next=scene.indexOf('\n  private ',start+1);return scene.slice(start,next===-1?scene.length:next);}

test('GameScene picks Standard from the player-selected difficulty and records the exact served partition',()=>{
  const select=method('selectStandardDeal');
  assert.match(select,/requestedDifficulty: this\.metaState\.standard\.selectedDifficulty/);
  assert.match(select,/completedByPartition: this\.metaState\.standard\.completed/);
  assert.doesNotMatch(scene,/StandardDifficultyDirector/);
  const start=method('startSelectedMode');
  assert.match(start,/kind:'standard-served'/);
  assert.match(start,/partition:selection\.partition/);
  assert.match(start,/difficulty:selection\.difficulty/);
});

test('New Deal may reset the Standard win streak but never changes the explicit selected difficulty',()=>{
  const fresh=method('requestFreshDeal');
  assert.match(fresh,/recordStandardFailureIfReplacing/);
  assert.doesNotMatch(fresh,/failureStreak|lastServedTier|StandardDifficultyDirector/);
  const setter=method('setStandardDifficulty');
  assert.match(setter,/kind: 'set-standard-difficulty'/);
});
