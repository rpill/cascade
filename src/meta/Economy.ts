import { getThemeProduct } from '../theme/ThemeCatalog.ts';
import { isThemeId } from '../theme/ThemeRegistry.ts';
import type { MasteryRank, MetaSave } from './MetaSave.ts';

export interface RewardLine { readonly label: string; readonly coins: number }
export interface RewardSummary {
  readonly coins: number;
  readonly lines: readonly RewardLine[];
  readonly rankAdvancedTo?: MasteryRank | null;
  readonly pending?: boolean;
}

export function purchaseTheme(state: MetaSave, themeId: string): MetaSave {
  const product = getThemeProduct(themeId);
  if (!product || state.collection.ownedThemes.includes(themeId) || state.progression.coins < product.price) return state;
  return {
    ...state,
    progression: { ...state.progression, coins: state.progression.coins - product.price },
    collection: { ...state.collection, ownedThemes: [...state.collection.ownedThemes, themeId] },
  };
}

export function equipTheme(state: MetaSave, themeId: string): MetaSave {
  return isThemeId(themeId) && state.collection.ownedThemes.includes(themeId)
    ? { ...state, equipped: { ...state.equipped, theme: themeId } }
    : state;
}

export function createRewardSummary(
  before: MetaSave,
  after: MetaSave,
  lines: readonly RewardLine[],
  rankAdvancedTo: MasteryRank | null = null,
): RewardSummary {
  return {
    coins: Math.max(0, after.progression.coins - before.progression.coins),
    lines: [...lines],
    ...(rankAdvancedTo === null ? {} : { rankAdvancedTo }),
  };
}
