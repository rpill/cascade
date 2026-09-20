import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendClient, BackendHttpError } from '../src/backend/BackendClient.ts';
import { BackendLeaderboards } from '../src/backend/BackendLeaderboards.ts';
import { CloudSyncStateStore } from '../src/cloud/CloudSyncState.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { decodeDailyLeaderboardScore, decodeDailyStreakLeaderboardScore, decodeMasteryLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import type { BackendIdentityProvider, BrowserStorageLike } from '../src/platform/services.ts';

class MemoryStorage implements BrowserStorageLike {
  values = new Map<string,string>();
  getItem(key:string){ return this.values.get(key) ?? null; }
  setItem(key:string,value:string){ this.values.set(key,value); }
}
const identity: BackendIdentityProvider = {
  isAuthorized: () => true,
  localIdentityKey: () => 'p1',
  getAssertion: async () => ({ provider: 'pikabu', value: 'signed-token' }),
};
const guest: BackendIdentityProvider = {
  isAuthorized: () => false,
  localIdentityKey: () => null,
  getAssertion: async () => null,
};
function response(body: unknown, status=200){ return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json'}}); }
function create(fetchImpl: typeof fetch, id=identity, storage=new MemoryStorage()) {
  const client = new BackendClient('https://api.example', id, fetchImpl, 1_000);
  return { storage, boards: new BackendLeaderboards({ client, identity:id, stateStoreFactory:(provider,key)=>new CloudSyncStateStore(provider,key,storage), nowDateId:()=> '2026-09-20' }) };
}

test('guest top-list read omits Authorization and maps rows to PlatformLeaderboardEntry', async()=>{
  let authorization:string|null='unset';
  const fetchImpl:typeof fetch=async(_input,init)=>{authorization=new Headers(init?.headers).get('authorization');return response({entries:[{rank:1,playerId:'a',publicName:'Ada',metric:{bestStreak:8}}],playerEntry:null});};
  const {boards}=create(fetchImpl,guest);
  const rows=await boards.getEntries('standardwinstreak',{quantityTop:20});
  assert.equal(authorization,null);assert.deepEqual(rows,[{rank:1,score:8,playerId:'a',publicName:'Ada'}]);
});


test('authorized top-list read stays public and does not require a signed assertion', async()=>{
  let fetchCalls=0; let assertionCalls=0; let authorization:string|null='unset';
  const flakyIdentity: BackendIdentityProvider = {
    isAuthorized: () => true,
    localIdentityKey: () => 'p1',
    getAssertion: async () => { assertionCalls += 1; throw new Error('signed data unavailable'); },
  };
  const fetchImpl:typeof fetch=async(_input,init)=>{
    fetchCalls += 1;
    authorization = new Headers(init?.headers).get('authorization');
    return response({entries:[{rank:1,playerId:'a',publicName:'Ada',metric:{bestStreak:8}}],playerEntry:null});
  };
  const {boards}=create(fetchImpl,flakyIdentity);
  const rows=await boards.getEntries('standardwinstreak',{quantityTop:20});
  assert.equal(fetchCalls,1);
  assert.equal(assertionCalls,0);
  assert.equal(authorization,null);
  assert.equal(rows[0]?.score,8);
});

test('Daily read forwards scope date and encodes metric for existing Daily decoder', async()=>{
  let url='';
  const fetchImpl:typeof fetch=async(input)=>{url=String(input);return response({entries:[{rank:2,playerId:'b',publicName:'Bee',metric:{dailyId:'2026-09-20',moves:41,elapsedMs:80000}}],playerEntry:null});};
  const {boards}=create(fetchImpl);
  const [row]=await boards.getEntries('dailyfastest',{quantityTop:20,scopeKey:'2026-09-20'});
  assert.match(url,/scope=2026-09-20/);assert.deepEqual(decodeDailyLeaderboardScore(row!.score),{dailyId:'2026-09-20',moves:41,elapsedMs:80000});
});

test('getEntries stays public while getPlayerEntry uses a separate authenticated read', async()=>{
  let calls=0; const authorizations:(string|null)[]=[];
  const fetchImpl:typeof fetch=async(_input,init)=>{
    calls++;
    authorizations.push(new Headers(init?.headers).get('authorization'));
    return response(calls === 1
      ? {entries:[],playerEntry:null}
      : {entries:[],playerEntry:{rank:7,playerId:'me',publicName:'Me',metric:{bestStreak:4}}});
  };
  const {boards}=create(fetchImpl);
  await boards.getEntries('standardwinstreak',{quantityTop:20});
  const me=await boards.getPlayerEntry('standardwinstreak');
  assert.equal(calls,2);
  assert.deepEqual(authorizations,[null,'Bearer signed-token']);
  assert.equal(me?.score,4);
});

test('standard submission posts structured bestStreak not opaque score', async()=>{
  let body:any;
  const fetchImpl:typeof fetch=async(_input,init)=>{body=JSON.parse(String(init?.body));return response({status:'saved'});};
  const {boards}=create(fetchImpl);
  await boards.setScore('standardwinstreak',999,{kind:'standard',bestStreak:12});
  assert.equal(body.kind,'standard');assert.equal(body.bestStreak,12);assert.equal('score' in body,false);assert.match(body.operationId,/^[0-9a-f-]{36}$/i);
});

test('Daily submission posts official context and stable operationId', async()=>{
  const bodies:any[]=[];let fail=true;
  const fetchImpl:typeof fetch=async(_input,init)=>{const body=JSON.parse(String(init?.body));bodies.push(body);if(fail){fail=false;throw new Error('offline');}return response({status:'saved'});};
  const storage=new MemoryStorage();const {boards}=create(fetchImpl,identity,storage);
  await assert.rejects(boards.setScore('dailyfastest',123,{kind:'daily',dailyId:'2026-09-20',moves:44,elapsedMs:90000,completedOnTime:true,attemptId:'abc'}));
  await boards.retryPending();
  assert.equal(bodies.length,2);assert.equal(bodies[0].operationId,bodies[1].operationId);assert.deepEqual({...bodies[1],operationId:'x'},{operationId:'x',kind:'daily',dailyId:'2026-09-20',moves:44,elapsedMs:90000,completedOnTime:true,attemptId:'abc'});
});

test('streak submission asks server to derive streak instead of trusting encoded scalar', async()=>{
  let body:any;const fetchImpl:typeof fetch=async(_i,init)=>{body=JSON.parse(String(init?.body));return response({status:'derived',metric:{current:2,best:5}});};
  const {boards}=create(fetchImpl);await boards.setScore('dailystreak',999999,{kind:'streak',todayId:'2026-09-20'});
  assert.deepEqual(Object.keys(body).sort(),['kind','operationId','todayId']);assert.equal(body.kind,'streak');
});

test('mastery submission sends normalized profile context and read encoding remains decodable', async()=>{
  const profile=createDefaultMetaSave();profile.mastery.rank='expert';profile.standard.completed.medium=['1','2'];let body:any;
  const fetchImpl:typeof fetch=async(_input,init)=>{if((init?.method??'GET')==='POST'){body=JSON.parse(String(init?.body));return response({status:'saved'});}return response({entries:[{rank:1,playerId:'a',publicName:'Ada',metric:{rank:'expert',points:4}}],playerEntry:null});};
  const {boards}=create(fetchImpl);await boards.setScore('cascademastery',1,{kind:'mastery',profile});assert.equal(body.kind,'mastery');assert.equal(body.profile.mastery.rank,'expert');
  const [row]=await boards.getEntries('cascademastery',{quantityTop:20});assert.deepEqual(decodeMasteryLeaderboardScore(row!.score),{rank:'expert',points:4});
});

test('4xx validation failure removes persistent pending mutation', async()=>{
  const storage=new MemoryStorage();const fetchImpl:typeof fetch=async()=>response({error:'bad'},400);const {boards}=create(fetchImpl,identity,storage);
  await assert.rejects(boards.setScore('standardwinstreak',5,{kind:'standard',bestStreak:5}),BackendHttpError);
  assert.equal(new CloudSyncStateStore('pikabu','p1',storage).load().pendingLeaderboards.length,0);
});

test('streak backend metric maps to existing decoder', async()=>{
  const fetchImpl:typeof fetch=async()=>response({entries:[{rank:1,playerId:'a',publicName:'Ada',metric:{current:3,best:8}}],playerEntry:null});
  const {boards}=create(fetchImpl);const [row]=await boards.getEntries('dailystreak',{quantityTop:20,scopeKey:'2026-09-20'});assert.deepEqual(decodeDailyStreakLeaderboardScore(row!.score),{current:3,best:8});
});
