import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleLeaderboardRead, handleLeaderboardSubmit, type BackendLeaderboardDb, type PublicDailyRow, type PublicDailyStreakRow, type PublicLeaderboardRow } from '../supabase/functions/cascade-api/leaderboards.ts';
import type { VerifiedPikabuPlayer } from '../supabase/functions/cascade-api/auth.ts';

const player: VerifiedPikabuPlayer={id:'p1',name:'Player 1',isAuthorized:true};
const standardRows: PublicLeaderboardRow[]=[
  {accountId:'a2',playerId:'p2',publicName:'Two',primaryValue:12,updatedAt:'2026-09-20T10:00:00Z',context:{}},
  {accountId:'a1',playerId:'p1',publicName:'One',primaryValue:10,updatedAt:'2026-09-20T10:01:00Z',context:{}},
];
const dailyRows: PublicDailyRow[]=[
  {accountId:'a3',playerId:'p3',publicName:'Three',dailyId:'2026-09-20',moves:90,elapsedMs:6000,completedOnTime:true,completedAt:'2026-09-20T10:02:00Z'},
  {accountId:'a2',playerId:'p2',publicName:'Two',dailyId:'2026-09-20',moves:90,elapsedMs:5000,completedOnTime:true,completedAt:'2026-09-20T10:03:00Z'},
  {accountId:'a1',playerId:'p1',publicName:'One',dailyId:'2026-09-20',moves:90,elapsedMs:5000,completedOnTime:true,completedAt:'2026-09-20T10:01:00Z'},
];

class FakeDb implements BackendLeaderboardDb {
  readonly calls:string[]=[];
  standard=standardRows;
  daily=dailyRows;
  streaks:PublicDailyStreakRow[]=[];
  mastery:PublicLeaderboardRow[]=[];
  async resolveAccount(){this.calls.push('resolve');return 'a1';}
  async listStandard(){this.calls.push('listStandard');return this.standard;}
  async listDaily(scope:string){this.calls.push(`listDaily:${scope}`);return this.daily.filter((r)=>r.dailyId===scope);}
  async listDailyStreak(todayId:string,accountId?:string){this.calls.push(`streak:${todayId}:${accountId ?? 'all'}`);return this.streaks.filter((row)=>accountId===undefined||row.accountId===accountId);}
  async listMastery(){this.calls.push('mastery');return this.mastery;}
  async submitDaily(){this.calls.push('submitDaily');return {status:'accepted'} as Record<string,unknown>;}
  async upsertLeaderboard(){this.calls.push('upsert');return {status:'saved'} as Record<string,unknown>;}
}

async function body(response:Response){return await response.json() as any;}

test('guest can read standard top rows without Authorization', async () => {
  const db=new FakeDb();
  const result=await body(await handleLeaderboardRead('standard',new URL('https://x/v1/leaderboards/standard?limit=20'),null,db));
  assert.equal(result.entries.length,2);
  assert.deepEqual(result.entries[0].metric,{bestStreak:12});
  assert.equal(result.playerEntry,null);
  assert.equal(db.calls.includes('resolve'),false);
});

test('daily read requires valid YYYY-MM-DD scope', async () => {
  const db=new FakeDb();
  await assert.rejects(()=>handleLeaderboardRead('daily',new URL('https://x/v1/leaderboards/daily?scope=bad'),null,db),/Daily/i);
  assert.equal(db.calls.length,0);
});

test('daily ranks fewer moves before lower elapsed time before accepted time', async () => {
  const db=new FakeDb();
  const result=await body(await handleLeaderboardRead('daily',new URL('https://x/v1/leaderboards/daily?scope=2026-09-20'),null,db));
  assert.deepEqual(result.entries.map((e:any)=>e.playerId),['p1','p2','p3']);
  assert.deepEqual(result.entries.map((e:any)=>e.rank),[1,2,3]);
});

test('daily-streak read uses precomputed server rows without loading global Daily history', async () => {
  const db=new FakeDb();
  db.streaks=[
    {accountId:'a1',playerId:'p1',publicName:'One',current:3,best:5},
    {accountId:'a2',playerId:'p2',publicName:'Two',current:1,best:8},
  ];
  const result=await body(await handleLeaderboardRead('daily-streak',new URL('https://x/v1/leaderboards/daily-streak?today=2026-09-20'),null,db));
  assert.deepEqual(result.entries.map((entry:any)=>entry.metric),[{current:3,best:5},{current:1,best:8}]);
  assert.deepEqual(db.calls,['streak:2026-09-20:all']);
});

test('production DB leaderboard reads do not perform one identity request per row', () => {
  const source=readFileSync('supabase/functions/cascade-api/db.ts','utf8');
  assert.doesNotMatch(source,/identityForAccount/);
  assert.match(source,/cascade_public_leaderboard_entries/);
  assert.match(source,/cascade_public_daily_results/);
  assert.match(source,/cascade_daily_streak_board/);
});

test('mastery read derives points from normalized profile facts on submit', async () => {
  const db=new FakeDb();
  const profile:any={version:9,standard:{completed:{onboarding:['1'],easy:['2'],medium:['3'],hard:['4']}},futurePrestige:{onTimeDailyDates:['2026-09-20']},mastery:{rank:'player'}};
  const request=new Request('https://x/v1/leaderboards/mastery/submit',{method:'POST',body:JSON.stringify({operationId:'11111111-1111-4111-8111-111111111111',kind:'mastery',profile})});
  await handleLeaderboardSubmit('mastery',request,player,db,new Date('2026-09-20T12:00:00Z'));
  assert.equal(db.calls.includes('upsert'),true);
});

test('unknown board is rejected before DB access', async () => {
  const db=new FakeDb();
  await assert.rejects(()=>handleLeaderboardRead('hax',new URL('https://x/v1/leaderboards/hax'),null,db),/Unsupported/);
  assert.equal(db.calls.length,0);
});

test('write without verified authorized identity returns 401', async () => {
  const db=new FakeDb();
  const request=new Request('https://x/v1/leaderboards/standard/submit',{method:'POST',body:JSON.stringify({})});
  await assert.rejects(()=>handleLeaderboardSubmit('standard',request,null,db),/authorized/i);
  assert.equal(db.calls.length,0);
});
