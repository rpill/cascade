import type { ThemeId } from './ThemeDefinition.ts';
import { isThemeId } from './ThemeRegistry.ts';

export const STARTUP_THEME_CACHE_KEY = 'cascadeStartupTheme';

interface ThemeStartupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ThemeStartupStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStartupThemeId(storage: ThemeStartupStorage | null = browserStorage()): ThemeId | null {
  try {
    const value = storage?.getItem(STARTUP_THEME_CACHE_KEY) ?? null;
    return isThemeId(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStartupThemeId(
  themeId: string,
  storage: ThemeStartupStorage | null = browserStorage(),
): void {
  try {
    if (!isThemeId(themeId)) return;
    storage?.setItem(STARTUP_THEME_CACHE_KEY, themeId);
  } catch {
    // Startup cache is only an optimization; cloud profile remains authoritative.
  }
}
