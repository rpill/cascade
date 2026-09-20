import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncStateStore, type CloudSyncState } from '../src/cloud/CloudSyncState.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

class MemoryStorage {
  readonly values = new Map<string,string>();
  getItem(key:string){ return this.values.get(key) ?? null; }
  setItem(key:string,value:string){ this.values.set(key,value); }
  removeItem(key:string){ this.values.delete(key); }
}
const profile = { schemaVersion: 1 as const, meta: createDefaultMetaSave() };
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

function state(overrides: Partial<CloudSyncState> = {}): CloudSyncState {
  return { version:1, revision:0, base:null, pendingProfile:null, pendingLeaderboards:[], retryAttempt:0, ...overrides };
}

test('two Pikabu identity keys never share BASE or pending operations', () => {
  const storage=new MemoryStorage();
  const a=new CloudSyncStateStore('pikabu','guest-a',storage);
  const b=new CloudSyncStateStore('pikabu','guest-b',storage);
  a.save(state({revision:3,base:profile,pendingLeaderboards:[{kind:'leaderboard',operationId:uuid(1),technicalName:'daily',score:10}]}));
  assert.equal(a.load().revision,3);
  assert.equal(b.load().revision,0);
  assert.equal(b.load().pendingLeaderboards.length,0);
});

test('corrupt JSON resets to the default sync state without throwing', () => {
  const storage=new MemoryStorage();
  storage.setItem('cascadeCloudSyncState:v1:pikabu:abc','{bad');
  assert.deepEqual(new CloudSyncStateStore('pikabu','abc',storage).load(), state());
});

test('invalid revision or invalid cloud snapshot resets safely', () => {
  const storage=new MemoryStorage();
  const key='cascadeCloudSyncState:v1:pikabu:abc';
  storage.setItem(key,JSON.stringify({...state(),revision:-1}));
  assert.deepEqual(new CloudSyncStateStore('pikabu','abc',storage).load(), state());
  storage.setItem(key,JSON.stringify({...state(),base:{schemaVersion:99,meta:{}}}));
  assert.deepEqual(new CloudSyncStateStore('pikabu','abc',storage).load(), state());
});

test('pending profile operation survives reload with the same operationId and body', () => {
  const storage=new MemoryStorage();
  const store=new CloudSyncStateStore('pikabu','abc',storage);
  const op={kind:'profile' as const,operationId:uuid(2),expectedRevision:4,profile};
  store.save(state({revision:4,pendingProfile:op}));
  assert.deepEqual(new CloudSyncStateStore('pikabu','abc',storage).load().pendingProfile,op);
});

test('pending leaderboard operation survives reload and preserves operationId', () => {
  const storage=new MemoryStorage();
  const op={kind:'leaderboard' as const,operationId:uuid(3),technicalName:'daily',score:99,context:{kind:'daily' as const,dailyId:'2026-09-20',moves:99,elapsedMs:1234,completedOnTime:true,attemptId:'x'}};
  new CloudSyncStateStore('pikabu','abc',storage).save(state({pendingLeaderboards:[op]}));
  assert.deepEqual(new CloudSyncStateStore('pikabu','abc',storage).load().pendingLeaderboards,[op]);
});

test('queue is bounded to 64 leaderboard mutations and keeps newest unique operation IDs', () => {
  const storage=new MemoryStorage();
  const pending=Array.from({length:70},(_,i)=>({kind:'leaderboard' as const,operationId:uuid(i),technicalName:'standard',score:i}));
  pending.push({...pending[69]!,score:999});
  const store=new CloudSyncStateStore('pikabu','abc',storage);
  store.save(state({pendingLeaderboards:pending}));
  const loaded=store.load().pendingLeaderboards;
  assert.equal(loaded.length,64);
  assert.equal(new Set(loaded.map((op)=>op.operationId)).size,64);
  assert.equal(loaded.at(-1)?.score,999);
  assert.equal(loaded.some((op)=>op.operationId===uuid(0)),false);
});
