import { getThemeProduct } from '../theme/ThemeCatalog.ts';
import { isThemeId } from '../theme/ThemeRegistry.ts';
import { MAX_ECONOMY_VALUE, type MetaSave } from './MetaSave.ts';
import { getLevelProgress } from './Progression.ts';

export interface RewardLine { readonly label: string; readonly xp: number; readonly coins: number }
export interface RewardSummary { readonly xp: number; readonly coins: number; readonly level: number; readonly lines: readonly RewardLine[]; readonly pending?: boolean }
export const WIN_REWARDS = {winnable:{xp:100,coins:25},original:{xp:120,coins:30},daily:{xp:150,coins:75}} as const;
export const WEEK_REWARDS: Readonly<Record<number,number>> = {3:75,5:150,7:250};

export function purchaseTheme(state: MetaSave, themeId: string): MetaSave {
  const product = getThemeProduct(themeId);
  if (!product || state.collection.ownedThemes.includes(themeId) || state.progression.coins < product.price) return state;
  return {...state, progression:{...state.progression,coins:state.progression.coins-product.price},
    collection:{...state.collection,ownedThemes:[...state.collection.ownedThemes,themeId]}};
}

export function equipTheme(state: MetaSave, themeId: string): MetaSave {
  return isThemeId(themeId) && state.collection.ownedThemes.includes(themeId)
    ? {...state,equipped:{...state.equipped,theme:themeId}} : state;
}

export function awardLines(state: MetaSave, lines: readonly RewardLine[]): {state:MetaSave; reward:RewardSummary} {
  const awarded = [...lines];
  const xp = Math.min(MAX_ECONOMY_VALUE-state.progression.totalXp, lines.reduce((sum,line)=>sum+line.xp,0));
  const totalXp = state.progression.totalXp + xp;
  const level = getLevelProgress(totalXp).level;
  const levels = level - getLevelProgress(state.progression.totalXp).level;
  if (levels > 0) awarded.push({label:levels === 1 ? 'Новый уровень' : `Новые уровни ×${levels}`,xp:0,coins:levels*50});
  const coins = Math.min(MAX_ECONOMY_VALUE-state.progression.coins, awarded.reduce((sum,line)=>sum+line.coins,0));
  return {state:{...state,progression:{...state.progression,totalXp,coins:state.progression.coins+coins}},reward:{xp,coins,level,lines:awarded}};
}
