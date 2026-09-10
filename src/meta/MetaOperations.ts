import type { StandardTier } from '../game/model/VerifiedDealCatalog.ts';
import type { GameMode } from '../game/model/types.ts';
import { beginDailyAttempt, completeDailyAttempt } from './DailyProgress.ts';
import { beginModeAttempt, completeModeAttempt } from './GameStats.ts';
import { awardLines, equipTheme, purchaseTheme, WIN_REWARDS, WEEK_REWARDS, type RewardLine, type RewardSummary } from './Economy.ts';
import type { MetaSave } from './MetaSave.ts';
import { getLevelProgress } from './Progression.ts';

interface AttemptEvent { readonly attemptId:string; readonly mode:GameMode; readonly dailyId?:string; readonly weekId?:string }
export type CompletionEvent = AttemptEvent & {readonly kind:'complete';readonly elapsedMs:number;readonly trustedDay:string|null;readonly trustedWeek:string|null};
export type MetaOperation = (AttemptEvent & {readonly kind:'begin'}) | CompletionEvent
  | {readonly kind:'purchase';readonly themeId:string} | {readonly kind:'equip';readonly themeId:string}
  | {readonly kind:'standard-served';readonly seed:string;readonly tier:StandardTier}
  | {readonly kind:'standard-failed';readonly attemptId:string};

function remember(ids: string[], id: string) { return [...ids,id].slice(-128); }
function attemptCursor(id:string): {key:string;sequence:number}|null {
  const match=/^([a-zA-Z0-9_-]{1,80})~([1-9]\d*)$/.exec(id);
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
  return {key:`attempt-${match[1]}`,sequence:Number(match[2])};
}
export function hasCompletedAttempt(state:MetaSave,id:string):boolean {
  const cursor=attemptCursor(id);
  return state.progression.completedAttempts.includes(id)
    || (cursor!==null && (state.progression.receipts[cursor.key] ?? 0)>=cursor.sequence);
}
function validDaily(event: AttemptEvent): boolean {
  return typeof event.dailyId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.dailyId)
    && typeof event.weekId === 'string' && /^\d{4}-W\d{2}$/.test(event.weekId);
}

export function completeRewardedAttempt(state: MetaSave, event: CompletionEvent): {state:MetaSave;reward:RewardSummary} {
  const empty = {xp:0,coins:0,level:getLevelProgress(state.progression.totalXp).level,lines:[]};
  if (!event.attemptId || hasCompletedAttempt(state,event.attemptId)
    || !Number.isFinite(event.elapsedMs) || event.elapsedMs <= 0) return {state,reward:empty};
  let next = state;
  const lines:RewardLine[] = [];
  let eligible = true;
  if (event.mode === 'daily') {
    if (!validDaily(event)) return {state,reward:empty};
    const result = completeDailyAttempt(state,event.dailyId!,event.weekId!,event.elapsedMs);
    next = result.state;
    eligible = result.firstCompletion;
    if (eligible && event.trustedWeek === event.weekId && next.weekly.weekId === event.weekId) {
      const thresholds = result.newlyReachedMilestones.filter(n=>!next.weekly.claimedMilestones.includes(n));
      for (const n of thresholds) lines.push({label:`${n} испытаний за неделю`,xp:0,coins:WEEK_REWARDS[n] ?? 0});
      next = {...next,weekly:{...next.weekly,claimedMilestones:[...next.weekly.claimedMilestones,...thresholds]}};
    }
  } else {
    // Legacy restored checkpoints already count as played; unavailable-cloud replay may not.
    if (next.stats[event.mode].played <= next.stats[event.mode].wins) next = beginModeAttempt(next,event.mode);
    next = completeModeAttempt(next,event.mode,event.elapsedMs).state;
    if (event.mode === 'winnable') {
      next = {
        ...next,
        standardDifficulty: { ...next.standardDifficulty, failureStreak: 0 },
      };
    }
  }
  if (eligible) {
    lines.unshift({label:event.mode === 'daily' ? 'Испытание дня' : 'Победа',...WIN_REWARDS[event.mode]});
    if (event.trustedDay && /^\d{4}-\d{2}-\d{2}$/.test(event.trustedDay) && event.trustedDay > next.progression.lastWinDay) {
      lines.push({label:'Первая победа сегодня',xp:50,coins:30});
      next = {...next,progression:{...next.progression,lastWinDay:event.trustedDay}};
    }
  }
  const cursor=attemptCursor(event.attemptId);
  next = {...next,progression:{...next.progression,
    completedAttempts:remember(next.progression.completedAttempts,event.attemptId),
    receipts:cursor ? {...next.progression.receipts,[cursor.key]:cursor.sequence} : next.progression.receipts,
  }};
  return awardLines(next,lines);
}

export function applyMetaOperation(state: MetaSave, event: MetaOperation): MetaSave {
  switch (event.kind) {
    case 'purchase': return purchaseTheme(state,event.themeId);
    case 'equip': return equipTheme(state,event.themeId);
    case 'standard-served': {
      if (!/^[1-9]\d{0,9}$/u.test(event.seed)) return state;
      let numericSeed: bigint;
      try { numericSeed = BigInt(event.seed); } catch { return state; }
      if (numericSeed < 1n || numericSeed > 0xffff_ffffn) return state;
      const recentSeeds = [
        ...state.standardDifficulty.recentSeeds.filter((seed) => seed !== event.seed),
        event.seed,
      ].slice(-256);
      return {
        ...state,
        standardDifficulty: {
          ...state.standardDifficulty,
          lastServedTier: event.tier,
          recentSeeds,
        },
      };
    }
    case 'standard-failed': {
      if (!event.attemptId) return state;
      return {
        ...state,
        standardDifficulty: {
          ...state.standardDifficulty,
          failureStreak: Math.min(3, state.standardDifficulty.failureStreak + 1) as 0 | 1 | 2 | 3,
        },
      };
    }
    case 'complete': return completeRewardedAttempt(state,event).state;
    case 'begin': {
      if (!event.attemptId || state.progression.startedAttempts.includes(event.attemptId) || hasCompletedAttempt(state,event.attemptId)) return state;
      if (event.mode === 'daily' && !validDaily(event)) return state;
      const next = event.mode === 'daily' ? beginDailyAttempt(state,event.dailyId!,event.weekId!) : beginModeAttempt(state,event.mode);
      return {...next,progression:{...next.progression,startedAttempts:remember(next.progression.startedAttempts,event.attemptId)}};
    }
  }
}
