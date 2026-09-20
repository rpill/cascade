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
class FakeProfiles {
  loads:CloudProfileLoad[]=[]; saves:((op:any)=>Promise<CloudProfileSaveResult>)[]=[]; loadCalls=0; saveOps:any[]=[];
  async load(){this.loadCalls++;const value=this.loads.shift();if(!value)throw new Error('no load');return value;}
  async save(op:any){this.saveOps.push(structuredClone(op));const fn=this.saves.shift();if(!fn)throw new Error('no save');return fn(op);}
}
function harness(initial=snap(0), auth=true){
  let current=structuredClone(initial); const applied:CloudSnapshot[]=[]; const storage=new MemoryStorage(); let now=1000;
  const profiles=new FakeProfiles();
  const coordinator=new CloudSyncCoordinator({
    identity:ident(auth), profiles:profiles as any,
    local:{readSnapshot:()=>structuredClone(current),applySnapshot:async(s)=>{current=structuredClone(s);applied.push(structuredClone(s));return true;},todayId:()=> '2026-09-20'},
    stateStoreFactory:(provider,key)=>new CloudSyncStateStore(provider,key,storage),
    nowMs:()=>now, random:()=>0,
  });
  return {coordinator,profiles,storage,applied,get current(){return current;},setNow(v:number){now=v;},state:()=>new CloudSyncStateStore('pikabu','player-1',storage).load()};
}

test('guest sync is a no-op and never calls backend', async()=>{const h=harness(snap(1),false);assert.equal(await h.coordinator.sync('startup'),'guest');assert.equal(h.profiles.loadCalls,0);});

test('first authorization with empty cloud uploads normalized local snapshot', async()=>{const h=harness(snap(3));h.profiles.loads.push({revision:0,profile:null,updatedAt:null});h.profiles.saves.push(async op=>({status:'saved',revision:1,profile:op.profile}));assert.equal(await h.coordinator.sync('authorization'),'synced');assert.equal(h.profiles.saveOps[0].expectedRevision,0);assert.equal(h.state().revision,1);assert.equal(h.state().base?.meta.stats.winnable.wins,3);});

test('first authorization with local and cloud performs semantic first-link merge', async()=>{const h=harness(snap(3));const cloud=snap(5);cloud.meta.standard.completed.easy=['11'];h.current.meta.standard.completed.easy=['22'];h.profiles.loads.push({revision:7,profile:cloud,updatedAt:'x'});h.profiles.saves.push(async op=>({status:'saved',revision:8,profile:op.profile}));await h.coordinator.sync('authorization');assert.deepEqual(new Set(h.current.meta.standard.completed.easy),new Set(['11','22']));});

test('successful save updates local snapshot BASE and accepted revision only after server confirmation', async()=>{const h=harness(snap(2));h.profiles.loads.push({revision:4,profile:snap(1),updatedAt:'x'});let observedRevision=-1;h.profiles.saves.push(async op=>{observedRevision=h.state().revision;return{status:'saved',revision:5,profile:op.profile};});await h.coordinator.sync('home');assert.equal(observedRevision,0);assert.equal(h.state().revision,5);assert.equal(h.state().pendingProfile,null);});

test('409 refetches latest cloud remerges and retries with new revision', async()=>{const base=snap(20);const h=harness(snap(23));const store=new CloudSyncStateStore('pikabu','player-1',h.storage);store.save({...store.load(),revision:5,base});h.profiles.loads.push({revision:5,profile:snap(22),updatedAt:'x'},{revision:6,profile:snap(24),updatedAt:'y'});h.profiles.saves.push(async()=>({status:'conflict',revision:6,profile:snap(24)}),async op=>({status:'saved',revision:7,profile:op.profile}));assert.equal(await h.coordinator.sync('home'),'synced');assert.equal(h.current.meta.stats.winnable.wins,27);assert.deepEqual(h.profiles.saveOps.map(o=>o.expectedRevision),[5,6]);assert.equal(h.profiles.loadCalls,2);});

test('three consecutive CAS conflicts stop as pending instead of looping', async()=>{const h=harness(snap(1));h.profiles.loads.push({revision:1,profile:snap(1),updatedAt:'x'},{revision:2,profile:snap(1),updatedAt:'x'},{revision:3,profile:snap(1),updatedAt:'x'},{revision:4,profile:snap(1),updatedAt:'x'});for(let r=2;r<=4;r++)h.profiles.saves.push(async()=>({status:'conflict',revision:r,profile:snap(1)}));assert.equal(await h.coordinator.sync('home'),'pending');assert.equal(h.profiles.saveOps.length,3);assert.notEqual(h.state().pendingProfile,null);});

test('network failure leaves local snapshot untouched and pending operation durable', async()=>{const initial=snap(4);const h=harness(initial);h.profiles.loads.push({revision:0,profile:null,updatedAt:null});h.profiles.saves.push(async()=>{throw new Error('offline');});assert.equal(await h.coordinator.sync('home'),'offline');assert.deepEqual(h.current,initial);assert.notEqual(h.state().pendingProfile,null);assert.equal(h.state().retryAttempt,1);});

test('lost response replay reuses same operationId and accepts idempotent server result', async()=>{const h=harness(snap(4));h.profiles.loads.push({revision:0,profile:null,updatedAt:null});h.profiles.saves.push(async()=>{throw new Error('lost');});await h.coordinator.sync('home');const first=h.profiles.saveOps[0].operationId;h.setNow(4000);h.profiles.saves.push(async op=>({status:'saved',revision:1,profile:op.profile}));assert.equal(await h.coordinator.sync('online'),'synced');assert.equal(h.profiles.saveOps[1].operationId,first);});

test('online retry respects nextRetryAt and resets retry counter after success', async()=>{const h=harness(snap(2));h.profiles.loads.push({revision:0,profile:null,updatedAt:null});h.profiles.saves.push(async()=>{throw new Error('offline');});await h.coordinator.sync('home');const calls=h.profiles.saveOps.length;h.setNow(1500);assert.equal(await h.coordinator.sync('online'),'pending');assert.equal(h.profiles.saveOps.length,calls);h.setNow(3000);h.profiles.saves.push(async op=>({status:'saved',revision:1,profile:op.profile}));assert.equal(await h.coordinator.sync('online'),'synced');assert.equal(h.state().retryAttempt,0);assert.equal(h.state().nextRetryAtMs,undefined);});
