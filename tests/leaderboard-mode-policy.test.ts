import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { getDailyStreaks } from '../src/meta/DailyStreak.ts';

function complete(attemptId:string,seed:string){return {kind:'complete' as const,attemptId,mode:'winnable' as const,elapsedMs:1000,moves:20,trustedDay:null,trustedWeek:null,standardSeed:seed,standardPartition:'easy' as const,standardDifficulty:'easy' as const};}

test('Daily current streak survives until the end of an unfinished current day', () => {
  const records = {
    '2026-09-14': { completedOnTime: true },
    '2026-09-15': { completedOnTime: true },
  };
  assert.deepEqual(getDailyStreaks(records, '2026-09-16'), { current: 2, best: 2 });
  assert.deepEqual(getDailyStreaks({ ...records, '2026-09-16': { completedOnTime: true } }, '2026-09-16'), { current: 3, best: 3 });
});

test('Standard win streak remains a product stat backing the Standard leaderboard', () => {
  let state=createDefaultMetaSave();
  state=applyMetaOperation(state,{kind:'begin',attemptId:'s~1',mode:'winnable'});state=applyMetaOperation(state,complete('s~1','101'));
  state=applyMetaOperation(state,{kind:'begin',attemptId:'s~2',mode:'winnable'});state=applyMetaOperation(state,complete('s~2','102'));
  assert.equal(state.standardWinStreak.current,2);assert.equal(state.standardWinStreak.best,2);
  state=applyMetaOperation(state,{kind:'standard-failed',attemptId:'s~3'});
  assert.equal(state.standardWinStreak.current,0);assert.equal(state.standardWinStreak.best,2);
});
