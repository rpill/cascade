import type { BrowserStorageLike, PlatformLeaderboardSubmissionContext } from '../platform/services.ts';
import { normalizeCloudSnapshot, type CloudSnapshot } from './CloudSnapshot.ts';

export interface PendingProfileOperation {
  readonly kind: 'profile';
  readonly base: CloudSnapshot | null;
  readonly profile: CloudSnapshot;
}

export interface PendingLeaderboardOperation {
  readonly kind: 'leaderboard';
  readonly operationId: string;
  readonly technicalName: string;
  readonly score: number;
  readonly context?: PlatformLeaderboardSubmissionContext;
}

export interface CloudSyncState {
  readonly version: 2;
  readonly base: CloudSnapshot | null;
  readonly pendingProfile: PendingProfileOperation | null;
  readonly pendingLeaderboards: readonly PendingLeaderboardOperation[];
  readonly lastSuccessfulSyncAtMs?: number;
  readonly retryAttempt: number;
  readonly nextRetryAtMs?: number;
}

interface MutableStorageLike extends BrowserStorageLike { removeItem?(key: string): void; }
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAILY_ID_RE=/^\d{4}-\d{2}-\d{2}$/;
const MAX_QUEUE=64;
function defaultState():CloudSyncState{return{version:2,base:null,pendingProfile:null,pendingLeaderboards:[],retryAttempt:0};}
function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function nonNeg(v:unknown):v is number{return Number.isSafeInteger(v)&&(v as number)>=0;}
function positive(v:unknown):v is number{return Number.isSafeInteger(v)&&(v as number)>0;}
function normalizeContext(value:unknown):PlatformLeaderboardSubmissionContext|undefined{
  if(!isRecord(value)||typeof value.kind!=='string')return undefined;
  if(value.kind==='standard')return nonNeg(value.bestStreak)?{kind:'standard',bestStreak:value.bestStreak}:undefined;
  if(value.kind==='daily'){
    if(!DAILY_ID_RE.test(String(value.dailyId??''))||!positive(value.moves)||!positive(value.elapsedMs)||typeof value.completedOnTime!=='boolean')return undefined;
    const attemptId=value.attemptId;
    if(attemptId!==undefined&&(typeof attemptId!=='string'||attemptId.length<1||attemptId.length>100))return undefined;
    return{kind:'daily',dailyId:value.dailyId as string,moves:value.moves,elapsedMs:value.elapsedMs,completedOnTime:value.completedOnTime,...(attemptId===undefined?{}:{attemptId})};
  }
  if(value.kind==='streak'){
    if(value.todayId!==undefined&&(typeof value.todayId!=='string'||!DAILY_ID_RE.test(value.todayId)))return undefined;
    return{kind:'streak',...(value.todayId===undefined?{}:{todayId:value.todayId})};
  }
  if(value.kind==='mastery'&&value.profile!==undefined)return{kind:'mastery',profile:structuredClone(value.profile)};
  return undefined;
}
function normalizeLeaderboard(value:unknown):PendingLeaderboardOperation|null{
  if(!isRecord(value)||value.kind!=='leaderboard'||typeof value.operationId!=='string'||!UUID_RE.test(value.operationId)||typeof value.technicalName!=='string'||value.technicalName.length<1||value.technicalName.length>100||!Number.isSafeInteger(value.score))return null;
  if(value.context===undefined)return{kind:'leaderboard',operationId:value.operationId,technicalName:value.technicalName,score:value.score as number};
  const context=normalizeContext(value.context);if(context===undefined)return null;
  return{kind:'leaderboard',operationId:value.operationId,technicalName:value.technicalName,score:value.score as number,context};
}
function normalizeQueue(value:unknown):PendingLeaderboardOperation[]{
  if(!Array.isArray(value))return[];const byId=new Map<string,PendingLeaderboardOperation>();
  for(const raw of value){const op=normalizeLeaderboard(raw);if(op===null)continue;if(byId.has(op.operationId))byId.delete(op.operationId);byId.set(op.operationId,op);}return[...byId.values()].slice(-MAX_QUEUE);
}
function normalizeSnapshotOrNull(value:unknown):CloudSnapshot|null|undefined{
  if(value===null)return null;const normalized=normalizeCloudSnapshot(value);return normalized===null?undefined:normalized;
}
function normalizeV2Pending(value:unknown):PendingProfileOperation|null|undefined{
  if(value===null)return null;if(!isRecord(value)||value.kind!=='profile')return undefined;
  const base=normalizeSnapshotOrNull(value.base);const profile=normalizeCloudSnapshot(value.profile);
  if(base===undefined||profile===null)return undefined;return{kind:'profile',base,profile};
}
function normalizeState(value:unknown):CloudSyncState{
  if(!isRecord(value)||!nonNeg(value.retryAttempt))return defaultState();
  const base=normalizeSnapshotOrNull(value.base);if(base===undefined)return defaultState();
  let pending:PendingProfileOperation|null|undefined;
  if(value.version===2) pending=normalizeV2Pending(value.pendingProfile);
  else if(value.version===1){
    if(!nonNeg(value.revision))return defaultState();
    if(value.pendingProfile===null)pending=null;
    else if(isRecord(value.pendingProfile)&&value.pendingProfile.kind==='profile'&&typeof value.pendingProfile.operationId==='string'&&UUID_RE.test(value.pendingProfile.operationId)&&nonNeg(value.pendingProfile.expectedRevision)){
      const profile=normalizeCloudSnapshot(value.pendingProfile.profile);pending=profile===null?undefined:{kind:'profile',base,profile};
    }
  } else return defaultState();
  if(pending===undefined)return defaultState();
  if(value.lastSuccessfulSyncAtMs!==undefined&&!nonNeg(value.lastSuccessfulSyncAtMs))return defaultState();
  if(value.nextRetryAtMs!==undefined&&!nonNeg(value.nextRetryAtMs))return defaultState();
  return{version:2,base,pendingProfile:pending,pendingLeaderboards:normalizeQueue(value.pendingLeaderboards),retryAttempt:value.retryAttempt,...(value.lastSuccessfulSyncAtMs===undefined?{}:{lastSuccessfulSyncAtMs:value.lastSuccessfulSyncAtMs}),...(value.nextRetryAtMs===undefined?{}:{nextRetryAtMs:value.nextRetryAtMs})};
}
function resolveStorage():MutableStorageLike|null{try{return(globalThis as{localStorage?:MutableStorageLike}).localStorage??null;}catch{return null;}}
export class CloudSyncStateStore{
  private readonly key:string;private readonly storage:MutableStorageLike|null;private memory:CloudSyncState=defaultState();
  constructor(provider:string,localIdentityKey:string,storage?:BrowserStorageLike|null){this.key=`cascadeCloudSyncState:v1:${provider}:${encodeURIComponent(localIdentityKey)}`;this.storage=(storage===undefined?resolveStorage():storage) as MutableStorageLike|null;}
  load():CloudSyncState{if(this.storage===null)return structuredClone(this.memory);try{const serialized=this.storage.getItem(this.key);if(serialized===null)return structuredClone(this.memory);const normalized=normalizeState(JSON.parse(serialized));this.memory=normalized;return structuredClone(normalized);}catch{this.memory=defaultState();return structuredClone(this.memory);}}
  save(state:CloudSyncState):void{const normalized=normalizeState(state);this.memory=normalized;try{this.storage?.setItem(this.key,JSON.stringify(normalized));}catch{/* memory fallback */}}
  clear():void{this.memory=defaultState();try{this.storage?.removeItem?.(this.key);}catch{/* ignore */}}
}
