import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

const scene = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertOrdered(source: string, first: string, second: string): void {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `missing ${first}`);
  assert.notEqual(secondIndex, -1, `missing ${second}`);
  assert.ok(firstIndex < secondIndex, `${first} must precede ${second}`);
}

test('ordinary attempts mutate persistent stats at the settled playable boundary', () => {
  assert.match(scene, /private metaSession!: MetaSession/);
  assert.match(scene, /private dispatchMeta\(event: MetaOperation\)/);
  assert.match(scene, /private readonly attemptTimer = new AttemptTimer\(\)/);
  assert.match(scene, /private attemptStarted = false/);
  assert.match(scene, /private attemptFinalized = false/);
  assert.doesNotMatch(scene, /dailyTimer|dailyAttemptStarted/);

  const settled = extractMethod(scene, 'onBoardSettled');
  assert.match(settled, /if \(!this\.attemptStarted\)/);
  assert.match(settled, /dispatchMeta\(\{\s*kind:\s*'begin',[^}]*attemptId:\s*this\.attemptId,[^}]*mode/);
  assertOrdered(settled, 'this.attemptTimer.start(now)', "this.dispatchMeta({kind:'begin'");
  assertOrdered(settled, "this.dispatchMeta({kind:'begin'", 'this.checkpointActiveGame(gameState)');
});

test('restored started attempts resume timing without incrementing played again', () => {
  const startDeal = extractMethod(scene, 'startDeal');
  assert.match(startDeal, /attemptStarted = restored\.attemptStarted/);
  assert.match(
    startDeal,
    /if \(restored\.attemptStarted\)[^]*attemptTimer\.start\([^,]+, restored\.elapsedMs\)/,
  );
  assert.match(startDeal, /onBoardSettled\(gameState\)[^]*return/);

  const settled = extractMethod(scene, 'onBoardSettled');
  assert.match(
    settled,
    /if \(!this\.attemptStarted\)[^]*dispatchMeta\(\{\s*kind:\s*'begin'/,
  );
});

test('ordinary wins finalize once before the unfinished checkpoint is cleared', () => {
  const ordinary = extractMethod(scene, 'finishOrdinaryAttempt');
  assert.match(ordinary, /this\.attemptFinalized/);
  assert.match(ordinary, /attemptFinalized = true/);
  assert.match(ordinary, /attemptTimer\.finish\(performance\.now\(\)\)/);
  assert.match(ordinary, /const event\s*=\s*this\.completionEvent\(mode,\s*elapsedMs\)/);
  assert.match(ordinary, /completeRewardedAttempt\(this\.metaState,\s*event\)/);
  assert.match(ordinary, /const recorded\s*=\s*this\.dispatchMeta\(event\)/);
  assert.match(ordinary, /if \(recorded\) this\.activeGameRepository\.clear\(\)/);
  assertOrdered(ordinary, 'this.dispatchMeta(event)', 'this.activeGameRepository.clear()');
});

test('cloud metadata is loaded and replayed through MetaSession', () => {
  const load = extractMethod(scene, 'loadMetaProfile');
  assert.match(load, /new MetaSession\(this\.platform\.playerStorage,\s*nextJournal\)/);
  assert.match(load, /for \(const event of transfer\)[^]*nextSession\.dispatch\(event\)/);
  assert.match(load, /const loaded = await this\.metaSession\.load\(\)/);
  assert.match(load, /this\.refreshSessionState\(\)/);
  assert.doesNotMatch(load, /this\.metaState\s*=\s*await/);
});

test('one generic attempt timer pauses and resumes for every mode through shared reconciliation', () => {
  assert.match(
    scene,
    /deriveGameplayActivity\(\{[^]*attemptStarted: this\.attemptStarted[^]*attemptFinalized: this\.attemptFinalized[^]*flowPlaying: this\.flow\?\.state === 'playing'[^]*documentVisible: document\.visibilityState === 'visible'[^]*platformPaused: this\.platformPaused/,
  );
  assert.match(
    scene,
    /if \(decision\.timerShouldRun\)[^]*attemptTimer\.resume\(performance\.now\(\)\)[^]*pauseAttemptTimer\(\)/,
  );
  assert.match(scene, /openMainMenu[^]*reconcileGameplayActivity\(\)/);
  assert.match(scene, /handleVisibilityChange[^]*pauseAttemptTimer\(\)[^]*reconcileGameplayActivity\(\)/);
  assert.match(scene, /handlePageHide[^]*pauseAttemptTimer\(\)/);
  assert.doesNotMatch(scene, /resumeAttemptTimerIfPlayable/);
});

test('Daily begin operations update Daily progress rather than ordinary GameStats', () => {
  const initial = createDefaultMetaSave();
  const next = applyMetaOperation(initial, {
    kind: 'begin',
    attemptId: 'wiring~1',
    mode: 'daily',
    dailyId: '2026-09-09',
    weekId: '2026-W37',
  });

  assert.equal(next.daily.records['2026-09-09']?.attempts, 1);
  assert.deepEqual(next.stats, initial.stats);
});


test('pre-load ordinary completion snapshot is reconciled with merged cloud statistics', () => {
  const refresh = extractMethod(scene, 'refreshSessionState');
  assertOrdered(refresh, 'this.metaState = this.metaSession.state', 'this.lastOrdinaryCompletion');
  assert.match(refresh, /stats:\s*\{\s*\.\.\.this\.metaState\.stats\[completion\.mode\]/);
  assert.match(refresh, /metaSession\.getImprovedBest\(completion\.event\.attemptId\)/);
});


test('ordinary completion is shown with merged stats and completion actions', () => {
  assert.match(scene, /GameCompleteView/);
  assert.match(scene, /gameCompleteView\.show\(/);
  assert.match(scene, /lastOrdinaryCompletion/);
  assert.match(scene, /elapsedMs: completion\.elapsedMs/);
  assert.match(scene, /bestTimeMs: completion\.result\.stats\.bestTimeMs/);
  assert.match(scene, /wins: completion\.result\.stats\.wins/);
  assert.match(scene, /played: completion\.result\.stats\.played/);
  assert.match(scene, /newGame: \(\) => this\.startNewDeal\(\)/);
  assert.match(scene, /menu: \(\) => this\.openMenuFromGameComplete\(\)/);
  assert.match(scene, /startDeal[^]*gameCompleteView\.hide\(\)/);
  assert.match(scene, /shutdown[^]*gameCompleteView\.destroy\(\)/);
});


test('ordinary best sync is gated by improvedBest and does not gate local completion', () => {
  const ordinary = extractMethod(scene, 'finishOrdinaryAttempt');

  assert.match(ordinary, /completion\.improvedBest/);
  assert.match(ordinary, /void this\.leaderboardService\?\.syncBest\(mode, bestTimeMs\)/);
  assertOrdered(ordinary, 'this.dispatchMeta(event)', 'syncBest(mode, bestTimeMs)');
});

test('ordinary attempt timing uses the shared gameplay activity reconciliation', () => {
  assert.match(scene, /reconcileGameplayActivity/);
  assert.match(scene, /attemptTimer\.pause/);
  assert.match(scene, /attemptTimer\.resume/);
  assert.match(scene, /attemptFinalized/);
});
