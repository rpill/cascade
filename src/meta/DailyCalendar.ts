import { WINNABLE_SEEDS } from '../game/model/winnableSeeds.ts';
import { DAILY_ALGORITHM_VERSION } from './MetaSave.ts';

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

function stableHash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getDailySeed(
  dailyId: string,
  algorithmVersion: number = DAILY_ALGORITHM_VERSION,
  pool: readonly bigint[] = WINNABLE_SEEDS,
): bigint {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyId)) {
    throw new Error('Invalid Daily ID.');
  }
  if (pool.length === 0) {
    throw new Error('Daily seed pool is empty.');
  }

  const index = stableHash32(`${algorithmVersion}:${dailyId}`) % pool.length;
  return pool[index];
}
