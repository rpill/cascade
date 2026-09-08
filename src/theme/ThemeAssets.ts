import { SUITS } from '../game/model/types.ts';
import type { ThemeAssetRef, ThemeDefinition } from './ThemeDefinition.ts';
import { createSlotSvg, type SlotRole } from './SlotArtwork.ts';

export function getSlotAsset(theme: ThemeDefinition, role: SlotRole): ThemeAssetRef {
  if (theme.slots.kind === 'images') {
    const assets = theme.slots.assets;
    return role === 'stock' ? assets.stockFreeCell
      : role === 'tableau' ? assets.tableauEmpty : assets.foundations[role];
  }
  return {
    key: `${theme.id}-slot-${role}`,
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createSlotSvg(role, theme.slots.palette))}`,
  };
}

/** The boot loader and later collection selection use this same complete bundle. */
export function getThemeAssets(theme: ThemeDefinition): readonly ThemeAssetRef[] {
  return [theme.boardSurface, theme.cardBack,
    ...SUITS.map(suit => getSlotAsset(theme, suit)),
    getSlotAsset(theme, 'stock'), getSlotAsset(theme, 'tableau')];
}
