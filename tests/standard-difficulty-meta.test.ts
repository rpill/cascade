import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

test('selected Standard difficulty is explicit product state', () => {
  let state=createDefaultMetaSave();
  assert.equal(state.standard.selectedDifficulty,'easy');
  state=applyMetaOperation(state,{kind:'set-standard-difficulty',difficulty:'hard'});
  assert.equal(state.standard.selectedDifficulty,'hard');
});

test('standard-served remembers the newest 256 unique positive uint32 seeds without adaptive tiers', () => {
  let state=createDefaultMetaSave();
  for(let seed=1;seed<=300;seed+=1){state=applyMetaOperation(state,{kind:'standard-served',seed:String(seed),partition:'easy',difficulty:'easy'});}
  assert.equal(state.standard.recentSeeds.length,256);
  assert.equal(state.standard.recentSeeds[0],'45');
  assert.equal(state.standard.recentSeeds.at(-1),'300');
  state=applyMetaOperation(state,{kind:'standard-served',seed:'100',partition:'medium',difficulty:'medium'});
  assert.equal(state.standard.recentSeeds.at(-1),'100');
  assert.equal(new Set(state.standard.recentSeeds).size,256);
});

test('replacing an unfinished Standard resets only win streak, not selected difficulty', () => {
  let state=createDefaultMetaSave();
  state={...state,standard:{...state.standard,selectedDifficulty:'hard'},standardWinStreak:{current:4,best:7}};
  state=applyMetaOperation(state,{kind:'standard-failed',attemptId:'unfinished'});
  assert.deepEqual(state.standardWinStreak,{current:0,best:7});
  assert.equal(state.standard.selectedDifficulty,'hard');
});
