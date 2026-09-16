import {
  closeSync,
  createReadStream,
  existsSync,
  openSync,
  readSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DAILY_BANDS, generateDailySchedule } from './daily-schedule.mjs';
import {
  isOnboardingCandidate,
  partitionStandard,
  scorePopulation,
  standardQuotasForTotal,
} from './difficulty.mjs';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = Object.freeze({
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
});

function parseJsonLine(line, filePath, lineNumber) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid candidate JSONL at ${filePath}:${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

class CandidateSnapshot {
  constructor(filePath, snapshotSize) {
    this.filePath = filePath;
    this.snapshotSize = snapshotSize;
    this.records = [];
    this.scannedCount = 0;
    this.ignoredTrailingBytes = 0;
    this.proofLocations = new Map();
    this.fileDescriptor = null;
  }

  readProof(seed) {
    const location = this.proofLocations.get(seed);
    if (!location) throw new Error(`Missing proof location for seed ${seed} in ${this.filePath}`);
    if (this.fileDescriptor === null) this.fileDescriptor = openSync(this.filePath, 'r');

    const buffer = Buffer.allocUnsafe(location.byteLength);
    let totalRead = 0;
    while (totalRead < buffer.length) {
      const bytesRead = readSync(
        this.fileDescriptor,
        buffer,
        totalRead,
        buffer.length - totalRead,
        location.offset + totalRead,
      );
      if (bytesRead === 0) throw new Error(`Unexpected EOF while reading proof for seed ${seed} from ${this.filePath}`);
      totalRead += bytesRead;
    }

    const record = parseJsonLine(buffer.toString('utf8'), this.filePath, location.lineNumber);
    if (record?.seed !== seed || !Array.isArray(record?.proof)) {
      throw new Error(`Invalid proof record for seed ${seed} at ${this.filePath}:${location.lineNumber}`);
    }
    return record.proof;
  }

  close() {
    if (this.fileDescriptor !== null) {
      closeSync(this.fileDescriptor);
      this.fileDescriptor = null;
    }
  }
}

export async function openCandidateSnapshot(filePath) {
  if (!existsSync(filePath)) throw new Error(`Candidate JSONL does not exist: ${filePath}`);
  const snapshotSize = statSync(filePath).size;
  const snapshot = new CandidateSnapshot(filePath, snapshotSize);
  if (snapshotSize === 0) return snapshot;

  const input = createReadStream(filePath, { start: 0, end: snapshotSize - 1 });
  let carry = Buffer.alloc(0);
  let carryOffset = 0;
  let lineNumber = 0;

  for await (const chunk of input) {
    const data = carry.length > 0 ? Buffer.concat([carry, chunk]) : chunk;
    const dataOffset = carryOffset;
    let cursor = 0;
    let newlineIndex;

    while ((newlineIndex = data.indexOf(0x0a, cursor)) !== -1) {
      const lineBuffer = data.subarray(cursor, newlineIndex);
      lineNumber += 1;
      cursor = newlineIndex + 1;
      if (lineBuffer.length === 0) continue;

      const record = parseJsonLine(lineBuffer.toString('utf8'), filePath, lineNumber);
      snapshot.scannedCount += 1;
      if (record?.status !== 'SOLVED' || record?.verification?.ok !== true || !Array.isArray(record?.proof)) continue;

      snapshot.proofLocations.set(record.seed, {
        offset: dataOffset + cursor - lineBuffer.length - 1,
        byteLength: lineBuffer.length,
        lineNumber,
      });
      const seed = record.seed;
      const compact = { ...record };
      delete compact.proof;
      Object.defineProperty(compact, 'proof', {
        enumerable: false,
        configurable: true,
        get: () => snapshot.readProof(seed),
      });
      snapshot.records.push(compact);
    }

    carry = Buffer.from(data.subarray(cursor));
    carryOffset = dataOffset + cursor;
  }

  // The generator appends one JSON object plus "\n" at a time. If our file-size
  // snapshot lands in the middle of that append, the unterminated tail is simply
  // outside this read-only snapshot and will be picked up by a later probe.
  snapshot.ignoredTrailingBytes = carry.length;
  return snapshot;
}

export function scaledStandardQuotas(total) {
  return standardQuotasForTotal(total);
}

function scoreRange(records) {
  if (!records || records.length === 0) return null;
  const scores = records.map((record) => Number(record.difficultyScore));
  return { min: Math.min(...scores), max: Math.max(...scores) };
}

export function analyzeStandardScored(scored, quotas) {
  const target = Object.values(quotas).reduce((sum, value) => sum + value, 0);
  const eligible = scored.filter((record) => Number(record.difficultyScore) <= 95);
  const onboardingEligible = eligible.filter(isOnboardingCandidate).length;
  let partitions = null;
  let reason = null;

  try {
    partitions = partitionStandard(scored, quotas);
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }

  return {
    ready: partitions !== null,
    verified: scored.length,
    target,
    quotas: { ...quotas },
    eligibleAtOrBelow95: eligible.length,
    onboardingEligible,
    selected: partitions ? Object.values(partitions).reduce((sum, records) => sum + records.length, 0) : 0,
    selectedScoreRanges: partitions ? Object.fromEntries(
      Object.entries(partitions).map(([tier, records]) => [tier, scoreRange(records)]),
    ) : null,
    reason,
  };
}

function parseDailyStart(startDailyId) {
  if (typeof startDailyId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(startDailyId)) {
    throw new Error(`Invalid daily start: ${String(startDailyId)}`);
  }
  const millis = Date.parse(`${startDailyId}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== startDailyId) {
    throw new Error(`Invalid daily start: ${startDailyId}`);
  }
  return millis;
}

function requiredDailyByWeekday(startDailyId, length) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const start = parseDailyStart(startDailyId);
  for (let offset = 0; offset < length; offset += 1) {
    counts[new Date(start + offset * DAY_MS).getUTCDay()] += 1;
  }
  return counts;
}

export function analyzeDailyScored(scored, { startDailyId, length }) {
  const requiredByWeekday = requiredDailyByWeekday(startDailyId, length);
  const bandCandidatesByWeekday = {};
  for (const [weekdayText, [low, high]] of Object.entries(DAILY_BANDS)) {
    bandCandidatesByWeekday[weekdayText] = scored.filter(
      (record) => record.difficultyScore >= low && record.difficultyScore <= high && record.difficultyScore <= 95,
    ).length;
  }

  let schedule = null;
  let reason = null;
  try {
    schedule = generateDailySchedule(scored, { startDailyId, length });
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }

  return {
    ready: schedule !== null,
    verified: scored.length,
    target: length,
    startDailyId,
    requiredByWeekday,
    bandCandidatesByWeekday,
    selected: schedule?.length ?? 0,
    reason,
  };
}

export async function probeDealPools({
  root = process.cwd(),
  standardTotal = 25_000,
  dailyDays = 7_305,
  dailyStart = '2026-01-01',
  onStage = () => {},
} = {}) {
  const standardPath = path.join(root, 'artifacts', 'deals', 'standard', 'candidates.jsonl');
  const dailyPath = path.join(root, 'artifacts', 'deals', 'daily', 'candidates.jsonl');
  const quotas = scaledStandardQuotas(standardTotal);

  onStage('Reading Standard snapshot...');
  const standardSnapshot = await openCandidateSnapshot(standardPath);
  let standard;
  try {
    onStage(`Scoring ${standardSnapshot.records.length} verified Standard candidates...`);
    const scored = scorePopulation(standardSnapshot.records);
    standard = {
      ...analyzeStandardScored(scored, quotas),
      snapshotScanned: standardSnapshot.scannedCount,
      snapshotBytes: standardSnapshot.snapshotSize,
      ignoredTrailingBytes: standardSnapshot.ignoredTrailingBytes,
    };
  } finally {
    standardSnapshot.close();
  }

  onStage('Reading Daily snapshot...');
  const dailySnapshot = await openCandidateSnapshot(dailyPath);
  let daily;
  try {
    onStage(`Scoring ${dailySnapshot.records.length} verified Daily candidates...`);
    const scored = scorePopulation(dailySnapshot.records);
    daily = {
      ...analyzeDailyScored(scored, { startDailyId: dailyStart, length: dailyDays }),
      snapshotScanned: dailySnapshot.scannedCount,
      snapshotBytes: dailySnapshot.snapshotSize,
      ignoredTrailingBytes: dailySnapshot.ignoredTrailingBytes,
    };
  } finally {
    dailySnapshot.close();
  }

  return { standard, daily };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

export function probeResultExitCode(_result) {
  return 0;
}

function formatScoreRange(range) {
  return range ? `${range.min.toFixed(2)}..${range.max.toFixed(2)}` : 'n/a';
}

export function formatProbeReport({ standard, daily }) {
  const standardStatus = standard.ready ? 'READY' : 'NOT_READY';
  const dailyStatus = daily.ready ? 'READY' : 'NOT_READY';
  const weekdayLines = Object.keys(WEEKDAY_NAMES)
    .map(Number)
    .sort((a, b) => a - b)
    .map((weekday) => {
      const [low, high] = DAILY_BANDS[weekday];
      return `${WEEKDAY_NAMES[weekday]} band=${low}..${high} required=${daily.requiredByWeekday[weekday]} candidates=${daily.bandCandidatesByWeekday[weekday]}`;
    });

  return [
    'STANDARD',
    `snapshot scanned=${standard.snapshotScanned} verified=${standard.verified} size=${formatBytes(standard.snapshotBytes)} trailingIgnored=${standard.ignoredTrailingBytes}`,
    `target=${standard.target} onboarding=${standard.quotas.onboarding} easy=${standard.quotas.easy} medium=${standard.quotas.medium} hard=${standard.quotas.hard}`,
    `eligible<=95=${standard.eligibleAtOrBelow95} onboardingEligible=${standard.onboardingEligible}/${standard.quotas.onboarding}`,
    ...(standard.selectedScoreRanges ? [
      `selectedScoreRanges onboarding=${formatScoreRange(standard.selectedScoreRanges.onboarding)} easy=${formatScoreRange(standard.selectedScoreRanges.easy)} medium=${formatScoreRange(standard.selectedScoreRanges.medium)} hard=${formatScoreRange(standard.selectedScoreRanges.hard)}`,
    ] : []),
    `status=${standardStatus}${standard.reason ? ` reason=${standard.reason}` : ''}`,
    '',
    'DAILY',
    `snapshot scanned=${daily.snapshotScanned} verified=${daily.verified} size=${formatBytes(daily.snapshotBytes)} trailingIgnored=${daily.ignoredTrailingBytes}`,
    `target=${daily.target} start=${daily.startDailyId}`,
    ...weekdayLines,
    `status=${dailyStatus}${daily.reason ? ` reason=${daily.reason}` : ''}`,
  ].join('\n');
}

function parseIntegerOption(options, key, fallback, minimum = 1) {
  const raw = options[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`--${key} must be an integer >= ${minimum}`);
  return value;
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument near ${String(key)}`);
    options[key.slice(2)] = value;
  }
  return options;
}

async function main(argv) {
  const options = parseCliOptions(argv);
  const result = await probeDealPools({
    standardTotal: parseIntegerOption(options, 'standard-total', 25_000, 4),
    dailyDays: parseIntegerOption(options, 'daily-days', 7_305),
    dailyStart: options['daily-start'] ?? '2026-01-01',
    onStage: (message) => process.stdout.write(`[probe] ${message}\n`),
  });
  process.stdout.write(`${formatProbeReport(result)}\n`);
  process.exitCode = probeResultExitCode(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
