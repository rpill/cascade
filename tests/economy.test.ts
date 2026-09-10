import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createDefaultMetaSave, normalizeMetaSave } from '../src/meta/MetaSave.ts';

const moduleUrl = new URL('../src/meta/MetaOperations.ts', import.meta.url);
test('economy supports persistent completion, purchases and level progression', async () => {
  assert.ok(existsSync(moduleUrl), 'meta operation domain exists');
  const { applyMetaOperation } = await import(moduleUrl.href);
  let state = createDefaultMetaSave();
  for (let i = 0; i < 6; i++) {
    const attemptId = `game-${i}`;
    state = applyMetaOperation(state, {kind:'begin', mode:'winnable', attemptId});
    state = applyMetaOperation(state, {kind:'complete', mode:'winnable', attemptId, elapsedMs:10000, trustedDay:null, trustedWeek:null});
  }
  assert.equal(state.progression.totalXp, 600);
  assert.equal(state.progression.coins, 300);
  assert.equal(state.stats.winnable.wins, 6);
  const repeat = applyMetaOperation(state, {kind:'complete', mode:'winnable', attemptId:'game-5', elapsedMs:10000, trustedDay:null, trustedWeek:null});
  assert.deepEqual(repeat, state);
  const bought = applyMetaOperation(state, {kind:'purchase',themeId:'navy_study'});
  assert.equal(bought.progression.coins, 0);
  assert.ok(bought.collection.ownedThemes.includes('navy_study'));
  assert.deepEqual(applyMetaOperation(bought, {kind:'purchase',themeId:'navy_study'}), bought);
  assert.deepEqual(applyMetaOperation(bought, {kind:'purchase',themeId:'burgundy_club'}), bought);
  assert.deepEqual(applyMetaOperation(bought, {kind:'purchase',themeId:'green_felt_club'}), bought);
  assert.deepEqual(applyMetaOperation(bought, {kind:'equip',themeId:'burgundy_club'}), bought);
  assert.equal(applyMetaOperation(bought, {kind:'equip',themeId:'navy_study'}).equipped.theme, 'navy_study');
});

test('V2 selected theme is grandfathered, balances start at zero and invalid V3 balances normalize', () => {
  const state = normalizeMetaSave({version:2, equipped:{theme:'navy_study'}});
  assert.equal(state.version, 5);
  assert.ok(state.collection.ownedThemes.includes('navy_study'));
  assert.ok(state.collection.ownedThemes.includes('walnut_study'));
  assert.equal(state.progression.coins, 0);
  const invalid = normalizeMetaSave({version:3, progression:{coins:-1,totalXp:Infinity},equipped:{theme:'burgundy_club'}});
  assert.equal(invalid.progression.coins, 0);
  assert.equal(invalid.progression.totalXp, 0);
  assert.equal(invalid.equipped.theme, 'walnut_study');
});

test('Daily first completion stacks trusted bonus once and weekly milestones only once', async () => {
  assert.ok(existsSync(moduleUrl), 'meta operation domain exists');
  const { applyMetaOperation } = await import(moduleUrl.href);
  let state = createDefaultMetaSave();
  for (let day = 7; day <= 9; day++) {
    const dailyId = `2026-09-0${day}`;
    const common = {mode:'daily',attemptId:dailyId,dailyId,weekId:'2026-W37'};
    state = applyMetaOperation(state,{kind:'begin',...common});
    state = applyMetaOperation(state,{kind:'complete',...common,elapsedMs:10000,trustedDay:dailyId,trustedWeek:'2026-W37'});
  }
  assert.deepEqual(state.weekly.claimedMilestones, [3]);
  assert.equal(state.progression.totalXp, 600);
  assert.equal(state.progression.coins, 540); // 225 Daily + 90 first win + 150 levels + 75 week
  const before = state.progression;
  state = applyMetaOperation(state,{kind:'begin',mode:'daily',attemptId:'repeat',dailyId:'2026-09-09',weekId:'2026-W37'});
  state = applyMetaOperation(state,{kind:'complete',mode:'daily',attemptId:'repeat',dailyId:'2026-09-09',weekId:'2026-W37',elapsedMs:9000,trustedDay:'2026-09-10',trustedWeek:'2026-W37'});
  assert.equal(state.progression.coins,before.coins);
  assert.equal(state.progression.totalXp,before.totalXp);
  assert.equal(state.daily.records['2026-09-09'].bestTimeMs,9000);
});

