import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGetProfile, handlePutProfile } from '../server/cascade-api/profile.ts';
import { createCascadeHandler } from '../server/cascade-api/handler.ts';
import { signBridgeSession } from '../server/cascade-api/session.ts';
import type { CascadeStore, DailyResultInput, StoredLeaderboardPage, VerifiedPlayerIdentity } from '../server/cascade-api/store.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { CloudSnapshot } from '../src/cloud/CloudSnapshot.ts';
import { HttpError } from '../server/cascade-api/http.ts';

function snap(wins=0):CloudSnapshot { const meta=createDefaultMetaSave(); meta.stats.winnable.played=wins; meta.stats.winnable.wins=wins; return {schemaVersion:1,meta}; }
class FakeStore implements CascadeStore {
  profile: string | null = null;
  writes: Array<{ id: string; serialized: string; nowMs: number }> = [];
  readProfileError: Error | null = null;
  async upsertPlayer(_identity: VerifiedPlayerIdentity, _nowMs: number): Promise<void> {}
  async readProfile(_id:string){ if (this.readProfileError) throw this.readProfileError; return this.profile; }
  async writeProfile(id:string,serialized:string,nowMs:number){ this.writes.push({id,serialized,nowMs}); this.profile=serialized; }
  async submitStandard(_id:string,_v:number,_n:number){} async readStandard(_l:number,_i?:string):Promise<StoredLeaderboardPage>{return{entries:[],playerEntry:null};}
  async submitDaily(_id:string,_r:DailyResultInput){return 'published' as const;} async readDaily(_d:string,_l:number,_i?:string):Promise<StoredLeaderboardPage>{return{entries:[],playerEntry:null};}
  async submitDailyStreak(_id:string,_c:number,_b:number,_n:number){} async readDailyStreak(_l:number,_i?:string):Promise<StoredLeaderboardPage>{return{entries:[],playerEntry:null};}
  async submitMastery(_id:string,_r:number,_p:number,_n:number){} async readMastery(_l:number,_i?:string):Promise<StoredLeaderboardPage>{return{entries:[],playerEntry:null};}
}
async function body(response:Response){return JSON.parse(await response.text());}
function put(base:CloudSnapshot|null,profile:CloudSnapshot){return new Request('https://x.test/v1/profile',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({base,profile})});}

test('GET returns null for empty stored profile', async()=>{const store=new FakeStore();assert.deepEqual(await body(await handleGetProfile('pikabu-42',store)),{profile:null});});
test('GET parses and normalizes a valid stored profile', async()=>{const store=new FakeStore();store.profile=JSON.stringify(snap(3));assert.equal((await body(await handleGetProfile('pikabu-42',store))).profile.meta.stats.winnable.wins,3);});
test('malformed stored profile returns provider-neutral 502 without stored payload', async () => {
  const store = new FakeStore(); store.profile = '{not-json';
  await assert.rejects(async () => handleGetProfile('pikabu-42', store), (error: unknown) => error instanceof HttpError && error.status === 502 && error.message === 'Stored cloud profile is malformed.' && !error.message.includes('{not-json'));
});
test('PUT performs BASE LOCAL CLOUD semantic merge and stores with server time', async()=>{const store=new FakeStore();store.profile=JSON.stringify(snap(22));const now=new Date('2026-09-20T12:00:00Z');const response=await handlePutProfile(put(snap(20),snap(23)),'pikabu-42',store,now);assert.equal((await body(response)).profile.meta.stats.winnable.wins,25);assert.equal(JSON.parse(store.writes[0]!.serialized).meta.stats.winnable.wins,25);assert.equal(store.writes[0]!.nowMs,now.getTime());});
test('unexpected D1 error becomes generic handler 500', async () => {
  const store = new FakeStore(); store.readProfileError = new Error('SQL SELECT profiles secret detail');
  const handler = createCascadeHandler({ store, pikabuSecret:'pikabu-secret', bridgeSecret:'bridge-secret', allowedOrigins:'https://allowed.example' });
  const signed = await signBridgeSession({pikabuId:'pikabu-42',name:'Ada',avatar:''},'bridge-secret',Math.floor(Date.now()/1000));
  const response = await handler(new Request('https://x/v1/profile',{headers:{authorization:`Bearer ${signed.token}`}}));
  assert.equal(response.status,500); assert.deepEqual(await response.json(),{error:'Internal server error.'});
});
