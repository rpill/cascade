const DAY_MS = 86_400_000;

function dateAtOffset(dateKey: string, delta: number): string {
  const timestamp = Date.parse(`${dateKey}T00:00:00Z`) + delta * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export interface DailyStreakSummary {
  readonly current: number;
  readonly best: number;
}

export function getDailyStreaks(
  records: Record<string, { readonly completedOnTime: boolean }>,
  todayKey: string,
): DailyStreakSummary {
  const currentAnchor = records[todayKey]?.completedOnTime ? todayKey : dateAtOffset(todayKey, -1);
  let current = 0;
  for (let offset = 0; offset < 10_000; offset += 1) {
    if (!records[dateAtOffset(currentAnchor, -offset)]?.completedOnTime) break;
    current += 1;
  }

  const completed = Object.entries(records)
    .filter(([, record]) => record.completedOnTime)
    .map(([dateKey]) => dateKey)
    .sort();
  let best = 0;
  let running = 0;
  let previous: string | null = null;
  for (const dateKey of completed) {
    running = previous !== null && dateAtOffset(previous, 1) === dateKey ? running + 1 : 1;
    best = Math.max(best, running);
    previous = dateKey;
  }
  return { current, best };
}
