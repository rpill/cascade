import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';

export function getBoardTexture(theme: ThemeDefinition): string {
  return theme.boardSurface.key;
}
