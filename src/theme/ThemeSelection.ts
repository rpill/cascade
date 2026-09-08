import type { ThemeId } from './ThemeDefinition.ts';
import { DEFAULT_THEME_ID, isThemeId } from './ThemeRegistry.ts';

export function resolveThemeId(
  search: string,
  persistedThemeId: string | null = null,
): ThemeId {
  const previewId = new URLSearchParams(search).get('theme');

  if (isThemeId(previewId)) {
    return previewId;
  }

  if (isThemeId(persistedThemeId)) {
    return persistedThemeId;
  }

  return DEFAULT_THEME_ID;
}
