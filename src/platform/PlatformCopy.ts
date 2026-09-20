export type LeaderboardAuthCopyKind = 'record' | 'result';

function isPikabuBuild(): boolean {
  return typeof import.meta.env === 'object'
    && import.meta.env.VITE_PLATFORM_TARGET?.trim().toLowerCase() === 'pikabu';
}

export function getLeaderboardAuthCopy(kind: LeaderboardAuthCopyKind = 'record'): string {
  if (isPikabuBuild()) {
    return kind === 'result'
      ? 'Войдите в аккаунт Пикабу, чтобы сохранить результат и увидеть своё место в таблице.'
      : 'Войдите в аккаунт Пикабу, чтобы сохранить рекорд и увидеть своё место в таблице.';
  }

  return kind === 'result'
    ? 'Войдите с Яндекс ID, чтобы сохранить результат и увидеть своё место в таблице.'
    : 'Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.';
}
