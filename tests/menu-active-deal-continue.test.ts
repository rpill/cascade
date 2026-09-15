import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getContinuableMenuMode } from '../src/game/model/MenuPlayAction.ts';
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const homeVm=readFileSync(new URL('../src/ui/home/HomeViewModel.ts',import.meta.url),'utf8');

test('only an unfinished deal paused in the menu is resumable',()=>{
  assert.equal(getContinuableMenuMode('menu-required',null,false),null);assert.equal(getContinuableMenuMode('playing','winnable',false),null);assert.equal(getContinuableMenuMode('menu-paused','winnable',false),'winnable');assert.equal(getContinuableMenuMode('menu-paused','daily',false),'daily');assert.equal(getContinuableMenuMode('menu-paused','winnable',true),null);
});

test('new Home represents an active paused deal as Continue and resumes it through the bridge',()=>{
  assert.match(scene,/activeMode: this\.gameState !== null[\s\S]*this\.flow\.state === 'menu-paused'/);
  assert.match(scene,/resumeGame: \(\) => this\.closeMainMenu\(\)/);
  assert.match(homeVm,/hasActiveGame/);assert.match(homeVm,/hasActiveGame \? 'ПРОДОЛЖИТЬ' : 'ИГРАТЬ'/);
});
