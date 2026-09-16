import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { VerifiedDealCatalog } from '../../src/game/model/VerifiedDealCatalog.ts';
import { verifyProductionAssetHash } from './catalog-format.mjs';
import { DAILY_BANDS } from './daily-schedule.mjs';
import { scorePopulation } from './difficulty.mjs';
import { openCandidateSnapshot } from './probe.mjs';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const DAY_MS = 86_400_000;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function statusSummary(records) {
  const result = { scanned: records.length, solved: 0, unsolvable: 0, undetermined: 0, rejected: 0 };
  for (const record of records) {
    if (record.status === 'SOLVED') {
      result.solved += 1;
      if (record.verification?.ok !== true) result.rejected += 1;
    } else if (record.status === 'UNSOLVABLE') result.unsolvable += 1;
    else if (record.status === 'UNDETERMINED') result.undetermined += 1;
  }
  return result;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function scoreAccepted(records) {
  const accepted = records.filter((record) => record?.status === 'SOLVED'
    && record?.verification?.ok === true
    && Object.prototype.hasOwnProperty.call(record, 'proof'));
  return accepted.length > 0 ? scorePopulation(accepted) : [];
}

function scoreSummary(scored) {
  if (scored.length === 0) return null;
  const scores = scored.map((record) => record.difficultyScore).sort((a, b) => a - b);
  const values = [0, 0.25, 0.5, 0.75, 0.95, 1].map((fraction) => percentile(scores, fraction).toFixed(2));
  return `p0=${values[0]} p25=${values[1]} p50=${values[2]} p75=${values[3]} p95=${values[4]} p100=${values[5]}`;
}

function countCrossPoolDuplicates(standardSeeds, dailySeeds) {
  const standard = new Set(TIERS.flatMap((tier) => standardSeeds[tier] ?? []));
  let duplicates = 0;
  for (const seed of dailySeeds) if (standard.has(seed)) duplicates += 1;
  return duplicates;
}

function dailyBandSummary(manifest, dailySeeds, dailyScored) {
  if (dailyScored.length === 0) return 'dailyBandViolations=unavailable';
  const bySeed = new Map(dailyScored.map((record) => [record.seed, record.difficultyScore]));
  if (dailySeeds.some((seed) => !bySeed.has(seed))) return 'dailyBandViolations=unavailable';

  const start = Date.parse(`${manifest.dailyScheduleStart}T00:00:00Z`);
  let violations = 0;
  let above95 = 0;
  for (let index = 0; index < dailySeeds.length; index += 1) {
    const weekday = new Date(start + index * DAY_MS).getUTCDay();
    const [low, high] = DAILY_BANDS[weekday];
    const score = bySeed.get(dailySeeds[index]);
    if (score < low || score > high) violations += 1;
    if (score > 95) above95 += 1;
  }
  return `dailyBandViolations=${violations} dailyAbove95=${above95}`;
}

function checkpointStatus(checkpoint) {
  if (!checkpoint) return null;
  const accepted = Number(checkpoint.acceptedCount ?? 0);
  const rejected = Number(checkpoint.rejectedVerificationCount ?? 0);
  return {
    scanned: Number(checkpoint.scannedCount ?? 0),
    solved: accepted + rejected,
    unsolvable: Number(checkpoint.unsolvableCount ?? 0),
    undetermined: Number(checkpoint.undeterminedCount ?? 0),
    rejected,
  };
}

function readCheckpointStatus(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  return checkpointStatus(JSON.parse(readFileSync(filePath, 'utf8')));
}

export function buildDealReport({ manifest, standardSeeds, dailySeeds, standardCandidates = [], dailyCandidates = [], standardStatus = null, dailyStatus = null }) {
  const standardTotal = TIERS.reduce((sum, tier) => sum + (standardSeeds[tier]?.length ?? 0), 0);
  const crossPoolDuplicates = countCrossPoolDuplicates(standardSeeds, dailySeeds);
  const effectiveStandardStatus = standardStatus ?? statusSummary(standardCandidates);
  const effectiveDailyStatus = dailyStatus ?? statusSummary(dailyCandidates);
  const standardScored = scoreAccepted(standardCandidates);
  const dailyScored = scoreAccepted(dailyCandidates);
  const standardScores = scoreSummary(standardScored);
  const dailyScores = scoreSummary(dailyScored);
  const sourceRanges = Array.isArray(manifest.sourceScanRanges) && manifest.sourceScanRanges.length > 0
    ? manifest.sourceScanRanges.map((range) => `${range.source}:${range.startSeed}+${range.maxSeeds}`).join(',')
    : 'none';

  return [
    `standard onboarding=${standardSeeds.onboarding?.length ?? 0} easy=${standardSeeds.easy?.length ?? 0} medium=${standardSeeds.medium?.length ?? 0} hard=${standardSeeds.hard?.length ?? 0} total=${standardTotal}`,
    `daily length=${dailySeeds.length} start=${manifest.dailyScheduleStart}`,
    `verifiedCount=${manifest.verifiedCount}`,
    `crossPoolDuplicates=${crossPoolDuplicates}`,
    `rejectedVerification=${manifest.rejectedVerificationCount}`,
    `sourceScanRanges=${sourceRanges}`,
    `standardScan scanned=${effectiveStandardStatus.scanned} solved=${effectiveStandardStatus.solved} unsolvable=${effectiveStandardStatus.unsolvable} undetermined=${effectiveStandardStatus.undetermined} rejected=${effectiveStandardStatus.rejected}`,
    `dailyScan scanned=${effectiveDailyStatus.scanned} solved=${effectiveDailyStatus.solved} unsolvable=${effectiveDailyStatus.unsolvable} undetermined=${effectiveDailyStatus.undetermined} rejected=${effectiveDailyStatus.rejected}`,
    `standardScores=${standardScores ?? 'unavailable'}`,
    `dailyScores=${dailyScores ?? 'unavailable'}`,
    dailyBandSummary(manifest, dailySeeds, dailyScored),
  ].join('\n');
}

export async function readProductionDealReportData({
  binaryPath = path.resolve('public/assets/deals/verified-deals.bin'),
  manifestPath = path.resolve('public/assets/deals/verified-deals-manifest.json'),
  standardCandidatesPath = path.resolve('artifacts/deals/standard/candidates.jsonl'),
  standardCheckpointPath = path.resolve('artifacts/deals/standard/checkpoint.json'),
  dailyCandidatesPath = path.resolve('artifacts/deals/daily/candidates.jsonl'),
  dailyCheckpointPath = path.resolve('artifacts/deals/daily/checkpoint.json'),
} = {}) {
  const binary = readFileSync(binaryPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  verifyProductionAssetHash(binary, manifest);
  const catalog = VerifiedDealCatalog.decode(toArrayBuffer(binary), manifest);
  const standardSeeds = Object.fromEntries(TIERS.map((tier) => [tier, catalog.getStandardSeeds(tier).map(Number)]));
  const dailySeeds = Array.from({ length: catalog.metadata.dailyScheduleLength }, (_, index) => Number(catalog.getDailySeedByOffset(index)));

  const snapshots = [];
  try {
    const standardSnapshot = existsSync(standardCandidatesPath) ? await openCandidateSnapshot(standardCandidatesPath) : null;
    if (standardSnapshot) snapshots.push(standardSnapshot);
    const dailySnapshot = existsSync(dailyCandidatesPath) ? await openCandidateSnapshot(dailyCandidatesPath) : null;
    if (dailySnapshot) snapshots.push(dailySnapshot);

    return {
      manifest: catalog.metadata,
      standardSeeds,
      dailySeeds,
      standardCandidates: standardSnapshot?.records ?? [],
      dailyCandidates: dailySnapshot?.records ?? [],
      standardStatus: readCheckpointStatus(standardCheckpointPath),
      dailyStatus: readCheckpointStatus(dailyCheckpointPath),
      closeCandidateSnapshots: () => snapshots.forEach((snapshot) => snapshot.close()),
    };
  } catch (error) {
    snapshots.forEach((snapshot) => snapshot.close());
    throw error;
  }
}


async function main() {
  const data = await readProductionDealReportData();
  try {
    process.stdout.write(`${buildDealReport(data)}\n`);
  } finally {
    data.closeCandidateSnapshots?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
