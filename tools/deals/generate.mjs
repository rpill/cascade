import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createDealForMode } from '../../src/game/model/deal.ts';
import { buildVerifiedDealAsset, verifyProductionAssetHash } from './catalog-format.mjs';
import { DAILY_BANDS, generateDailySchedule } from './daily-schedule.mjs';
import { partitionStandard, scorePopulation, STANDARD_QUOTAS } from './difficulty.mjs';
import { solveSeed as defaultSolveSeed } from './solver-client.mjs';
import { verifyProofRecord as defaultVerifyProofRecord } from './verify-proof.mjs';

export const FAST_NODE_BUDGET = 250_000;
export const SLOW_NODE_BUDGET = 2_000_000;
export const STANDARD_SOURCE_START = 1;
export const DAILY_SOURCE_START = 1_000_000_001;
export const DAILY_SCHEDULE_START = '2026-01-01';
export const RELEASE_DAILY_DAYS = 36_525;
const MAX_UINT32 = 0xffff_ffff;
const DAY_MS = 86_400_000;
const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const GAME_RULE_SOURCE_FILES = Object.freeze([
  'src/game/model/cards.ts',
  'src/game/model/deal.ts',
  'src/game/model/OriginalRandom.ts',
  'src/game/model/SolitaireGame.ts',
  'src/game/model/types.ts',
]);

function assertPositiveUint32(value, label = 'seed') {
  if (!Number.isInteger(value) || value < 1 || value > MAX_UINT32) {
    throw new RangeError(`${label} must be a positive uint32, got ${String(value)}`);
  }
  return value;
}

