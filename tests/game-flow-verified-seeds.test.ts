import test from 'node:test';
import assert from 'node:assert/strict';

import { GameFlow } from '../src/game/model/GameFlow.ts';
import { GameSession } from '../src/game/model/GameSession.ts';
import { VerifiedDealCatalog, type StandardTier, type VerifiedDealManifest } from '../src/game/model/VerifiedDealCatalog.ts';

const TIERS: readonly StandardTier[] = ['onboarding', 'easy', 'medium', 'hard'];

function catalog(): VerifiedDealCatalog {
  const standard: Record<StandardTier, number[]> = { onboarding:[11], easy:[22], medium:[33], hard:[44] };
  const daily = [101, 102];
  const values = [...TIERS.flatMap((tier)=>standard[tier]), ...daily];
  const buffer = new ArrayBuffer(values.length*4);
  const view = new DataView(buffer);
  values.forEach((seed,index)=>view.setUint32(index*4,seed,true));
  const standardCounts = {} as Record<StandardTier,number>;
  const offsets = {} as Record<StandardTier|'daily',{byteOffset:number;count:number}>;
  let byteOffset=0;
  for (const tier of TIERS) { standardCounts[tier]=standard[tier].length; offsets[tier]={byteOffset,count:standard[tier].length}; byteOffset+=standard[tier].length*4; }
  offsets.daily={byteOffset,count:daily.length};
  const manifest:VerifiedDealManifest={catalogVersion:1,difficultyModelVersion:1,dailyAlgorithmVersion:2,solverSourceHash:'solver',gameRulesSourceHash:'rules',standardCounts,dailyScheduleStart:'2026-01-01',dailyScheduleLength:daily.length,fastNodeBudget:250000,slowNodeBudget:2000000,sourceScanRanges:[],verifiedCount:values.length,rejectedVerificationCount:0,crossPoolDuplicateCount:0,productionAssetHash:'0'.repeat(64),offsets};
  return VerifiedDealCatalog.decode(buffer,manifest);
}

function flow(nextSeed = () => 900n): GameFlow {
  return new GameFlow(new GameSession({ nextSeed, catalog: catalog() }));
}

test('menu starts Standard and Daily only from explicitly supplied verified seeds', () => {
  const standardFlow = flow();
  standardFlow.selectMenuMode('winnable');
  assert.equal(standardFlow.playSelectedMode(22n).seed, 22n);

  const dailyFlow = flow();
  dailyFlow.selectMenuMode('daily');
  assert.equal(dailyFlow.playSelectedMode(101n).seed, 101n);
});

test('Standard and Daily require an explicit seed while Classic still chooses internally', () => {
  const standardFlow = flow();
  standardFlow.selectMenuMode('winnable');
  assert.throws(() => standardFlow.playSelectedMode(), /standard seed is required/iu);

  const dailyFlow = flow();
  dailyFlow.selectMenuMode('daily');
  assert.throws(() => dailyFlow.playSelectedMode(), /daily seed is required/iu);

  const classicFlow = flow(() => 777n);
  classicFlow.selectMenuMode('original');
  assert.equal(classicFlow.playSelectedMode().seed, 777n);
});

test('new Standard requires a newly selected seed while Daily restarts and Classic rerolls', () => {
  const standardFlow = flow();
  standardFlow.selectMenuMode('winnable');
  standardFlow.playSelectedMode(22n);
  assert.equal(standardFlow.startNewInCurrentMode(33n).seed, 33n);
  assert.throws(() => standardFlow.startNewInCurrentMode(), /standard seed is required/iu);

  const dailyFlow = flow();
  dailyFlow.selectMenuMode('daily');
  dailyFlow.playSelectedMode(101n);
  assert.equal(dailyFlow.startNewInCurrentMode().seed, 101n);

  let next = 700n;
  const classicFlow = flow(() => next++);
  classicFlow.selectMenuMode('original');
  const first = classicFlow.playSelectedMode();
  const second = classicFlow.startNewInCurrentMode();
  assert.notEqual(second.seed, first.seed);
});
