import { getTheme } from '../../theme/ThemeRegistry.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import type { CascadeThemesSnapshot } from '../bridge/CascadeProductBridge.ts';
import type { Language } from '../../settings/Preferences.ts';
import { t } from '../../localization/Localization.ts';

export interface ThemeCardViewModel {
  readonly id: ThemeId;
  readonly displayName: string;
  readonly description: string;
  readonly priceCoins: number;
  readonly owned: boolean;
  readonly active: boolean;
  readonly action: 'buy' | 'apply' | 'none';
  readonly boardSurface: string;
  readonly slotEdge: string;
  readonly slotHighlight: string;
}

export interface ThemesViewModel {
  readonly coins: number;
  readonly cards: readonly ThemeCardViewModel[];
}

export function buildThemesViewModel(snapshot: CascadeThemesSnapshot, _language: Language): ThemesViewModel {
  return {
    coins: snapshot.coins,
    cards: snapshot.cards.map((item) => {
      const theme = getTheme(item.id);
      const palette = theme.slots.palette;
      return {
        id: item.id,
        displayName: t(item.name),
        description: t(item.description),
        priceCoins: item.price,
        owned: item.owned,
        active: item.equipped,
        action: item.equipped ? 'none' : item.owned ? 'apply' : snapshot.ready && snapshot.coins >= item.price ? 'buy' : 'none',
        boardSurface: palette.recess,
        slotEdge: palette.edge,
        slotHighlight: palette.highlight,
      };
    }),
  };
}
