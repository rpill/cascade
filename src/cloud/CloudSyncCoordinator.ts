import type { CloudProfileService, CloudProfileSaveResult } from '../backend/CloudProfileService.ts';
import type { BackendIdentityProvider } from '../platform/services.ts';
import { mergeCloudSnapshots } from './CloudMerge.ts';
import type { CloudSnapshot } from './CloudSnapshot.ts';
import type { CloudSyncState, CloudSyncStateStore, PendingProfileOperation } from './CloudSyncState.ts';

export interface CloudSyncLocalPort { readSnapshot():CloudSnapshot; applySnapshot(snapshot:CloudSnapshot):Promise<boolean>; todayId():string; }
export type CloudSyncReason='startup'|'authorization'|'online'|'game-complete'|'home';
export type CloudSyncResult='synced'|'guest'|'offline'|'pending';
export interface CloudSyncCoordinatorOptions{readonly identity:BackendIdentityProvider;readonly profiles:CloudProfileService;readonly local:CloudSyncLocalPort;readonly stateStoreFactory:(provider:string,localIdentityKey:string)=>CloudSyncStateStore;readonly nowMs?:()=>number;readonly random?:()=>number;}
const BASE_RETRY_MS=2_000,MAX_RETRY_MS=30_000;
function equal(a:CloudSnapshot,b:CloudSnapshot){return JSON.stringify(a)===JSON.stringify(b);}
export class CloudSyncCoordinator{
  private readonly identity:BackendIdentityProvider;private readonly profiles:CloudProfileService;private readonly local:CloudSyncLocalPort;private readonly stateStoreFactory:(provider:string,key:string)=>CloudSyncStateStore;private readonly nowMs:()=>number;private readonly random:()=>number;private inFlight:Promise<CloudSyncResult>|null=null;private disposed=false;private readonly onlineHandler:(()=>void)|null;
  constructor(o:CloudSyncCoordinatorOptions){this.identity=o.identity;this.profiles=o.profiles;this.local=o.local;this.stateStoreFactory=o.stateStoreFactory;this.nowMs=o.nowMs??(()=>Date.now());this.random=o.random??Math.random;const t=globalThis as typeof globalThis&{addEventListener?:(type:string,l:()=>void)=>void;removeEventListener?:(type:string,l:()=>void)=>void};if(typeof t.addEventListener==='function'){this.onlineHandler=()=>{void this.retryPending();};t.addEventListener('online',this.onlineHandler);}else this.onlineHandler=null;}
  sync(reason:CloudSyncReason):Promise<CloudSyncResult>{if(this.disposed)return Promise.resolve('pending');if(this.inFlight!==null)return this.inFlight;const active=this.runSync(reason).finally(()=>{if(this.inFlight===active)this.inFlight=null;});this.inFlight=active;return active;}
  async retryPending():Promise<void>{await this.sync('online');}
  dispose():void{if(this.disposed)return;this.disposed=true;if(this.onlineHandler!==null)(globalThis as typeof globalThis&{removeEventListener?:(type:string,l:()=>void)=>void}).removeEventListener?.('online',this.onlineHandler);}
  private async runSync(_reason:CloudSyncReason):Promise<CloudSyncResult>{
    if(!this.identity.isAuthorized())return'guest';const key=this.identity.localIdentityKey();if(key===null)return'guest';let assertion;try{assertion=await this.identity.getAssertion();}catch{return'offline';}if(assertion===null)return'guest';
    const store=this.stateStoreFactory(assertion.provider,key);let state=store.load();const now=this.nowMs();if(state.nextRetryAtMs!==undefined&&now<state.nextRetryAtMs)return'pending';
    if(state.pendingProfile!==null)return this.replayPending(store,state);
    const local=this.local.readSnapshot();
    let remote;try{remote=await this.profiles.load();}catch{this.persistFailure(store,state);return'offline';}
    const merged=mergeCloudSnapshots({base:state.base,local,cloud:remote.profile,todayId:this.local.todayId()});await this.local.applySnapshot(merged);
    const operation:PendingProfileOperation={kind:'profile',base:remote.profile,profile:structuredClone(merged)};state={...state,pendingProfile:operation};store.save(state);
    try{return await this.saveAndAccept(store,operation);}catch{this.persistFailure(store,{...store.load(),pendingProfile:operation});return'offline';}
  }
  private async replayPending(store:CloudSyncStateStore,state:CloudSyncState):Promise<CloudSyncResult>{const op=state.pendingProfile!;try{return await this.saveAndAccept(store,op);}catch{this.persistFailure(store,{...store.load(),pendingProfile:op});return'offline';}}
  private async saveAndAccept(store:CloudSyncStateStore,operation:PendingProfileOperation):Promise<CloudSyncResult>{const result:CloudProfileSaveResult=await this.profiles.save(operation);const localAtConfirmation=this.local.readSnapshot();const reconciled=mergeCloudSnapshots({base:operation.profile,local:localAtConfirmation,cloud:result.profile,todayId:this.local.todayId()});await this.local.applySnapshot(reconciled);const confirmedAt=this.nowMs();const accepted:CloudSyncState={...store.load(),base:result.profile,pendingProfile:null,retryAttempt:0,lastSuccessfulSyncAtMs:confirmedAt};const{nextRetryAtMs:_ignored,...withoutRetry}=accepted;store.save(withoutRetry);if(!equal(reconciled,result.profile)){store.save({...store.load(),pendingProfile:{kind:'profile',base:result.profile,profile:structuredClone(reconciled)}});return'pending';}return'synced';}
  private persistFailure(store:CloudSyncStateStore,state:CloudSyncState):void{const retryAttempt=state.retryAttempt+1;const exponential=Math.min(MAX_RETRY_MS,BASE_RETRY_MS*(2**Math.max(0,retryAttempt-1)));const jitter=exponential*0.25*Math.max(0,Math.min(1,this.random()));store.save({...state,retryAttempt,nextRetryAtMs:Math.round(this.nowMs()+exponential+jitter)});}
}
