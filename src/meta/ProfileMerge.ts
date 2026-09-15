import { REWARDED_DAILY_LIMIT } from '../monetization/Products.ts';
import { DEFAULT_THEME_ID, isThemeId } from '../theme/ThemeRegistry.ts';
import { MAX_ECONOMY_VALUE, normalizeMetaSave, type DailyRecord, type MasteryRank, type MetaSave, type ModeStats } from './MetaSave.ts';

const PROFILE_MERGE_TRANSFER_KEY = 'cascadePendingProfileMerge';
const PROFILE_MERGE_TRANSFER_VERSION = 2 as const;
const MAX_PROFILE_SCOPE_LENGTH = 256;
const MAX_STATS_VALUE = Number.MAX_SAFE_INTEGER;
const RANK_ORDER: readonly MasteryRank[] = ['novice','player','tactician','expert','master','grandmaster'];

export interface ProfileMergeStorage { getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void }
export interface ProfileMergeTransfer { sourceScope:string; state:MetaSave }

function resolveStorage():ProfileMergeStorage|null { try { return (globalThis as {localStorage?:ProfileMergeStorage}).localStorage ?? null; } catch { return null; } }
function uniqueTail(values:readonly string[],limit:number):string[]{return[...new Set(values)].slice(-limit)}
function safeAdd(a:number,b:number,limit:number):number{return Math.min(limit,a+b)}
function mergeBest(a?:number,b?:number):number|undefined{return a===undefined?b:b===undefined?a:Math.min(a,b)}
function mergeStats(a:ModeStats,b:ModeStats):ModeStats{const played=safeAdd(a.played,b.played,MAX_STATS_VALUE);const wins=Math.min(played,safeAdd(a.wins,b.wins,MAX_STATS_VALUE));const bestTimeMs=mergeBest(a.bestTimeMs,b.bestTimeMs);return{played,wins,...(bestTimeMs===undefined||wins===0?{}:{bestTimeMs})}}
function mergeDailyRecord(a:DailyRecord|undefined,b:DailyRecord|undefined):DailyRecord|undefined{if(!a)return b?{...b}:undefined;if(!b)return{...a};const bestTimeMs=mergeBest(a.bestTimeMs,b.bestTimeMs);return{completed:a.completed||b.completed,completedOnTime:a.completedOnTime||b.completedOnTime,attempts:safeAdd(a.attempts,b.attempts,MAX_STATS_VALUE),...(bestTimeMs===undefined?{}:{bestTimeMs})}}
function mergeReceipts(a:Record<string,number>,b:Record<string,number>):Record<string,number>{const out={...a};for(const[k,v]of Object.entries(b))out[k]=Math.max(out[k]??0,v);return out}
function mergeWeekly(a:MetaSave['weekly'],b:MetaSave['weekly']):MetaSave['weekly']{if(a.weekId===b.weekId)return{weekId:a.weekId,completedDailyIds:[...new Set([...a.completedDailyIds,...b.completedDailyIds])],claimedMilestones:[...new Set([...a.claimedMilestones,...b.claimedMilestones])]};const newer=b.weekId>a.weekId?b:a;return{weekId:newer.weekId,completedDailyIds:[...newer.completedDailyIds],claimedMilestones:[...newer.claimedMilestones]}}
function mergeRewarded(a:MetaSave['monetization'],b:MetaSave['monetization']):MetaSave['monetization']{if(a.rewardedDay===b.rewardedDay)return{rewardedDay:a.rewardedDay,rewardedCount:Math.min(REWARDED_DAILY_LIMIT,a.rewardedCount+b.rewardedCount)};return b.rewardedDay>a.rewardedDay?{...b}:{...a}}
function mergeMastery(a:MetaSave['mastery'],b:MetaSave['mastery']):MetaSave['mastery']{const ai=RANK_ORDER.indexOf(a.rank),bi=RANK_ORDER.indexOf(b.rank);if(ai!==bi)return ai>bi?structuredClone(a):structuredClone(b);return{rank:a.rank,stage:{anyWins:Math.max(a.stage.anyWins,b.stage.anyWins),mediumWins:Math.max(a.stage.mediumWins,b.stage.mediumWins),hardWins:Math.max(a.stage.hardWins,b.stage.hardWins),onTimeDailyWins:Math.max(a.stage.onTimeDailyWins,b.stage.onTimeDailyWins)}}}
function chooseEquipped(target:string,source:string,owned:readonly string[]):string{if(source&&owned.includes(source))return source;if(target&&owned.includes(target))return target;return''}

export function profileMergeReceiptKey(scope:string):string{let hash=0xcbf29ce484222325n;const prime=0x100000001b3n,mask=0xffffffffffffffffn;for(let i=0;i<scope.length;i++){hash^=BigInt(scope.charCodeAt(i));hash=(hash*prime)&mask}return`profilemerge_${hash.toString(36)}`}
export function hasMergedProfileScope(state:MetaSave,scope:string):boolean{return(state.progression.receipts[profileMergeReceiptKey(scope)]??0)>=1}
export function shouldPreserveActiveGameForProfileMerge(currentScope:string,authorized:boolean,transfer:ProfileMergeTransfer|null):boolean{return authorized&&transfer?.sourceScope===currentScope}