test('level thresholds and multiple crossings produce deterministic progress', async () => {
  const url = new URL('../src/meta/Progression.ts', import.meta.url);
  assert.ok(existsSync(url), 'level progression exists');
  const {getLevelProgress} = await import(url.href);
  assert.deepEqual(getLevelProgress(0),{level:1,xpIntoLevel:0,xpForNextLevel:100});
  assert.deepEqual(getLevelProgress(250),{level:3,xpIntoLevel:0,xpForNextLevel:200});
  assert.deepEqual(getLevelProgress(600),{level:4,xpIntoLevel:150,xpForNextLevel:250});
});

test('sequence-backed attempts remain deduplicated after the recent attempt cache expires', async () => {
  const {applyMetaOperation} = await import('../src/meta/MetaOperations.ts');
  let state = createDefaultMetaSave();
  for (let sequence = 1; sequence <= 130; sequence++) {
    const attemptId = `browser-stream~${sequence}`;
    state = applyMetaOperation(state,{kind:'begin',mode:'winnable',attemptId});
    state = applyMetaOperation(state,{kind:'complete',mode:'winnable',attemptId,elapsedMs:1000,trustedDay:null,trustedWeek:null});
  }
  state = normalizeMetaSave(JSON.parse(JSON.stringify(state)));
  const repeated = applyMetaOperation(state,{kind:'complete',mode:'winnable',attemptId:'browser-stream~1',elapsedMs:1000,trustedDay:null,trustedWeek:null});
  assert.deepEqual(repeated,state);
});

test('malformed persisted week does not block future Daily progress', async () => {
  const {applyMetaOperation} = await import('../src/meta/MetaOperations.ts');
  let state = normalizeMetaSave({version:3,weekly:{weekId:'broken'}});
  state = applyMetaOperation(state,{kind:'begin',mode:'daily',attemptId:'new-day',dailyId:'2026-09-08',weekId:'2026-W37'});
  state = applyMetaOperation(state,{kind:'complete',mode:'daily',attemptId:'new-day',dailyId:'2026-09-08',weekId:'2026-W37',elapsedMs:1000,trustedDay:null,trustedWeek:null});
  assert.equal(state.weekly.weekId,'2026-W37');
  assert.deepEqual(state.weekly.completedDailyIds,['2026-09-08']);
});

test('Classic uses its own rewards and untrusted clocks grant no calendar bonuses', async () => {
  const {applyMetaOperation} = await import('../src/meta/MetaOperations.ts');
  let state = applyMetaOperation(createDefaultMetaSave(),{kind:'begin',mode:'original',attemptId:'classic'});
  state = applyMetaOperation(state,{kind:'complete',mode:'original',attemptId:'classic',elapsedMs:1000,trustedDay:null,trustedWeek:null});
  assert.equal(state.progression.totalXp,120);
  assert.equal(state.progression.coins,80);
  assert.equal(state.progression.lastWinDay,'');
  assert.equal(state.stats.winnable.wins,0);
});

test('weekly milestones at five and seven are each paid once', async () => {
  const {applyMetaOperation} = await import('../src/meta/MetaOperations.ts');
  let state = createDefaultMetaSave();
  for (let day = 7; day <= 13; day++) {
    const dailyId=`2026-09-${String(day).padStart(2,'0')}`;
    state = applyMetaOperation(state,{kind:'begin',mode:'daily',attemptId:dailyId,dailyId,weekId:'2026-W37'});
    state = applyMetaOperation(state,{kind:'complete',mode:'daily',attemptId:dailyId,dailyId,weekId:'2026-W37',elapsedMs:1000,trustedDay:dailyId,trustedWeek:'2026-W37'});
  }
  assert.deepEqual(state.weekly.claimedMilestones,[3,5,7]);
  assert.equal(state.progression.totalXp,1400);
  assert.equal(state.progression.coins,1510); // 525 Daily + 210 day + 300 levels + 475 week
});

test('an older Daily completion cannot roll the active week backwards', async () => {
  const {applyMetaOperation} = await import('../src/meta/MetaOperations.ts');
  let state=createDefaultMetaSave();
  state.weekly={weekId:'2026-W38',completedDailyIds:['2026-09-14'],claimedMilestones:[]};
  state=applyMetaOperation(state,{kind:'complete',mode:'daily',attemptId:'older',dailyId:'2026-09-13',weekId:'2026-W37',elapsedMs:1000,trustedDay:'2026-09-14',trustedWeek:'2026-W38'});
  assert.equal(state.weekly.weekId,'2026-W38');
  assert.deepEqual(state.weekly.completedDailyIds,['2026-09-14']);
});

test('an award crossing several levels pays every level reward', async () => {
  const {awardLines}=await import('../src/meta/Economy.ts');
  const result=awardLines(createDefaultMetaSave(),[{label:'Test award',xp:700,coins:0}]);
  assert.equal(result.reward.level,5);
  assert.equal(result.reward.coins,200);
});