function ensureParent(filePath) {
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function writeCheckpointAtomic(checkpointPath, checkpoint) {
  ensureParent(checkpointPath);
  const tempPath = `${checkpointPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  renameSync(tempPath, checkpointPath);
}

export function readCheckpoint(checkpointPath) {
  if (!existsSync(checkpointPath)) return null;
  const parsed = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (parsed?.version !== 1) throw new Error(`Unsupported generation checkpoint version: ${String(parsed?.version)}`);
  return parsed;
}

export function appendCandidate(outputPath, record) {
  ensureParent(outputPath);
  appendFileSync(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function* readJsonlLines(outputPath, { startOffset = 0, startLineNumber = 0 } = {}) {
  if (!existsSync(outputPath)) return;

  const input = createReadStream(outputPath, { start: startOffset });
  let carry = Buffer.alloc(0);
  let carryOffset = startOffset;
  let lineNumber = startLineNumber;

  for await (const chunk of input) {
    const data = carry.length > 0 ? Buffer.concat([carry, chunk]) : chunk;
    const dataOffset = carryOffset;
    let cursor = 0;
    let newlineIndex;

    while ((newlineIndex = data.indexOf(0x0a, cursor)) !== -1) {
      const lineBuffer = data.subarray(cursor, newlineIndex);
      lineNumber += 1;
      yield {
        line: lineBuffer.toString('utf8'),
        lineNumber,
        offset: dataOffset + cursor,
        byteLength: lineBuffer.length,
      };
      cursor = newlineIndex + 1;
    }

    carry = Buffer.from(data.subarray(cursor));
    carryOffset = dataOffset + cursor;
  }

  if (carry.length > 0) {
    lineNumber += 1;
    yield {
      line: carry.toString('utf8'),
      lineNumber,
      offset: carryOffset,
      byteLength: carry.length,
    };
  }
}

function parseCandidateLine(line, outputPath, lineNumber) {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid candidate JSONL at ${outputPath}:${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readOutputSeeds(outputPath) {
  const seeds = new Set();
  for await (const { line, lineNumber } of readJsonlLines(outputPath)) {
    const record = parseCandidateLine(line, outputPath, lineNumber);
    if (record) seeds.add(record.seed);
  }
  return seeds;
}

function freshCheckpoint(startSeed, maxSeeds) {
  return {
    version: 1,
    startSeed,
    maxSeeds,
    nextSeed: startSeed,
    scannedCount: 0,
    acceptedCount: 0,
    rejectedVerificationCount: 0,
    unsolvableCount: 0,
    undeterminedCount: 0,
    unresolvedRetryQueue: [],
  };
}

function validateResume(checkpoint, startSeed, maxSeeds) {
  if (checkpoint.startSeed !== startSeed || checkpoint.maxSeeds !== maxSeeds) {
    throw new Error(
      `Checkpoint range mismatch: checkpoint start=${checkpoint.startSeed} max=${checkpoint.maxSeeds}; requested start=${startSeed} max=${maxSeeds}`,
    );
  }
}

async function solveFinalRecordSequential(seed, checkpoint, options) {
  const { solveSeed, fastBudget, slowBudget, checkpointPath } = options;
  let result;
  let usedBudget;
  const queued = checkpoint.unresolvedRetryQueue.includes(seed);

  if (queued) {
    usedBudget = slowBudget;
    result = await solveSeed({ seed, budget: usedBudget, solverPath: options.solverPath });
  } else {
    usedBudget = fastBudget;
    result = await solveSeed({ seed, budget: usedBudget, solverPath: options.solverPath });
    if (result.status === 'UNDETERMINED') {
      checkpoint.unresolvedRetryQueue.push(seed);
      writeCheckpointAtomic(checkpointPath, checkpoint);
      usedBudget = slowBudget;
      result = await solveSeed({ seed, budget: usedBudget, solverPath: options.solverPath });
    }
  }

  checkpoint.unresolvedRetryQueue = checkpoint.unresolvedRetryQueue.filter((queuedSeed) => queuedSeed !== seed);
  return { ...result, budget: usedBudget };
}

async function solveFastRecordIndependent(seed, options) {
  const result = await options.solveSeed({ seed, budget: options.fastBudget, solverPath: options.solverPath });
  return { ...result, budget: options.fastBudget };
}

async function solveSlowRecordIndependent(seed, options) {
  const result = await options.solveSeed({ seed, budget: options.slowBudget, solverPath: options.solverPath });
  return { ...result, budget: options.slowBudget };
}

async function makeCandidateRecord(seed, solved, verifyProofRecord) {
  let verification = null;
  let counter = 'none';
  if (solved.status === 'SOLVED') {
    verification = await verifyProofRecord(solved);
    counter = verification.ok ? 'accepted' : 'rejected';
  } else if (solved.status === 'UNSOLVABLE') {
    counter = 'unsolvable';
  } else {
    counter = 'undetermined';
  }

  const record = {
    seed,
    status: solved.status,
    nodes: solved.nodes,
    budget: solved.budget,
    ...(solved.status === 'SOLVED' ? { initialStockCount: createDealForMode('winnable', BigInt(seed)).stock.length } : {}),
    ...(solved.proof ? { proof: solved.proof } : {}),
    ...(verification ? { verification } : {}),
  };
  return { record, counter };
}

function applyCounter(checkpoint, counter) {
  if (counter === 'accepted') checkpoint.acceptedCount += 1;
  else if (counter === 'rejected') checkpoint.rejectedVerificationCount += 1;
  else if (counter === 'unsolvable') checkpoint.unsolvableCount += 1;
  else if (counter === 'undetermined') checkpoint.undeterminedCount += 1;
}

async function mapWithConcurrency(values, jobs, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

export async function scanRange({
  startSeed,
  maxSeeds,
  checkpointPath,
  outputPath,
  stopAfter = Number.POSITIVE_INFINITY,
  batchSize = 32,
  jobs = 1,
  solveSeed = defaultSolveSeed,
  verifyProofRecord = defaultVerifyProofRecord,
  fastBudget = FAST_NODE_BUDGET,
  slowBudget = SLOW_NODE_BUDGET,
  solverPath,
  knownOutputSeeds,
} = {}) {
  assertPositiveUint32(startSeed, 'startSeed');
  if (!Number.isSafeInteger(maxSeeds) || maxSeeds < 1) throw new RangeError(`maxSeeds must be >= 1, got ${String(maxSeeds)}`);
  const endSeed = startSeed + maxSeeds - 1;
  assertPositiveUint32(endSeed, 'endSeed');
  if (!checkpointPath || !outputPath) throw new Error('checkpointPath and outputPath are required');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new RangeError(`batchSize must be >= 1, got ${String(batchSize)}`);
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new RangeError(`jobs must be >= 1, got ${String(jobs)}`);

  const checkpoint = readCheckpoint(checkpointPath) ?? freshCheckpoint(startSeed, maxSeeds);
  validateResume(checkpoint, startSeed, maxSeeds);
  const outputSeeds = knownOutputSeeds ?? await readOutputSeeds(outputPath);

  // Recover from a crash after JSONL append but before checkpoint replacement.
  while (checkpoint.nextSeed <= endSeed && outputSeeds.has(checkpoint.nextSeed)) {
    checkpoint.nextSeed += 1;
    checkpoint.scannedCount += 1;
  }

  let completedThisRun = 0;
  let sinceCheckpoint = 0;

  const drainParallelRetryQueue = async () => {
    while (checkpoint.unresolvedRetryQueue.length > 0 && completedThisRun < stopAfter) {
      const remaining = Number.isFinite(stopAfter) ? stopAfter - completedThisRun : jobs;
      const retrySeeds = checkpoint.unresolvedRetryQueue.slice(0, Math.min(jobs, remaining));
      const settled = await Promise.allSettled(retrySeeds.map(async (seed) => {
        const solved = await solveSlowRecordIndependent(seed, { solveSeed, slowBudget, solverPath });
        return makeCandidateRecord(seed, solved, verifyProofRecord);
      }));

      let firstError = null;
      for (let index = 0; index < retrySeeds.length; index += 1) {
        const seed = retrySeeds[index];
        const outcome = settled[index];
        if (outcome.status === 'rejected') {
          firstError ??= outcome.reason;
          continue;
        }
        const { record, counter } = outcome.value;
        applyCounter(checkpoint, counter);
        if (!outputSeeds.has(seed)) {
          appendCandidate(outputPath, record);
          outputSeeds.add(seed);
        }
        checkpoint.unresolvedRetryQueue = checkpoint.unresolvedRetryQueue.filter((queuedSeed) => queuedSeed !== seed);
        checkpoint.scannedCount += 1;
        completedThisRun += 1;
      }
      writeCheckpointAtomic(checkpointPath, checkpoint);
      if (firstError) throw firstError;
    }
  };

  // Preserve interrupted slow retries before scanning fresh seeds.
  if (jobs === 1) {
    while (checkpoint.unresolvedRetryQueue.length > 0 && completedThisRun < stopAfter) {
      const seed = checkpoint.unresolvedRetryQueue[0];
      const solved = await solveFinalRecordSequential(seed, checkpoint, {
        solveSeed, fastBudget, slowBudget, checkpointPath, solverPath,
      });
      const { record, counter } = await makeCandidateRecord(seed, solved, verifyProofRecord);
      applyCounter(checkpoint, counter);
      if (!outputSeeds.has(seed)) {
        appendCandidate(outputPath, record);
        outputSeeds.add(seed);
      }
      checkpoint.scannedCount += 1;
      checkpoint.nextSeed = Math.max(checkpoint.nextSeed, seed + 1);
      completedThisRun += 1;
      sinceCheckpoint += 1;
    }
  } else {
    await drainParallelRetryQueue();
  }

  if (jobs === 1) {
    while (checkpoint.nextSeed <= endSeed && completedThisRun < stopAfter) {
      const seed = checkpoint.nextSeed;
      const solved = await solveFinalRecordSequential(seed, checkpoint, {
        solveSeed, fastBudget, slowBudget, checkpointPath, solverPath,
      });
      const { record, counter } = await makeCandidateRecord(seed, solved, verifyProofRecord);
      applyCounter(checkpoint, counter);
      if (!outputSeeds.has(seed)) {
        appendCandidate(outputPath, record);
        outputSeeds.add(seed);
      }
      checkpoint.scannedCount += 1;
      checkpoint.nextSeed = seed + 1;
      completedThisRun += 1;
      sinceCheckpoint += 1;
      if (sinceCheckpoint >= batchSize) {
        writeCheckpointAtomic(checkpointPath, checkpoint);
        sinceCheckpoint = 0;
      }
    }
  } else {
    while (checkpoint.nextSeed <= endSeed && completedThisRun < stopAfter) {
      const remaining = Number.isFinite(stopAfter) ? stopAfter - completedThisRun : batchSize;
      const count = Math.min(batchSize, remaining, endSeed - checkpoint.nextSeed + 1);
      const seeds = Array.from({ length: count }, (_, index) => checkpoint.nextSeed + index);
      const fastResults = await mapWithConcurrency(seeds, jobs, (seed) =>
        solveFastRecordIndependent(seed, { solveSeed, fastBudget, solverPath }));

      for (let index = 0; index < seeds.length; index += 1) {
        const seed = seeds[index];
        const solved = fastResults[index];
        if (solved.status === 'UNDETERMINED') {
          if (!checkpoint.unresolvedRetryQueue.includes(seed)) checkpoint.unresolvedRetryQueue.push(seed);
          continue;
        }
        const { record, counter } = await makeCandidateRecord(seed, solved, verifyProofRecord);
        applyCounter(checkpoint, counter);
        if (!outputSeeds.has(seed)) {
          appendCandidate(outputPath, record);
          outputSeeds.add(seed);
        }
        checkpoint.scannedCount += 1;
        completedThisRun += 1;
      }

      checkpoint.nextSeed = seeds[seeds.length - 1] + 1;
      writeCheckpointAtomic(checkpointPath, checkpoint);
      sinceCheckpoint = 0;

      await drainParallelRetryQueue();
    }
  }

  writeCheckpointAtomic(checkpointPath, checkpoint);
  return checkpoint;
}

export async function readCandidateRecords(outputPath) {
  const records = [];
  for await (const { line, lineNumber } of readJsonlLines(outputPath)) {
    const record = parseCandidateLine(line, outputPath, lineNumber);
    if (record) records.push(record);
  }
  return records;
}

export async function acceptedCandidateRecords(outputPath) {
  const records = [];
  for await (const { line, lineNumber } of readJsonlLines(outputPath)) {
    const record = parseCandidateLine(line, outputPath, lineNumber);
    if (record?.status === 'SOLVED' && record?.verification?.ok === true && Array.isArray(record.proof)) records.push(record);
  }
  return records;
}

class CandidateStore {
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.records = [];
    this.seeds = new Set();
    this.proofLocations = new Map();
    this.byteOffset = 0;
    this.lineCount = 0;
    this.fileDescriptor = null;
  }

  async refresh() {
    if (!existsSync(this.outputPath)) return;
    const size = statSync(this.outputPath).size;
    if (size < this.byteOffset) throw new Error(`Candidate JSONL was truncated during generation: ${this.outputPath}`);
    if (size === this.byteOffset) return;

    for await (const entry of readJsonlLines(this.outputPath, {
      startOffset: this.byteOffset,
      startLineNumber: this.lineCount,
    })) {
      this.lineCount = entry.lineNumber;
      const record = parseCandidateLine(entry.line, this.outputPath, entry.lineNumber);
      if (!record) continue;
      this.seeds.add(record.seed);
      if (record.status !== 'SOLVED' || record?.verification?.ok !== true || !Array.isArray(record.proof)) continue;

      this.proofLocations.set(record.seed, {
        offset: entry.offset,
        byteLength: entry.byteLength,
        lineNumber: entry.lineNumber,
      });
      const compact = { ...record };
      delete compact.proof;
      Object.defineProperty(compact, 'proof', {
        enumerable: false,
        configurable: true,
        get: () => this.readProof(record.seed),
      });
      this.records.push(compact);
    }

    this.byteOffset = statSync(this.outputPath).size;
    if (this.fileDescriptor === null) this.fileDescriptor = openSync(this.outputPath, 'r');
  }

  readProof(seed) {
    const location = this.proofLocations.get(seed);
    if (!location) throw new Error(`Missing proof location for seed ${seed} in ${this.outputPath}`);
    if (this.fileDescriptor === null) this.fileDescriptor = openSync(this.outputPath, 'r');

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
      if (bytesRead === 0) throw new Error(`Unexpected EOF while reading proof for seed ${seed} from ${this.outputPath}`);
      totalRead += bytesRead;
    }

    const record = parseCandidateLine(buffer.toString('utf8'), this.outputPath, location.lineNumber);
    if (record?.seed !== seed || !Array.isArray(record?.proof)) {
      throw new Error(`Invalid proof record for seed ${seed} at ${this.outputPath}:${location.lineNumber}`);
    }
    return record.proof;
  }

  attachProof(record) {
    if (!record) return record;
    Object.defineProperty(record, 'proof', {
      enumerable: false,
      configurable: true,
      get: () => this.readProof(record.seed),
    });
    return record;
  }

  close() {
    if (this.fileDescriptor !== null) {
      closeSync(this.fileDescriptor);
      this.fileDescriptor = null;
    }
  }
}

async function openCandidateStore(outputPath) {
  const store = new CandidateStore(outputPath);
  await store.refresh();
  return store;
}

export function quotasForStandardTotal(total) {
  if (!Number.isSafeInteger(total) || total < 4) throw new RangeError(`standard-total must be >= 4, got ${String(total)}`);
  if (total === 50_000) return { ...STANDARD_QUOTAS };

  const releaseTotal = Object.values(STANDARD_QUOTAS).reduce((sum, value) => sum + value, 0);
  const rows = TIERS.map((tier, index) => {
    const exact = STANDARD_QUOTAS[tier] * total / releaseTotal;
    return { tier, index, exact, value: Math.floor(exact) };
  });
  let assigned = rows.reduce((sum, row) => sum + row.value, 0);
  for (const row of rows) {
    if (row.value === 0) {
      row.value = 1;
      assigned += 1;
    }
  }
  rows.sort((left, right) => (right.exact - Math.floor(right.exact)) - (left.exact - Math.floor(left.exact)) || left.index - right.index);
  while (assigned < total) {
    for (const row of rows) {
      if (assigned >= total) break;
      row.value += 1;
      assigned += 1;
    }
  }
  while (assigned > total) {
    for (const row of [...rows].reverse()) {
      if (assigned <= total) break;
      if (row.value > 1) {
        row.value -= 1;
        assigned -= 1;
      }
    }
  }
  return Object.fromEntries(rows.sort((a, b) => a.index - b.index).map((row) => [row.tier, row.value]));
}

function parseDailyId(dailyId) {
  if (typeof dailyId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) throw new Error(`Invalid daily ID: ${String(dailyId)}`);
  const millis = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== dailyId) throw new Error(`Invalid daily ID: ${dailyId}`);
  return millis;
}

export function validateReleaseData({ standard, dailySchedule, quotas, dailyDays, dailyScheduleStart }) {
  if (!standard || !Array.isArray(dailySchedule) || !quotas) throw new TypeError('standard, dailySchedule and quotas are required');
  const standardSeen = new Set();
  for (const tier of TIERS) {
    if (!Array.isArray(standard[tier])) throw new Error(`Missing Standard tier ${tier}`);
    if (standard[tier].length !== quotas[tier]) {
      throw new Error(`Standard ${tier} count mismatch: expected ${quotas[tier]}, got ${standard[tier].length}`);
    }
    for (const record of standard[tier]) {
      assertPositiveUint32(record.seed, `Standard ${tier} seed`);
      if (standardSeen.has(record.seed)) throw new Error(`Duplicate Standard seed ${record.seed}`);
      standardSeen.add(record.seed);
    }
  }

  if (dailySchedule.length !== dailyDays) {
    throw new Error(`Daily length mismatch: expected ${dailyDays}, got ${dailySchedule.length}`);
  }
  const startMillis = parseDailyId(dailyScheduleStart);
  const dailySeen = new Set();
  for (let index = 0; index < dailySchedule.length; index += 1) {
    const row = dailySchedule[index];
    assertPositiveUint32(row.seed, 'Daily seed');
    const expectedId = new Date(startMillis + index * DAY_MS).toISOString().slice(0, 10);
    if (row.dailyId !== expectedId) throw new Error(`Daily schedule date mismatch at offset ${index}: expected ${expectedId}, got ${String(row.dailyId)}`);
    const weekday = new Date(startMillis + index * DAY_MS).getUTCDay();
    const [low, high] = DAILY_BANDS[weekday];
    if (!Number.isFinite(row.difficultyScore) || row.difficultyScore < low || row.difficultyScore > high || row.difficultyScore > 95) {
      throw new Error(`Daily ${row.dailyId} seed ${row.seed} violates weekday band ${low}..${high} with score ${String(row.difficultyScore)}`);
    }
    if (dailySeen.has(row.seed)) throw new Error(`Duplicate Daily seed ${row.seed}`);
    if (standardSeen.has(row.seed)) throw new Error(`Standard/Daily seed overlap at ${row.seed}`);
    dailySeen.add(row.seed);
  }
  return true;
}

function standardSampleEntry(tier, record) {
  return {
    source: 'standard',
    tier,
    seed: record.seed,
    difficultyScore: record.difficultyScore,
  };
}

function dailySampleEntry(row) {
  return {
    source: 'daily',
    weekday: new Date(`${row.dailyId}T00:00:00Z`).getUTCDay(),
    dailyId: row.dailyId,
    seed: row.seed,
    difficultyScore: row.difficultyScore,
  };
}

export function selectProofSample({ standard, dailySchedule, dailyBySeed, target = 64 }) {
  if (!Number.isSafeInteger(target) || target < 64 || target > 128) throw new RangeError(`proof sample target must be 64..128, got ${String(target)}`);
  if (!(dailyBySeed instanceof Map)) throw new TypeError('dailyBySeed must be a Map');

  const standardBySeed = new Map();
  const groups = [];
  for (const tier of TIERS) {
    const entries = [...(standard[tier] ?? [])]
      .sort((left, right) => left.difficultyScore - right.difficultyScore || left.seed - right.seed)
      .map((record) => {
        standardBySeed.set(record.seed, record);
        return standardSampleEntry(tier, record);
      });
    if (entries.length === 0) throw new Error(`Cannot build proof sample: Standard tier ${tier} is empty`);
    groups.push(entries);
  }

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const entries = dailySchedule
      .filter((row) => new Date(`${row.dailyId}T00:00:00Z`).getUTCDay() === weekday)
      .sort((left, right) => left.dailyId.localeCompare(right.dailyId))
      .map((row) => dailySampleEntry(row));
    if (entries.length === 0) throw new Error(`Cannot build proof sample: Daily weekday ${weekday} is empty`);
    groups.push(entries);
  }

  const selected = [];
  const used = new Set();
  const cursors = new Array(groups.length).fill(0);
  while (selected.length < target) {
    let added = false;
    for (let groupIndex = 0; groupIndex < groups.length && selected.length < target; groupIndex += 1) {
      const group = groups[groupIndex];
      while (cursors[groupIndex] < group.length && used.has(group[cursors[groupIndex]].seed)) cursors[groupIndex] += 1;
      if (cursors[groupIndex] >= group.length) continue;
      const entry = group[cursors[groupIndex]++];
      used.add(entry.seed);
      selected.push(entry);
      added = true;
    }
    if (!added) break;
  }

  if (selected.length < target) throw new Error(`Cannot build proof sample: requested ${target}, only ${selected.length} unique fixtures available`);
  return selected.map((entry) => {
    const record = entry.source === 'standard' ? standardBySeed.get(entry.seed) : dailyBySeed.get(entry.seed);
    const proof = record?.proof;
    if (!Array.isArray(proof)) {
      const label = entry.source === 'daily' ? `Daily seed ${entry.seed}` : `Standard ${entry.tier} seed ${entry.seed}`;
      throw new Error(`Cannot build proof sample: missing proof for ${label}`);
    }
    return { ...entry, proof };
  });
}

function hashSourceFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(path.resolve(file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function checkpointRange(source, checkpoint) {
  return {
    source,
    startSeed: checkpoint.startSeed,
    maxSeeds: checkpoint.scannedCount,
  };
}

function releasePaths(root = process.cwd()) {
  return {
    standardCandidates: path.join(root, 'artifacts', 'deals', 'standard', 'candidates.jsonl'),
    standardCheckpoint: path.join(root, 'artifacts', 'deals', 'standard', 'checkpoint.json'),
    dailyCandidates: path.join(root, 'artifacts', 'deals', 'daily', 'candidates.jsonl'),
    dailyCheckpoint: path.join(root, 'artifacts', 'deals', 'daily', 'checkpoint.json'),
    binary: path.join(root, 'public', 'assets', 'deals', 'verified-deals.bin'),
    manifest: path.join(root, 'public', 'assets', 'deals', 'verified-deals-manifest.json'),
    sample: path.join(root, 'tests', 'fixtures', 'deals', 'verified-proof-sample.json'),
  };
}

function discardMaterializedProofs(records) {
  for (const record of records) {
    const descriptor = Object.getOwnPropertyDescriptor(record, 'proof');
    if (descriptor?.enumerable === true) delete record.proof;
  }
  return records;
}

function tryStandardPartitions(records, quotas) {
  if (records.length < Object.values(quotas).reduce((sum, value) => sum + value, 0)) return null;
  try {
    const scored = discardMaterializedProofs(scorePopulation(records));
    return partitionStandard(scored, quotas);
  } catch (error) {
    if (/cannot fill/iu.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

function tryDailySchedule(records, dailyScheduleStart, dailyDays) {
  if (records.length < dailyDays) return null;
  const scored = discardMaterializedProofs(scorePopulation(records));
  try {
    return { scored, schedule: generateDailySchedule(scored, { startDailyId: dailyScheduleStart, length: dailyDays }) };
  } catch (error) {
    if (/insufficient daily candidates/iu.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

export function emitReleaseCatalog({
  standard,
  dailyScored,
  dailySchedule,
  quotas,
  dailyDays,
  dailyScheduleStart,
  standardCheckpoint,
  dailyCheckpoint,
  output = releasePaths(),
  catalogVersion = 1,
  proofSampleTarget = 64,
}) {
  validateReleaseData({ standard, dailySchedule, quotas, dailyDays, dailyScheduleStart });

  const standardSeeds = Object.fromEntries(TIERS.map((tier) => [tier, standard[tier].map((record) => record.seed)]));
  const dailySeeds = dailySchedule.map((row) => row.seed);
  const audit = {
    catalogVersion,
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 2,
    solverSourceHash: hashSourceFiles(['tools/sawayama_solver.cpp']),
    gameRulesSourceHash: hashSourceFiles(GAME_RULE_SOURCE_FILES),
    fastNodeBudget: FAST_NODE_BUDGET,
    slowNodeBudget: SLOW_NODE_BUDGET,
    rejectedVerificationCount: (standardCheckpoint?.rejectedVerificationCount ?? 0) + (dailyCheckpoint?.rejectedVerificationCount ?? 0),
    crossPoolDuplicateCount: 0,
    sourceScanRanges: [
      ...(standardCheckpoint ? [checkpointRange('standard', standardCheckpoint)] : []),
      ...(dailyCheckpoint ? [checkpointRange('daily', dailyCheckpoint)] : []),
    ],
  };
  const asset = buildVerifiedDealAsset({ standard: standardSeeds, daily: dailySeeds, dailyScheduleStart, audit });
  verifyProductionAssetHash(asset.binary, asset.manifest);

  const dailyBySeed = new Map(dailyScored.map((record) => [record.seed, record]));
  const sample = selectProofSample({ standard, dailySchedule, dailyBySeed, target: proofSampleTarget });

  for (const targetPath of [output.binary, output.manifest, output.sample]) ensureParent(targetPath);
  const temp = {
    binary: `${output.binary}.tmp`,
    manifest: `${output.manifest}.tmp`,
    sample: `${output.sample}.tmp`,
  };
  try {
    writeFileSync(temp.binary, asset.binary);
    writeFileSync(temp.manifest, `${JSON.stringify(asset.manifest, null, 2)}\n`, 'utf8');
    writeFileSync(temp.sample, `${JSON.stringify(sample)}\n`, 'utf8');

    const reloadedBinary = readFileSync(temp.binary);
    const reloadedManifest = JSON.parse(readFileSync(temp.manifest, 'utf8'));
    verifyProductionAssetHash(reloadedBinary, reloadedManifest);
    if (reloadedManifest.verifiedCount !== Object.values(quotas).reduce((sum, value) => sum + value, 0) + dailyDays) {
      throw new Error('Final manifest verifiedCount does not match requested quotas');
    }
    const reloadedSample = JSON.parse(readFileSync(temp.sample, 'utf8'));
    if (reloadedSample.length !== proofSampleTarget) throw new Error('Final proof sample count mismatch');

    renameSync(temp.binary, output.binary);
    renameSync(temp.manifest, output.manifest);
    renameSync(temp.sample, output.sample);
  } finally {
    for (const tempPath of Object.values(temp)) rmSync(tempPath, { force: true });
  }

  return { manifest: asset.manifest, sample };
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

export async function generateReleaseCatalog({
  standardTotal = 50_000,
  dailyDays = RELEASE_DAILY_DAYS,
  jobs = 4,
  scanBatch = Math.max(256, jobs * 64),
  dailyScheduleStart = DAILY_SCHEDULE_START,
  proofSampleTarget = 64,
  root = process.cwd(),
  solveSeed = defaultSolveSeed,
  verifyProofRecord = defaultVerifyProofRecord,
} = {}) {
  const quotas = quotasForStandardTotal(standardTotal);
  const paths = releasePaths(root);
  const standardMaxSeeds = DAILY_SOURCE_START - STANDARD_SOURCE_START;
  const dailyMaxSeeds = MAX_UINT32 - DAILY_SOURCE_START + 1;

  const standardStore = await openCandidateStore(paths.standardCandidates);
  const dailyStore = await openCandidateStore(paths.dailyCandidates);
  let emitted;
  try {
    let standard = null;
    let daily = null;
    while (standard === null || daily === null) {
      if (standard === null) {
        standard = tryStandardPartitions(standardStore.records, quotas);
        if (standard === null) {
          const checkpoint = await scanRange({
            startSeed: STANDARD_SOURCE_START,
            maxSeeds: standardMaxSeeds,
            checkpointPath: paths.standardCheckpoint,
            outputPath: paths.standardCandidates,
            stopAfter: scanBatch,
            batchSize: scanBatch,
            jobs,
            solveSeed,
            verifyProofRecord,
            knownOutputSeeds: standardStore.seeds,
          });
          await standardStore.refresh();
          process.stdout.write(`[deals] standard scanned=${checkpoint.scannedCount} verified=${checkpoint.acceptedCount}\n`);
        }
      }

      if (daily === null) {
        daily = tryDailySchedule(dailyStore.records, dailyScheduleStart, dailyDays);
        if (daily === null) {
          const checkpoint = await scanRange({
            startSeed: DAILY_SOURCE_START,
            maxSeeds: dailyMaxSeeds,
            checkpointPath: paths.dailyCheckpoint,
            outputPath: paths.dailyCandidates,
            stopAfter: scanBatch,
            batchSize: scanBatch,
            jobs,
            solveSeed,
            verifyProofRecord,
            knownOutputSeeds: dailyStore.seeds,
          });
          await dailyStore.refresh();
          process.stdout.write(`[deals] daily scanned=${checkpoint.scannedCount} verified=${checkpoint.acceptedCount}\n`);
        }
      }
    }

    for (const tier of TIERS) for (const record of standard[tier]) standardStore.attachProof(record);
    for (const record of daily.scored) dailyStore.attachProof(record);

    const standardCheckpoint = readCheckpoint(paths.standardCheckpoint);
    const dailyCheckpoint = readCheckpoint(paths.dailyCheckpoint);
    emitted = emitReleaseCatalog({
      standard,
      dailyScored: daily.scored,
      dailySchedule: daily.schedule,
      quotas,
      dailyDays,
      dailyScheduleStart,
      standardCheckpoint,
      dailyCheckpoint,
      output: paths,
      proofSampleTarget,
    });
  } finally {
    standardStore.close();
    dailyStore.close();
  }

  const standardCount = Object.values(quotas).reduce((sum, value) => sum + value, 0);
  process.stdout.write(
    `standard onboarding=${quotas.onboarding} easy=${quotas.easy} medium=${quotas.medium} hard=${quotas.hard} total=${standardCount}\n`,
  );
  process.stdout.write(`daily length=${dailyDays} start=${dailyScheduleStart}\n`);
  process.stdout.write('crossPoolDuplicates=0\n');
  process.stdout.write(`rejectedVerification=${emitted.manifest.rejectedVerificationCount}\n`);
  process.stdout.write('status=READY_TO_SHIP\n');
  return emitted;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseCliOptions(process.argv.slice(2));
  generateReleaseCatalog({
    standardTotal: parseIntegerOption(options, 'standard-total', 50_000, 4),
    dailyDays: parseIntegerOption(options, 'daily-days', RELEASE_DAILY_DAYS),
    jobs: parseIntegerOption(options, 'jobs', 4),
    scanBatch: parseIntegerOption(options, 'scan-batch', undefined) ?? undefined,
    dailyScheduleStart: options['daily-start'] ?? DAILY_SCHEDULE_START,
    proofSampleTarget: parseIntegerOption(options, 'proof-sample', 64, 64),
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
