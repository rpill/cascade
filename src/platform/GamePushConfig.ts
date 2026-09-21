export interface GamePushPublicConfig {
  readonly projectId: number;
  readonly publicToken: string;
}

const DEFAULT_PROJECT_ID = 30_632;
const DEFAULT_PUBLIC_TOKEN = 'c5GdZPx08oVCDei40pc5DJDx68TZDUEb';

export function resolveGamePushConfig(): GamePushPublicConfig {
  const env = typeof import.meta.env === 'object' ? import.meta.env : undefined;
  const rawProjectId = env?.VITE_GAMEPUSH_PROJECT_ID?.trim();
  const parsedProjectId = rawProjectId ? Number(rawProjectId) : DEFAULT_PROJECT_ID;
  const projectId = Number.isSafeInteger(parsedProjectId) && parsedProjectId > 0
    ? parsedProjectId
    : DEFAULT_PROJECT_ID;
  const publicToken = env?.VITE_GAMEPUSH_PUBLIC_TOKEN?.trim() || DEFAULT_PUBLIC_TOKEN;
  return { projectId, publicToken };
}
