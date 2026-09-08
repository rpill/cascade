import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';

export function getBoardTexture(theme: ThemeDefinition): string {
  return theme.boardSurface.key;
}

export function getSurfaceTransform(
  mode: ThemeDefinition['surfaceScale'],
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
