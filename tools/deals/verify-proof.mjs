import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { verifySeedProof } from '../../src/game/model/DealProof.ts';

export async function verifyProofRecord(record) {
  if (record?.status !== 'SOLVED') {
    return { ok: false, reason: `seed=${String(record?.seed ?? 'unknown')}: solver status ${String(record?.status ?? 'missing')} is not SOLVED` };
  }
  if (!Number.isInteger(record.seed) || record.seed < 1 || record.seed > 0xffff_ffff) {
    return { ok: false, reason: `Invalid proof seed: ${String(record.seed)}` };
  }
  if (!Array.isArray(record.proof) || record.proof.length === 0) {
    return { ok: false, reason: `seed=${record.seed}: SOLVED record has no proof actions` };
  }

  try {
    const verification = verifySeedProof(BigInt(record.seed), record.proof);
    return {
      ok: true,
      verification: {
        seed: verification.seed.toString(),
        actionCount: verification.actionCount,
        foundationCount: verification.foundationCount,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(argv) {
  const [recordPath] = argv;
  if (!recordPath) {
    throw new Error('Usage: node tools/deals/verify-proof.mjs <solver-record.json>');
  }
  const record = JSON.parse(await readFile(recordPath, 'utf8'));
  const result = await verifyProofRecord(record);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
