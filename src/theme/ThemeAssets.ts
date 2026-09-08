import { SUITS } from '../game/model/types.ts';
import type { ThemeAssetRef, ThemeDefinition } from './ThemeDefinition.ts';
import { createSlotFrameSvg, createSlotGlyphSvg, type SlotRole } from './SlotArtwork.ts';

const svgAsset = (key: string, svg: string): ThemeAssetRef => ({
  key, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
});

/** Neutral paper edges belong to the shared card faces, never the back ornament. */
export const STOCK_EDGE_ASSET = svgAsset('cascade-stock-paper-edge',
  '<svg xmlns="http://www.w3.org/2000/svg" width="432" height="604" viewBox="0 0 216 302"><defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="#f1e4bd"/><stop offset="1" stop-color="#d9c897"/></linearGradient></defs><rect x=".5" y=".5" width="215" height="301" rx="5" fill="url(#paper)" stroke="#ac9668" stroke-width="1"/></svg>');

export function getSlotFrameAsset(theme: ThemeDefinition): ThemeAssetRef {
  return theme.slots.frame ?? svgAsset(`${theme.id}-slot-frame`, createSlotFrameSvg(theme.slots.palette));
}

export function getSlotGlyphAsset(theme: ThemeDefinition, role: SlotRole): ThemeAssetRef | null {
  return role === 'tableau' ? null : svgAsset(`${theme.id}-glyph-${role}`,
    createSlotGlyphSvg(role, theme.slots.palette));
}

/** Complete bundle: surface, back, paper edge, frame and five separate glyphs. */
export function getThemeAssets(theme: ThemeDefinition): readonly ThemeAssetRef[] {
  return [theme.boardSurface, theme.cardBack, STOCK_EDGE_ASSET, getSlotFrameAsset(theme),
    ...[...SUITS, 'stock' as const].map(role => getSlotGlyphAsset(theme, role)!)];
}