export function mergeMetaProfiles(targetRaw:MetaSave,sourceRaw:MetaSave,sourceScope:string):MetaSave{
  const target=normalizeMetaSave(targetRaw),source=normalizeMetaSave(sourceRaw),receiptKey=profileMergeReceiptKey(sourceScope);
  if((target.progression.receipts[receiptKey]??0)>=1)return target;
  const ownedCardBacks=[...new Set([...target.collection.ownedCardBacks,...source.collection.ownedCardBacks])];
  const ownedTables=[...new Set([...target.collection.ownedTables,...source.collection.ownedTables])];
  const ownedThemes=[...new Set([...target.collection.ownedThemes,...source.collection.ownedThemes])];
  const records:MetaSave['daily']['records']={};for(const id of new Set([...Object.keys(target.daily.records),...Object.keys(source.daily.records)])){const record=mergeDailyRecord(target.daily.records[id],source.daily.records[id]);if(record)records[id]=record}
  const receipts=mergeReceipts(target.progression.receipts,source.progression.receipts);receipts[receiptKey]=1;
  const merged:MetaSave={
    ...target,
    collection:{ownedCardBacks,ownedTables,ownedThemes},
    equipped:{cardBack:chooseEquipped(target.equipped.cardBack,source.equipped.cardBack,ownedCardBacks),table:chooseEquipped(target.equipped.table,source.equipped.table,ownedTables),theme:isThemeId(source.equipped.theme)&&ownedThemes.includes(source.equipped.theme)?source.equipped.theme:isThemeId(target.equipped.theme)&&ownedThemes.includes(target.equipped.theme)?target.equipped.theme:DEFAULT_THEME_ID},
    achievements:[...new Set([...target.achievements,...source.achievements])],
    stats:{original:mergeStats(target.stats.original,source.stats.original),winnable:mergeStats(target.stats.winnable,source.stats.winnable)},
    daily:{algorithmVersion:target.daily.algorithmVersion,records}, weekly:mergeWeekly(target.weekly,source.weekly),
    progression:{coins:safeAdd(target.progression.coins,source.progression.coins,MAX_ECONOMY_VALUE),startedAttempts:uniqueTail([...target.progression.startedAttempts,...source.progression.startedAttempts],128),completedAttempts:uniqueTail([...target.progression.completedAttempts,...source.progression.completedAttempts],128),receipts},
    standard:{selectedDifficulty:source.standard.selectedDifficulty,recentSeeds:uniqueTail([...target.standard.recentSeeds,...source.standard.recentSeeds],256),completed:{onboarding:[...new Set([...target.standard.completed.onboarding,...source.standard.completed.onboarding])],easy:[...new Set([...target.standard.completed.easy,...source.standard.completed.easy])],medium:[...new Set([...target.standard.completed.medium,...source.standard.completed.medium])],hard:[...new Set([...target.standard.completed.hard,...source.standard.completed.hard])]},masteryCreditedSeeds:[...new Set([...target.standard.masteryCreditedSeeds,...source.standard.masteryCreditedSeeds])],onboardingWins:Math.max(target.standard.onboardingWins,source.standard.onboardingWins)},
    standardWinStreak:{current:source.stats.winnable.played>0?source.standardWinStreak.current:target.standardWinStreak.current,best:Math.max(target.standardWinStreak.best,source.standardWinStreak.best)},
    mastery:mergeMastery(target.mastery,source.mastery),
    futurePrestige:{mediumSeeds:[...new Set([...target.futurePrestige.mediumSeeds,...source.futurePrestige.mediumSeeds])],hardSeeds:[...new Set([...target.futurePrestige.hardSeeds,...source.futurePrestige.hardSeeds])],onTimeDailyDates:[...new Set([...target.futurePrestige.onTimeDailyDates,...source.futurePrestige.onTimeDailyDates])]},
    claimedRewardKeys:[...new Set([...target.claimedRewardKeys,...source.claimedRewardKeys])], monetization:mergeRewarded(target.monetization,source.monetization),
  };
  return normalizeMetaSave(merged);
}

export function stageProfileMergeTransfer(sourceScope:string,state:MetaSave,storage:ProfileMergeStorage|null=resolveStorage()):boolean{if(!storage||!sourceScope||sourceScope.length>MAX_PROFILE_SCOPE_LENGTH)return false;try{storage.setItem(PROFILE_MERGE_TRANSFER_KEY,JSON.stringify({version:PROFILE_MERGE_TRANSFER_VERSION,sourceScope,state:normalizeMetaSave(state)}));return true}catch{return false}}
export function readProfileMergeTransfer(storage:ProfileMergeStorage|null=resolveStorage()):ProfileMergeTransfer|null{if(!storage)return null;try{const raw=storage.getItem(PROFILE_MERGE_TRANSFER_KEY);if(!raw)return null;const parsed=JSON.parse(raw) as unknown;if(typeof parsed!=='object'||parsed===null||Array.isArray(parsed))return null;const v=parsed as Record<string,unknown>;if(v.version!==PROFILE_MERGE_TRANSFER_VERSION||typeof v.sourceScope!=='string'||!v.sourceScope||v.sourceScope.length>MAX_PROFILE_SCOPE_LENGTH)return null;return{sourceScope:v.sourceScope,state:normalizeMetaSave(v.state)}}catch{return null}}
export function clearProfileMergeTransfer(storage:ProfileMergeStorage|null=resolveStorage()):void{try{storage?.removeItem(PROFILE_MERGE_TRANSFER_KEY)}catch{}}
