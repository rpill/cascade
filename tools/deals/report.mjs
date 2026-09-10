import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { VerifiedDealCatalog } from '../../src/game/model/VerifiedDealCatalog.ts';
import { verifyProductionAssetHash } from './catalog-format.mjs';
import { DAILY_BANDS } from './daily-schedule.mjs';
import { scorePopulation } from './difficulty.mjs';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const DAY_MS = 86_400_000;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function readJsonl(filePath) {
  if (!filePath || !existsSync(filePath)) return [];
  const text = readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  return text.split('\n').map((line) => JSON.parse(line));
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

function scoreSummary(records) {
  const accepted = records.filter((record) => record?.status === 'SOLVED' && record?.verification?.ok === true && Array.isArray(record.proof));
  if (accepted.length === 0) return null;
  const scores = scorePopulation(accepted).map((record) => record.difficultyScore).sort((a, b) => a - b);
  const values = [0, 0.25, 0.5, 0.75, 0.95, 1].map((fraction) => percentile(scores, fraction).toFixed(2));
  return `p0=${values[0]} p25=${values[1]} p50=${values[2]} p75=${values[3]} p95=${values[4]} p100=${values[5]}`;
}

function countCrossPoolDuplicates(standardSeeds, dailySeeds) {
  const standard = new Set(TIERS.flatMap((tier) => standardSeeds[tier] ?? []));
  let duplicates = 0;
  for (const seed of dailySeeds) if (standard.has(seed)) duplicates += 1;
  return duplicates;
}

function dailyBandSummary(manifest, dailySeeds, dailyCandidates) {
  const accepted = dailyCandidates.filter((record) => record?.status === 'SOLVED' && record?.verification?.ok === true && Array.isArray(record.proof));
  if (accepted.length === 0) return 'dailyBandViolations=unavailable';
  const scored = scorePopulation(accepted);
  const bySeed = new Map(scored.map((record) => [record.seed, record.difficultyScore]));
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

export function buildDealReport({ manifest, standardSeeds, dailySeeds, standardCandidates = [], dailyCandidates = [] }) {
  const standardTotal = TIERS.reduce((sum, tier) => sum + (standardSeeds[tier]?.length ?? 0), 0);
  const crossPoolDuplicates = countCrossPoolDuplicates(standardSeeds, dailySeeds);
  const standardStatus = statusSummary(standardCandidates);
  const dailyStatus = statusSummary(dailyCandidates);
  const standardScores = scoreSummary(standardCandidates);
  const dailyScores = scoreSummary(dailyCandidates);
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
    `standardScan scanned=${standardStatus.scanned} solved=${standardStatus.solved} unsolvable=${standardStatus.unsolvable} undetermined=${standardStatus.undetermined} rejected=${standardStatus.rejected}`,
    `dailyScan scanned=${dailyStatus.scanned} solved=${dailyStatus.solved} unsolvable=${dailyStatus.unsolvable} undetermined=${dailyStatus.undetermined} rejected=${dailyStatus.rejected}`,
    `standardScores=${standardScores ?? 'unavailable'}`,
    `dailyScores=${dailyScores ?? 'unavailable'}`,
    dailyBandSummary(manifest, dailySeeds, dailyCandidates),
  ].join('\n');
}

export function readProductionDealReportData({
  binaryPath = path.resolve('public/assets/deals/verified-deals.bin'),
  manifestPath = path.resolve('public/assets/deals/verified-deals-manifest.json'),
  standardCandidatesPath = path.resolve('artifacts/deals/standard/candidates.jsonl'),
  dailyCandidatesPath = path.resolve('artifacts/deals/daily/candidates.jsonl'),
} = {}) {
  const binary = readFileSync(binaryPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  verifyProductionAssetHash(binary, manifest);
  const catalog = VerifiedDealCatalog.decode(toArrayBuffer(binary), manifest);
  const standardSeeds = Object.fromEntries(TIERS.map((tier) => [tier, catalog.getStandardSeeds(tier).map(Number)]));
  const dailySeeds = Array.from({ length: catalog.metadata.dailyScheduleLength }, (_, index) => Number(catalog.getDailySeedByOffset(index)));
  return {
    manifest: catalog.metadata,
    standardSeeds,
    dailySeeds,
    standardCandidates: readJsonl(standardCandidatesPath),
    dailyCandidates: readJsonl(dailyCandidatesPath),
  };
}

function main() {
  const data = readProductionDealReportData();
  process.stdout.write(`${buildDealReport(data)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
