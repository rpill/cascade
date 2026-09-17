import type { GameAppearance, GameAssetRef } from './GameAppearance.ts';

const svgAsset = (key: string, svg: string): GameAssetRef => ({
  key,
  url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
});

/** Neutral paper edges belong to the shared card faces, never to cosmetics. */
export const STOCK_EDGE_ASSET = svgAsset(
  'cascade-stock-paper-edge',
  '<svg xmlns="http://www.w3.org/2000/svg" width="432" height="604" viewBox="0 0 216 302"><defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="#f1e4bd"/><stop offset="1" stop-color="#d9c897"/></linearGradient></defs><rect x=".5" y=".5" width="215" height="301" rx="5" fill="url(#paper)" stroke="#ac9668" stroke-width="1"/></svg>',
);

export function getGameAppearanceAssets(appearance: GameAppearance): readonly GameAssetRef[] {
  return [appearance.boardSurface, appearance.cardBack, STOCK_EDGE_ASSET];
}
