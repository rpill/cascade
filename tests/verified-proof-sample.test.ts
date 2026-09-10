import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { verifySeedProof, type DealProofAction } from '../src/game/model/DealProof.ts';
import { VerifiedDealCatalog, type StandardTier } from '../src/game/model/VerifiedDealCatalog.ts';

interface StandardProofFixture {
  readonly source: 'standard';
  readonly tier: StandardTier;
  readonly seed: number;
  readonly proof: readonly DealProofAction[];
}

interface DailyProofFixture {
  readonly source: 'daily';
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly dailyId: string;
  readonly seed: number;
  readonly proof: readonly DealProofAction[];
}

type ProofFixture = StandardProofFixture | DailyProofFixture;

const fixtureUrl = new URL('./fixtures/deals/verified-proof-sample.json', import.meta.url);
const fixtures = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as ProofFixture[];

const manifestUrl = new URL('../public/assets/deals/verified-deals-manifest.json', import.meta.url);
const binaryUrl = new URL('../public/assets/deals/verified-deals.bin', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const binary = readFileSync(binaryUrl);
const catalog = VerifiedDealCatalog.decode(
  binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer,
  manifest,
);

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

test('committed verified proof sample spans every Standard tier and Daily weekday band', () => {
  assert.ok(fixtures.length >= 64 && fixtures.length <= 128, `expected 64..128 proof fixtures, got ${fixtures.length}`);
  assert.equal(new Set(fixtures.map((fixture) => fixture.seed)).size, fixtures.length, 'proof sample seeds must be unique');

  for (const tier of TIERS) {
    assert.ok(fixtures.some((fixture) => fixture.source === 'standard' && fixture.tier === tier), `missing Standard tier ${tier}`);
  }
  for (const weekday of WEEKDAYS) {
    assert.ok(fixtures.some((fixture) => fixture.source === 'daily' && fixture.weekday === weekday), `missing Daily weekday ${weekday}`);
  }
});


test('every committed proof fixture belongs to the shipped smoke catalog group it represents', () => {
  const start = Date.parse(`${catalog.metadata.dailyScheduleStart}T00:00:00Z`);
  for (const fixture of fixtures) {
    if (fixture.source === 'standard') {
      assert.ok(catalog.getStandardSeeds(fixture.tier).includes(BigInt(fixture.seed)), `seed ${fixture.seed} missing from ${fixture.tier}`);
      continue;
    }
    const offset = (Date.parse(`${fixture.dailyId}T00:00:00Z`) - start) / 86_400_000;
    assert.equal(catalog.getDailySeedByOffset(offset), BigInt(fixture.seed));
  }
});

test('every committed proof fixture replays through production SolitaireGame rules', () => {
  for (const fixture of fixtures) {
    const verification = verifySeedProof(BigInt(fixture.seed), fixture.proof);
    assert.equal(verification.seed, BigInt(fixture.seed));
    assert.equal(verification.foundationCount, 52);
  }
});

test('a corrupt proof copy fails loudly with seed and action context', () => {
  const fixture = fixtures[0];
  assert.ok(fixture, 'fixture sample must not be empty');
  const corruptProof: readonly DealProofAction[] = [{ kind: 'draw', cardIds: ['not-a-real-card'] }];

  assert.throws(
    () => verifySeedProof(BigInt(fixture.seed), corruptProof),
    new RegExp(`seed=${fixture.seed} action=0`, 'iu'),
  );
});
