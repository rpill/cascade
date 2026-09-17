import type { GameAppearance } from '../appearance/GameAppearance.ts';

export function getBoardTexture(appearance: GameAppearance): string {
  return appearance.boardSurface.key;
}

export function getSurfaceTransform(
  mode: 'tile' | 'cover',
  width: number, height: number, textureWidth: number, textureHeight: number,
): { scale: number; x: number; y: number } {
  if (mode === 'tile') return { scale: 1, x: 0, y: 0 };
  const scale = Math.max(width / textureWidth, height / textureHeight);
  return {
    scale,
    x: (textureWidth - width / scale) / 2,
    y: (textureHeight - height / scale) / 2,
  };
}
