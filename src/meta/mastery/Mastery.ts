import type { MasteryRank, MasteryStageProgress, MetaSave, StandardDifficulty } from '../MetaSave.ts';

export interface MasteryRequirements extends MasteryStageProgress {}
export interface MasteryStandardWinInput { seed: string; difficulty: StandardDifficulty }
export interface MasteryResult { state: MetaSave; masteryAdvanced: boolean; rankAdvancedTo: MasteryRank | null }

const ZERO_STAGE: MasteryStageProgress = { anyWins:0, mediumWins:0, hardWins:0, onTimeDailyWins:0 };
const REQUIREMENTS: Readonly<Record<Exclude<MasteryRank,'grandmaster'>,MasteryRequirements>> = {
  novice:{anyWins:10,mediumWins:0,hardWins:0,onTimeDailyWins:0},
  player:{anyWins:0,mediumWins:15,hardWins:3,onTimeDailyWins:0},
  tactician:{anyWins:0,mediumWins:25,hardWins:10,onTimeDailyWins:0},
  expert:{anyWins:0,mediumWins:0,hardWins:25,onTimeDailyWins:5},
  master:{anyWins:0,mediumWins:0,hardWins:60,onTimeDailyWins:15},
};
const NEXT: Readonly<Record<Exclude<MasteryRank,'grandmaster'>,MasteryRank>> = { novice:'player',player:'tactician',tactician:'expert',expert:'master',master:'grandmaster' };
export function getMasteryRequirements(rank: MasteryRank): MasteryRequirements | null { return rank === 'grandmaster' ? null : REQUIREMENTS[rank]; }
function meets(stage:MasteryStageProgress, req:MasteryRequirements):boolean { return stage.anyWins>=req.anyWins&&stage.mediumWins>=req.mediumWins&&stage.hardWins>=req.hardWins&&stage.onTimeDailyWins>=req.onTimeDailyWins; }
function relevant(rank:MasteryRank,difficulty:StandardDifficulty):boolean { if(rank==='novice')return true;if(rank==='player'||rank==='tactician')return difficulty==='medium'||difficulty==='hard';if(rank==='expert'||rank==='master')return difficulty==='hard';return false; }
function unique(values:readonly string[],value:string):string[]{ return values.includes(value)?[...values]:[...values,value]; }

export function recordMasteryEligibleStandardWin(state:MetaSave,input:MasteryStandardWinInput):MasteryResult {
  if (!/^[1-9]\d{0,9}$/u.test(input.seed)) throw new Error('Mastery seed must be a positive integer string.');
  if (state.standard.masteryCreditedSeeds.includes(input.seed)) return {state,masteryAdvanced:false,rankAdvancedTo:null};
  const rank=state.mastery.rank; const advances=relevant(rank,input.difficulty);
  const stage:MasteryStageProgress={
    anyWins:state.mastery.stage.anyWins+(rank==='novice'?1:0),
    mediumWins:state.mastery.stage.mediumWins+(input.difficulty==='medium'&&advances?1:0),
    hardWins:state.mastery.stage.hardWins+(input.difficulty==='hard'&&advances?1:0),
    onTimeDailyWins:state.mastery.stage.onTimeDailyWins,
  };
  let next:MetaSave={...state,standard:{...state.standard,masteryCreditedSeeds:unique(state.standard.masteryCreditedSeeds,input.seed)},mastery:{rank,stage},futurePrestige:{...state.futurePrestige,mediumSeeds:input.difficulty==='medium'?unique(state.futurePrestige.mediumSeeds,input.seed):state.futurePrestige.mediumSeeds,hardSeeds:input.difficulty==='hard'?unique(state.futurePrestige.hardSeeds,input.seed):state.futurePrestige.hardSeeds}};
  const req=getMasteryRequirements(rank); if(!req||!meets(stage,req))return{state:next,masteryAdvanced:advances,rankAdvancedTo:null};
  const promoted=NEXT[rank as Exclude<MasteryRank,'grandmaster'>]; next={...next,mastery:{rank:promoted,stage:{...ZERO_STAGE}}}; return{state:next,masteryAdvanced:true,rankAdvancedTo:promoted};
}

export function recordMasteryEligibleDailyWin(state:MetaSave,dateKey:string):MasteryResult {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))throw new Error('Mastery Daily date must be valid.');
  if(state.futurePrestige.onTimeDailyDates.includes(dateKey))return{state,masteryAdvanced:false,rankAdvancedTo:null};
  const rank=state.mastery.rank; const stage:MasteryStageProgress={...state.mastery.stage,anyWins:state.mastery.stage.anyWins+(rank==='novice'?1:0),onTimeDailyWins:state.mastery.stage.onTimeDailyWins+(rank==='expert'||rank==='master'?1:0)};
  const advanced=stage.anyWins!==state.mastery.stage.anyWins||stage.onTimeDailyWins!==state.mastery.stage.onTimeDailyWins;
  let next:MetaSave={...state,mastery:{rank,stage},futurePrestige:{...state.futurePrestige,onTimeDailyDates:unique(state.futurePrestige.onTimeDailyDates,dateKey)}};
  const req=getMasteryRequirements(rank);if(!req||!meets(stage,req))return{state:next,masteryAdvanced:advanced,rankAdvancedTo:null};
  const promoted=NEXT[rank as Exclude<MasteryRank,'grandmaster'>];next={...next,mastery:{rank:promoted,stage:{...ZERO_STAGE}}};return{state:next,masteryAdvanced:true,rankAdvancedTo:promoted};
}
