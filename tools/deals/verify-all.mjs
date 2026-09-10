import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { VerifiedDealCatalog } from '../../src/game/model/VerifiedDealCatalog.ts';
import { verifyProductionAssetHash } from './catalog-format.mjs';
import { solveSeed as defaultSolveSeed } from './solver-client.mjs';
import { verifyProofRecord as defaultVerifyProofRecord } from './verify-proof.mjs';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const SLOW_NODE_BUDGET = 2_000_000;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument near ${String(key)}`);
    options[key.slice(2)] = value;
  }
  const jobs = Number(options.jobs ?? 4);
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new RangeError('--jobs must be an integer >= 1');
  return { jobs };
}

export async function verifyCatalogSeeds({
  binaryPath = path.resolve('public/assets/deals/verified-deals.bin'),
  manifestPath = path.resolve('public/assets/deals/verified-deals-manifest.json'),
  jobs = 4,
  solveSeed = defaultSolveSeed,
  verifyProofRecord = defaultVerifyProofRecord,
  onProgress = ({ verified, total }) => {
    if (verified === total || verified % 100 === 0) process.stdout.write(`[verify-all] ${verified}/${total}\n`);
  },
} = {}) {
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new RangeError(`jobs must be >= 1, got ${String(jobs)}`);

  const binary = readFileSync(binaryPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  verifyProductionAssetHash(binary, manifest);
  const catalog = VerifiedDealCatalog.decode(toArrayBuffer(binary), manifest);
  const seeds = [
    ...TIERS.flatMap((tier) => catalog.getStandardSeeds(tier).map(Number)),
    ...Array.from({ length: catalog.metadata.dailyScheduleLength }, (_, index) => Number(catalog.getDailySeedByOffset(index))),
  ];

  let cursor = 0;
  let verified = 0;
  let firstFailure = null;

  await Promise.all(Array.from({ length: Math.min(jobs, seeds.length) }, async () => {
    while (firstFailure === null) {
      const index = cursor;
      cursor += 1;
      if (index >= seeds.length) return;
      const seed = seeds[index];
      try {
        const solved = await solveSeed({ seed, budget: SLOW_NODE_BUDGET });
        if (solved.status !== 'SOLVED') {
          throw new Error(`seed=${seed}: solver status ${solved.status} at budget ${SLOW_NODE_BUDGET}`);
        }
        const replay = await verifyProofRecord(solved);
        if (!replay.ok) throw new Error(replay.reason || `seed=${seed}: proof replay failed`);
        verified += 1;
        onProgress({ verified, total: seeds.length, seed });
      } catch (error) {
        if (firstFailure === null) {
          firstFailure = error instanceof Error ? error : new Error(String(error));
        }
        return;
      }
    }
  }));

  if (firstFailure !== null) throw firstFailure;
  return { verified, total: seeds.length };
}

async function main(argv) {
  const { jobs } = parseArgs(argv);
  const result = await verifyCatalogSeeds({ jobs });
  process.stdout.write(`status=VERIFIED ${result.verified}/${result.total}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
