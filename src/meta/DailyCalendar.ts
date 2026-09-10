import type { VerifiedDealCatalog } from '../game/model/VerifiedDealCatalog.ts';

const DAY_MS = 86_400_000;

export function getDailyId(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function startOfIsoWeekUtc(timestampMs: number): number {
  const date = new Date(timestampMs);
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const day = new Date(utcMidnight).getUTCDay() || 7;
  return utcMidnight - (day - 1) * DAY_MS;
}

export function getIsoWeekId(timestampMs: number): string {
  const monday = startOfIsoWeekUtc(timestampMs);
  const thursday = monday + 3 * DAY_MS;
  const weekYear = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(weekYear, 0, 4);
  const week1Monday = startOfIsoWeekUtc(jan4);
  const week = Math.floor((monday - week1Monday) / (7 * DAY_MS)) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function getIsoWeekDailyIds(timestampMs: number): readonly string[] {
  const monday = startOfIsoWeekUtc(timestampMs);
  return Array.from({ length: 7 }, (_, index) =>
    getDailyId(monday + index * DAY_MS),
  );
}

function parseDailyIdUtc(dailyId: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) {
    throw new Error(`Invalid Daily ID: ${dailyId}`);
  }
  const millis = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== dailyId) {
    throw new Error(`Invalid Daily ID: ${dailyId}`);
  }
  return millis;
}

export function getDailySeed(
  dailyId: string,
  catalog: VerifiedDealCatalog,
): bigint {
  const target = parseDailyIdUtc(dailyId);
  const startId = catalog.metadata.dailyScheduleStart;
  const start = parseDailyIdUtc(startId);
  const delta = target - start;
  const offset = delta / DAY_MS;

  if (!Number.isInteger(offset)) {
    throw new Error(`Daily ID ${dailyId} does not map to an exact UTC schedule day.`);
  }
  if (offset < 0) {
    throw new RangeError(`Daily ID ${dailyId} is before verified schedule start ${startId}.`);
  }
  if (offset >= catalog.metadata.dailyScheduleLength) {
    throw new RangeError(`Daily ID ${dailyId} is after verified schedule range.`);
  }

  return catalog.getDailySeedByOffset(offset);
}
