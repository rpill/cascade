import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { getDailyStreaks } from '../src/meta/DailyStreak.ts';
import type { CloudSnapshot } from '../src/cloud/CloudSnapshot.ts';
import { mergeCloudSnapshots } from '../src/cloud/CloudMerge.ts';
import { createOriginalDeal } from '../src/game/model/deal.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';
import { createActiveGameSave } from '../src/persistence/ActiveGameSave.ts';

function snapshot(mutate?: (meta: MetaSave) => void): CloudSnapshot {
  const meta = createDefaultMetaSave();
  mutate?.(meta);
  return { schemaVersion: 1, meta };
}

function active(updatedAtMs: number): CloudSnapshot['activeGame'] {
  const seed = BigInt(updatedAtMs + 1);
  const save = createActiveGameSave({
    mode: 'winnable', seed,
    snapshot: new SolitaireGame(createOriginalDeal(seed, 'winnable')).snapshot(),
    attemptStarted: true, elapsedMs: 1000, moveCount: 3,
    standard: { partition: 'easy', difficulty: 'easy' }, uiState: 'playing',
  });
  return { save, updatedAtMs };
}

test('replaying identical BASE LOCAL CLOUD does not inflate counters', () => {
  const base = snapshot((m) => { m.stats.winnable.played = 20; m.stats.winnable.wins = 20; });
  const once = mergeCloudSnapshots({ base, local: base, cloud: base, todayId: '2026-09-20' });
  const twice = mergeCloudSnapshots({ base: once, local: once, cloud: once, todayId: '2026-09-20' });
  assert.equal(once.meta.stats.winnable.wins, 20);
  assert.deepEqual(twice, once);
});

test('two devices adding three and two wins from base twenty converge to twenty five', () => {
  const base = snapshot((m) => { m.stats.winnable.played = 20; m.stats.winnable.wins = 20; });
  const local = structuredClone(base); local.meta.stats.winnable.played = 23; local.meta.stats.winnable.wins = 23;
  const cloud = structuredClone(base); cloud.meta.stats.winnable.played = 22; cloud.meta.stats.winnable.wins = 22;
  const merged = mergeCloudSnapshots({ base, local, cloud, todayId: '2026-09-20' });
  assert.equal(merged.meta.stats.winnable.played, 25);
  assert.equal(merged.meta.stats.winnable.wins, 25);
});

test('completed Standard seeds and mastery credited seeds are set unions', () => {
  const local = snapshot((m) => { m.standard.completed.easy = ['1']; m.standard.masteryCreditedSeeds = ['1']; });
  const cloud = snapshot((m) => { m.standard.completed.easy = ['2']; m.standard.masteryCreditedSeeds = ['2']; });
  const merged = mergeCloudSnapshots({ base: null, local, cloud, todayId: '2026-09-20' });
  assert.deepEqual(new Set(merged.meta.standard.completed.easy), new Set(['1','2']));
  assert.deepEqual(new Set(merged.meta.standard.masteryCreditedSeeds), new Set(['1','2']));
});

test('Daily records union dates and keep lower best time', () => {
  const local = snapshot((m) => { m.daily.records['2026-09-19'] = { completed:true, completedOnTime:true, attempts:1, bestTimeMs:5000 }; });
  const cloud = snapshot((m) => { m.daily.records['2026-09-20'] = { completed:true, completedOnTime:true, attempts:1, bestTimeMs:4000 }; m.daily.records['2026-09-19'] = { completed:true, completedOnTime:true, attempts:1, bestTimeMs:4500 }; });
  const merged = mergeCloudSnapshots({ base:null, local, cloud, todayId:'2026-09-20' });
  assert.equal(merged.meta.daily.records['2026-09-19']?.bestTimeMs, 4500);
  assert.equal(merged.meta.daily.records['2026-09-20']?.completed, true);
});

