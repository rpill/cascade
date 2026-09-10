import test from 'node:test';
import assert from 'node:assert/strict';

import { DAILY_BANDS, generateDailySchedule } from '../tools/deals/daily-schedule.mjs';

function utcWeekday(dailyId) {
  return new Date(`${dailyId}T00:00:00Z`).getUTCDay();
}

test('Daily schedule is deterministic, unique, UTC-weekday banded, and excludes the top tail', () => {
  const records = Array.from({ length: 100 }, (_, score) => ({
    seed: 10_000 + score,
    difficultyScore: score,
  }));

  const options = { startDailyId: '2026-01-01', length: 21, shuffleSeed: 0x43415343 };
  const first = generateDailySchedule(records, options);
  const second = generateDailySchedule(records, options);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.length, 21);
  assert.equal(new Set(first.map((row) => row.seed)).size, 21);

  for (const row of first) {
    const weekday = utcWeekday(row.dailyId);
    const [low, high] = DAILY_BANDS[weekday];
    assert.ok(row.difficultyScore >= low && row.difficultyScore <= high, `${row.dailyId} score ${row.difficultyScore} must be in ${low}..${high}`);
    assert.ok(row.difficultyScore <= 95);
  }
});

test('Daily schedule output is independent of candidate input order', () => {
  const records = Array.from({ length: 100 }, (_, score) => ({ seed: score + 1, difficultyScore: score }));
  const reversed = [...records].reverse();
  const options = { startDailyId: '2026-02-01', length: 14, shuffleSeed: 12345 };
  assert.deepEqual(generateDailySchedule(records, options), generateDailySchedule(reversed, options));
});

test('Daily schedule throws with weekday and date context instead of falling outside the band', () => {
  const records = [
    { seed: 1, difficultyScore: 50 },
    { seed: 2, difficultyScore: 60 },
  ];

  assert.throws(
    () => generateDailySchedule(records, { startDailyId: '2026-01-05', length: 1, shuffleSeed: 1 }),
    /2026-01-05.*weekday=1.*0\.\.15/iu,
  );
});

test('Daily schedule validates unique positive uint32 candidates', () => {
  assert.throws(
    () => generateDailySchedule([
      { seed: 1, difficultyScore: 10 },
      { seed: 1, difficultyScore: 12 },
    ], { startDailyId: '2026-01-05', length: 1 }),
    /duplicate seed/iu,
  );
  assert.throws(
    () => generateDailySchedule([{ seed: 0, difficultyScore: 10 }], { startDailyId: '2026-01-05', length: 1 }),
    /positive uint32/iu,
  );
});
