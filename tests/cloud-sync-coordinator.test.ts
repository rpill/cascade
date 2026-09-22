import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncCoordinator } from '../src/cloud/CloudSyncCoordinator.ts';
import { CloudSyncStateStore } from '../src/cloud/CloudSyncState.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { BackendIdentityProvider } from '../src/platform/services.ts';
import type { CloudSnapshot } from '../src/cloud/CloudSnapshot.ts';
import type { CloudProfileLoad, CloudProfileSaveResult } from '../src/backend/CloudProfileService.ts';

class MemoryStorage { values=new Map<string,string>(); getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);} removeItem(k:string){this.values.delete(k);} }
function snap(wins=0):CloudSnapshot{const meta=createDefaultMetaSave();meta.stats.winnable.played=wins;meta.stats.winnable.wins=wins;return{schemaVersion:1,meta};}
function ident(auth=true):BackendIdentityProvider{return{isAuthorized:()=>auth,localIdentityKey:()=>auth?'player-1':null,getAssertion:async()=>auth?{provider:'pikabu',value:'signed'}:null};}
class FakeProfiles { loads:CloudProfileLoad[]=[]; saves:((op:any)=>Promise<CloudProfileSaveResult>)[]=[]; loadCalls=0; saveOps:any[]=[]; async load(){this.loadCalls++;const value=this.loads.shift();if(!value)throw new Error('no load');return value;} async save(op:any){this.saveOps.push(structuredClone(op));const fn=this.saves.shift();if(!fn)throw new Error('no save');return fn(op);} }
function harness(initial=snap(0),auth=true){let current=structuredClone(initial);const storage=new MemoryStorage();let now=1000;const profiles=new FakeProfiles();const coordinator=new CloudSyncCoordinator({identity:ident(auth),profiles:profiles as any,local:{readSnapshot:()=>structuredClone(current),applySnapshot:async(s)=>{current=structuredClone(s);return true;},todayId:()=> '2026-09-20'},stateStoreFactory:(provider,key)=>new CloudSyncStateStore(provider,key,storage),nowMs:()=>now,random:()=>0});return{coordinator,profiles,storage,get current(){return current;},set current(v:CloudSnapshot){current=structuredClone(v);},setNow(v:number){now=v;},state:()=>new CloudSyncStateStore('pikabu','player-1',storage).load()};}

test('guest sync is a no-op and never calls backend',async()=>{const h=harness(snap(1),false);assert.equal(await h.coordinator.sync('startup'),'guest');assert.equal(h.profiles.loadCalls,0);});
test('first authorization with empty cloud stages BASE null and uploads local snapshot',async()=>{const h=harness(snap(3));h.profiles.loads.push({profile:null});h.profiles.saves.push(async op=>({profile:op.profile}));assert.equal(await h.coordinator.sync('authorization'),'synced');assert.equal(h.profiles.saveOps[0].base,null);assert.equal(h.profiles.saveOps[0].profile.meta.stats.winnable.wins,3);assert.equal(h.state().base?.meta.stats.winnable.wins,3);});
test('local and cloud use semantic first-link merge before save',async()=>{const h=harness(snap(3));const cloud=snap(5);cloud.meta.standard.completed.easy=['11'];h.current.meta.standard.completed.easy=['22'];h.profiles.loads.push({profile:cloud});h.profiles.saves.push(async op=>({profile:op.profile}));await h.coordinator.sync('authorization');assert.deepEqual(new Set(h.current.meta.standard.completed.easy),new Set(['11','22']));assert.deepEqual(h.profiles.saveOps[0].base,cloud);});
test('network save failure leaves pending BASE/profile durable and retry reuses exact operation',async()=>{const initial=snap(4);const h=harness(initial);h.profiles.loads.push({profile:null});h.profiles.saves.push(async()=>{throw new Error('offline');});assert.equal(await h.coordinator.sync('home'),'offline');const pending=structuredClone(h.state().pendingProfile);assert.ok(pending);h.setNow(4000);h.profiles.saves.push(async op=>({profile:op.profile}));assert.equal(await h.coordinator.sync('online'),'synced');assert.deepEqual(h.profiles.saveOps[1],pending);});
test('in-flight local change stages follow-up with returned profile as BASE',async()=>{const h=harness(snap(2));h.profiles.loads.push({profile:snap(1)});h.profiles.saves.push(async op=>{h.current=snap(5);return{profile:op.profile};});assert.equal(await h.coordinator.sync('home'),'pending');const returned=h.profiles.saveOps[0].profile;assert.deepEqual(h.state().pendingProfile?.base,returned);assert.equal(h.state().pendingProfile?.profile.meta.stats.winnable.wins,5);});
test('online retry respects nextRetryAt and clears retry state after success',async()=>{const h=harness(snap(2));h.profiles.loads.push({profile:null});h.profiles.saves.push(async()=>{throw new Error('offline');});await h.coordinator.sync('home');const calls=h.profiles.saveOps.length;h.setNow(1500);assert.equal(await h.coordinator.sync('online'),'pending');assert.equal(h.profiles.saveOps.length,calls);h.setNow(3000);h.profiles.saves.push(async op=>({profile:op.profile}));assert.equal(await h.coordinator.sync('online'),'synced');assert.equal(h.state().retryAttempt,0);assert.equal(h.state().nextRetryAtMs,undefined);});

test('a newer local snapshot syncs immediately after a successful D1 write',async()=>{
  const h=harness(snap(2));
  h.profiles.loads.push({profile:null});
  h.profiles.saves.push(async op=>({profile:op.profile}));
  assert.equal(await h.coordinator.sync('home'),'synced');

  h.current=snap(5);
  h.setNow(2_000);
  h.profiles.loads.push({profile:snap(2)});
  h.profiles.saves.push(async op=>({profile:op.profile}));
  assert.equal(await h.coordinator.sync('game-complete'),'synced');
  assert.equal(h.profiles.loadCalls,2);
  assert.equal(h.profiles.saveOps.length,2);
  assert.equal(h.profiles.saveOps[1].profile.meta.stats.winnable.wins,5);
  assert.equal(h.state().pendingProfile,null);
  assert.equal(h.state().nextRetryAtMs,undefined);
});

test('a post-write sync rereads D1 so remote changes from another device are merged immediately',async()=>{
  const h=harness(snap(2));
  h.profiles.loads.push({profile:null});
  h.profiles.saves.push(async op=>({profile:op.profile}));
  assert.equal(await h.coordinator.sync('home'),'synced');

  h.setNow(2_000);
  h.profiles.loads.push({profile:snap(5)});
  h.profiles.saves.push(async op=>({profile:op.profile}));
  assert.equal(await h.coordinator.sync('home'),'synced');
  assert.equal(h.profiles.loadCalls,2);
  assert.equal(h.profiles.saveOps.length,2);
  assert.equal(h.current.meta.stats.winnable.wins,5);
});
