import type { Language } from '../../settings/Preferences.ts';

export function formatDailyDateLabel(dateKey: string, language: Language): string {
  const timestamp = Date.parse(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return dateKey;
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}
