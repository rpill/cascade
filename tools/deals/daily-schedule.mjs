export const DAILY_BANDS = Object.freeze({
  1: Object.freeze([0, 15]),
  2: Object.freeze([10, 30]),
  3: Object.freeze([25, 45]),
  4: Object.freeze([40, 60]),
  5: Object.freeze([55, 72]),
  6: Object.freeze([68, 85]),
  0: Object.freeze([80, 95]),
});

const MAX_UINT32 = 0xffff_ffff;
const DAY_MS = 86_400_000;

function assertPositiveUint32(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_UINT32) {
    throw new RangeError(`${label} must be a positive uint32, got ${String(value)}`);
  }
}

function parseDailyId(dailyId) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) throw new Error(`Invalid dailyId: ${String(dailyId)}`);
  const millis = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== dailyId) {
    throw new Error(`Invalid dailyId: ${String(dailyId)}`);
  }
  return millis;
}

function xorshift32(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function shuffled(records, seed) {
  const copy = [...records].sort((left, right) => left.seed - right.seed);
  const random = xorshift32(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = random() % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function bandSeed(shuffleSeed, weekday) {
  return (Number(shuffleSeed) ^ Math.imul(weekday + 1, 0x9e3779b9)) >>> 0;
}

export function generateDailySchedule(records, {
  startDailyId = '2026-01-01',
  length = 36_525,
  shuffleSeed = 0x43415343,
} = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Number.isInteger(length) || length < 1) throw new RangeError(`length must be >= 1, got ${String(length)}`);
  if (!Number.isInteger(shuffleSeed) || shuffleSeed < 0 || shuffleSeed > MAX_UINT32) {
    throw new RangeError(`shuffleSeed must be a uint32, got ${String(shuffleSeed)}`);
  }

  const seenSeeds = new Set();
  const normalized = records.map((record) => {
    assertPositiveUint32(record?.seed, 'Daily candidate seed');
    if (seenSeeds.has(record.seed)) throw new Error(`Duplicate seed in Daily candidates: ${record.seed}`);
    seenSeeds.add(record.seed);
    const difficultyScore = Number(record.difficultyScore);
    if (!Number.isFinite(difficultyScore) || difficultyScore < 0 || difficultyScore > 100) {
      throw new RangeError(`Invalid difficultyScore for seed ${record.seed}: ${String(record.difficultyScore)}`);
    }
    return { ...record, difficultyScore };
  });

  const queues = {};
  const cursors = {};
  for (const [weekdayText, [low, high]] of Object.entries(DAILY_BANDS)) {
    const weekday = Number(weekdayText);
    queues[weekday] = shuffled(
      normalized.filter((record) => record.difficultyScore >= low && record.difficultyScore <= high && record.difficultyScore <= 95),
      bandSeed(shuffleSeed, weekday),
    );
    cursors[weekday] = 0;
  }

  const startMillis = parseDailyId(startDailyId);
  const used = new Set();
  const schedule = [];

  for (let offset = 0; offset < length; offset += 1) {
    const millis = startMillis + offset * DAY_MS;
    const date = new Date(millis);
    const dailyId = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const [low, high] = DAILY_BANDS[weekday];
    const queue = queues[weekday];
    let cursor = cursors[weekday];

    while (cursor < queue.length && used.has(queue[cursor].seed)) cursor += 1;
    if (cursor >= queue.length) {
      throw new Error(`Insufficient Daily candidates for ${dailyId} weekday=${weekday} band=${low}..${high}`);
    }

    const selected = queue[cursor];
    cursors[weekday] = cursor + 1;
    used.add(selected.seed);
    schedule.push({ dailyId, seed: selected.seed, difficultyScore: selected.difficultyScore });
  }

  return schedule;
}