test('Daily ranking pair uses lower moves then lower time for personal best fields without replacing cloud official attempt identity', () => {
  const local = snapshot((m) => { m.daily.records['2026-09-20'] = { completed:true, completedOnTime:true, attempts:2, bestMoves:90, bestMovesTimeMs:6000, rankingAttemptId:'local' }; });
  const cloud = snapshot((m) => { m.daily.records['2026-09-20'] = { completed:true, completedOnTime:true, attempts:1, bestMoves:95, bestMovesTimeMs:5000, rankingAttemptId:'cloud-official' }; });
  const merged = mergeCloudSnapshots({ base:null, local, cloud, todayId:'2026-09-20' });
  const record = merged.meta.daily.records['2026-09-20']!;
  assert.equal(record.bestMoves, 90);
  assert.equal(record.bestMovesTimeMs, 6000);
  assert.equal(record.rankingAttemptId, 'cloud-official');
});

test('Daily attempts use base-relative delta after the first synchronized base', () => {
  const base = snapshot((m) => { m.daily.records['2026-09-20']={completed:false,completedOnTime:false,attempts:4}; });
  const local = structuredClone(base); local.meta.daily.records['2026-09-20']!.attempts=6;
  const cloud = structuredClone(base); cloud.meta.daily.records['2026-09-20']!.attempts=5;
  const merged=mergeCloudSnapshots({base,local,cloud,todayId:'2026-09-20'});
  assert.equal(merged.meta.daily.records['2026-09-20']!.attempts,7);
});

test('weekly same-week ids and milestones union while newer week wins the active shell', () => {
  const sameLocal=snapshot((m)=>{m.weekly={weekId:'2026-W38',completedDailyIds:['2026-09-17'],claimedMilestones:[3]};});
  const sameCloud=snapshot((m)=>{m.weekly={weekId:'2026-W38',completedDailyIds:['2026-09-18'],claimedMilestones:[5]};});
  const same=mergeCloudSnapshots({base:null,local:sameLocal,cloud:sameCloud,todayId:'2026-09-20'});
  assert.deepEqual(new Set(same.meta.weekly.completedDailyIds),new Set(['2026-09-17','2026-09-18']));
  assert.deepEqual(new Set(same.meta.weekly.claimedMilestones),new Set([3,5]));
  const newer=snapshot((m)=>{m.weekly={weekId:'2026-W39',completedDailyIds:['2026-09-21'],claimedMilestones:[]};});
  const chosen=mergeCloudSnapshots({base:null,local:sameLocal,cloud:newer,todayId:'2026-09-21'});
  assert.equal(chosen.meta.weekly.weekId,'2026-W39');
  assert.deepEqual(chosen.meta.weekly.completedDailyIds,['2026-09-21']);
});

test('current Daily streak is recomputed from merged on-time history for supplied todayId', () => {
  const local=snapshot((m)=>{m.daily.records['2026-09-19']={completed:true,completedOnTime:true,attempts:1};});
  const cloud=snapshot((m)=>{m.daily.records['2026-09-20']={completed:true,completedOnTime:true,attempts:1};});
  const merged=mergeCloudSnapshots({base:null,local,cloud,todayId:'2026-09-20'});
  assert.deepEqual(getDailyStreaks(merged.meta.daily.records,'2026-09-20'),{current:2,best:2});
});

test('active game chooses greater updatedAtMs and validates checkpoint', () => {
  const local={...snapshot(),activeGame:active(10)};
  const cloud={...snapshot(),activeGame:active(20)};
  const merged=mergeCloudSnapshots({base:null,local,cloud,todayId:'2026-09-20'});
  assert.equal(merged.activeGame?.updatedAtMs,20);
});

test('language and sound never appear because they are outside CloudSnapshot', () => {
  const merged=mergeCloudSnapshots({base:null,local:snapshot(),cloud:snapshot(),todayId:'2026-09-20'});
  assert.equal('language' in (merged as unknown as Record<string,unknown>),false);
  assert.equal('sound' in (merged as unknown as Record<string,unknown>),false);
});
