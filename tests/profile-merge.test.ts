import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import {
  mergeMetaProfiles, profileMergeReceiptKey, stageProfileMergeTransfer,
  readProfileMergeTransfer, clearProfileMergeTransfer, shouldPreserveActiveGameForProfileMerge,
} from '../src/meta/ProfileMerge.ts';

function makeState(mutator: (state: MetaSave) => void): MetaSave {
  const state = structuredClone(createDefaultMetaSave());
  mutator(state);
  return state;
}

test('guest profile merge unions new mastery product data and is idempotent by scope', () => {
  const cloud = makeState((state) => {
    state.progression.coins = 120;
    state.standard.completed.easy = ['11'];
    state.standard.masteryCreditedSeeds = ['11'];
    state.claimedRewardKeys = ['cloud'];
    state.futurePrestige.mediumSeeds = ['21'];
    state.mastery = { rank: 'player', stage: { anyWins: 0, mediumWins: 5, hardWins: 1, onTimeDailyWins: 0 } };
  });
  const guest = makeState((state) => {
    state.progression.coins = 75;
    state.standard.selectedDifficulty = 'hard';
    state.standard.completed.hard = ['22'];
    state.standard.masteryCreditedSeeds = ['22'];
    state.claimedRewardKeys = ['guest'];
    state.futurePrestige.hardSeeds = ['22'];
    state.mastery = { rank: 'player', stage: { anyWins: 0, mediumWins: 3, hardWins: 2, onTimeDailyWins: 0 } };
  });
  const merged = mergeMetaProfiles(cloud, guest, 'guest-42');
  assert.equal(merged.progression.coins, 195);
  assert.equal(merged.standard.selectedDifficulty, 'hard');
  assert.deepEqual(merged.standard.completed.easy, ['11']);
  assert.deepEqual(merged.standard.completed.hard, ['22']);
  assert.deepEqual(merged.standard.masteryCreditedSeeds, ['11', '22']);
  assert.equal(merged.mastery.rank, 'player');
  assert.equal(merged.mastery.stage.mediumWins, 5);
  assert.equal(merged.mastery.stage.hardWins, 2);
  assert.deepEqual(new Set(merged.claimedRewardKeys), new Set(['cloud', 'guest']));
  assert.equal(merged.progression.receipts[profileMergeReceiptKey('guest-42')], 1);
  assert.deepEqual(mergeMetaProfiles(merged, guest, 'guest-42'), merged);
});

interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void }
test('pending profile transfer survives reload with the new schema', () => {
  const map = new Map<string,string>();
  const storage: StorageLike = { getItem:k=>map.get(k)??null, setItem:(k,v)=>{map.set(k,v)}, removeItem:k=>{map.delete(k)} };
  const guest = makeState((state)=>{state.progression.coins=77; state.mastery.stage.anyWins=2;});
  assert.equal(stageProfileMergeTransfer('guest', guest, storage), true);
  assert.equal(readProfileMergeTransfer(storage)?.state.progression.coins, 77);
  assert.equal(readProfileMergeTransfer(storage)?.state.mastery.stage.anyWins, 2);
  clearProfileMergeTransfer(storage);
  assert.equal(readProfileMergeTransfer(storage), null);
});

test('active game preservation decision remains independent of profile schema', () => {
  const transfer = { sourceScope:'guest', state:createDefaultMetaSave() };
  assert.equal(shouldPreserveActiveGameForProfileMerge('guest', true, transfer), true);
  assert.equal(shouldPreserveActiveGameForProfileMerge('guest', false, transfer), false);
  assert.equal(shouldPreserveActiveGameForProfileMerge('other', true, transfer), false);
});
