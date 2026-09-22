import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLeaderboardRead, handleLeaderboardSubmit } from '../server/cascade-api/leaderboards.ts';
import type { CascadeStore, DailyResultInput, StoredLeaderboardPage, VerifiedPlayerIdentity } from '../server/cascade-api/store.ts';
import type { BridgeClaims } from '../server/cascade-api/session.ts';
import { CLOUD_SNAPSHOT_VERSION } from '../src/cloud/CloudSnapshot.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { lifetimeMasteryPoints } from '../src/leaderboards/LeaderboardConfig.ts';

const claims: BridgeClaims = { pikabuId:'pk-123', name:'Verified Name', avatar:'https://img.example/me.png', issuedAt:1, expiresAt:2 };
class FakeStore implements CascadeStore {
  calls:Array<{name:string;args:unknown[]}>=[]; profile:string|null=null; page:StoredLeaderboardPage={entries:[],playerEntry:null}; dailyStatus:'published'|'replay'='published';
  async upsertPlayer(_i:VerifiedPlayerIdentity,_n:number){} async readProfile(id:string){this.calls.push({name:'readProfile',args:[id]});return this.profile;} async writeProfile(_i:string,_s:string,_n:number){}
  async submitStandard(id:string,v:number,n:number){this.calls.push({name:'submitStandard',args:[id,v,n]});} async readStandard(l:number,id?:string){this.calls.push({name:'readStandard',args:[l,id]});return this.page;}
  async submitDaily(id:string,r:DailyResultInput){this.calls.push({name:'submitDaily',args:[id,r]});return this.dailyStatus;} async readDaily(d:string,l:number,id?:string){this.calls.push({name:'readDaily',args:[d,l,id]});return this.page;}
  async submitDailyStreak(id:string,c:number,b:number,n:number){this.calls.push({name:'submitDailyStreak',args:[id,c,b,n]});} async readDailyStreak(l:number,id?:string){this.calls.push({name:'readDailyStreak',args:[l,id]});return this.page;}
  async submitMastery(id:string,r:number,p:number,n:number){this.calls.push({name:'submitMastery',args:[id,r,p,n]});} async readMastery(l:number,id?:string){this.calls.push({name:'readMastery',args:[l,id]});return this.page;}
}
async function json(r:Response):Promise<any>{return await r.json();}
function post(body:unknown){return new Request('https://x/v1/leaderboards/test',{method:'POST',body:JSON.stringify(body)});}
function op(kind:string,fields:Record<string,unknown>){return{operationId:'11111111-1111-4111-8111-111111111111',kind,...fields};}
function calls(s:FakeStore,name:string){return s.calls.filter(c=>c.name===name).map(c=>c.args);}

test('public board reads delegate to typed store methods', async()=>{
  const cases=[['standard','https://x/v1/leaderboards/standard?limit=12','readStandard',[12,undefined]],['daily','https://x/v1/leaderboards/daily?limit=12&scope=2026-09-20','readDaily',['2026-09-20',12,undefined]],['daily-streak','https://x/v1/leaderboards/daily-streak?limit=12','readDailyStreak',[12,undefined]],['mastery','https://x/v1/leaderboards/mastery?limit=12','readMastery',[12,undefined]]] as const;
  for(const [board,url,name,args] of cases){const s=new FakeStore();await handleLeaderboardRead(board,new URL(url),null,s);assert.deepEqual(calls(s,name),[args]);}
});
test('authorized read passes Pikabu id for player entry lookup', async()=>{const s=new FakeStore();s.page={entries:[{rank:1,playerId:'top',publicName:'Top',metric:{bestStreak:9}}],playerEntry:{rank:44,playerId:'pk-123',publicName:'Me',metric:{bestStreak:5}}};const result=await json(await handleLeaderboardRead('standard',new URL('https://x/v1/leaderboards/standard'),claims,s));assert.deepEqual(calls(s,'readStandard'),[[20,'pk-123']]);assert.equal(result.playerEntry.rank,44);});
test('standard submit uses validated bestStreak',async()=>{const s=new FakeStore();const now=new Date('2026-09-20T12:00:00Z');await handleLeaderboardSubmit('standard',post(op('standard',{bestStreak:14,score:999})),claims,s,now);assert.deepEqual(calls(s,'submitStandard'),[['pk-123',14,now.getTime()]]);});
test('Daily submit delegates immutable result and returns store replay status',async()=>{const s=new FakeStore();s.dailyStatus='replay';const now=new Date('2026-09-20T12:00:00Z');const result=await json(await handleLeaderboardSubmit('daily',post(op('daily',{dailyId:'2026-09-20',moves:44,elapsedMs:90000,completedOnTime:true,attemptId:'attempt-A'})),claims,s,now));assert.equal(result.status,'replay');assert.deepEqual(calls(s,'submitDaily'),[['pk-123',{dailyId:'2026-09-20',attemptId:'attempt-A',moves:44,elapsedMs:90000,completedOnTime:true,completedAt:now.getTime()}]]);});
test('daily-streak submit derives current and best from stored cloud profile',async()=>{const s=new FakeStore();const meta=createDefaultMetaSave();meta.daily.records['2026-09-18']={completedOnTime:true} as any;meta.daily.records['2026-09-19']={completedOnTime:true} as any;s.profile=JSON.stringify({schemaVersion:CLOUD_SNAPSHOT_VERSION,meta});const now=new Date('2026-09-20T12:00:00Z');await handleLeaderboardSubmit('daily-streak',post(op('streak',{todayId:'2026-09-20'})),claims,s,now);assert.deepEqual(calls(s,'submitDailyStreak'),[['pk-123',2,2,now.getTime()]]);});
test('mastery submit derives ordinal and lifetime points',async()=>{const s=new FakeStore();const meta=createDefaultMetaSave();meta.mastery.rank='expert';meta.standard.completed.medium=['1','2'];const profile=meta;const now=new Date('2026-09-20T12:00:00Z');await handleLeaderboardSubmit('mastery',post(op('mastery',{profile})),claims,s,now);assert.deepEqual(calls(s,'submitMastery'),[['pk-123',4,lifetimeMasteryPoints(meta),now.getTime()]]);});
test('mastery read converts numeric store metric to product rank string',async()=>{const s=new FakeStore();s.page={entries:[{rank:1,playerId:'m',publicName:'M',metric:{masteryRank:6,masteryPoints:321}}],playerEntry:null};const result=await json(await handleLeaderboardRead('mastery',new URL('https://x/v1/leaderboards/mastery'),null,s));assert.deepEqual(result.entries[0].metric,{rank:'grandmaster',points:321});});
