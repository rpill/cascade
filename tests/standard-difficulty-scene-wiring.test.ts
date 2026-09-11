import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const metaOperations = readFileSync(new URL('../src/meta/MetaOperations.ts', import.meta.url), 'utf8');

function method(name: string): string {
  let start = scene.indexOf(`private ${name}`);
  if (start === -1) start = scene.indexOf(`private async ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = scene.indexOf('\n  private ', start + 1);
  return scene.slice(start, next === -1 ? scene.length : next);
}

function assertOrdered(source: string, first: string, second: string): void {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  assert.notEqual(a, -1, `missing ${first}`);
  assert.notEqual(b, -1, `missing ${second}`);
  assert.ok(a < b, `${first} must precede ${second}`);
}

test('GameScene owns hidden Standard director and records served seed before starting it', () => {
  assert.match(scene, /StandardDifficultyDirector/);
  assert.match(scene, /createRandomDealSeed/);
  const select = method('selectStandardDeal');
  assert.match(select, /stats\.winnable\.wins/);
  assert.match(select, /standardDifficulty\.failureStreak/);
  assert.match(select, /standardDifficulty\.lastServedTier/);
  assert.match(select, /standardDifficulty\.recentSeeds/);

  const start = method('startSelectedMode');
  assertOrdered(start, "kind:'standard-served'", 'playSelectedMode');
});

test('New Deal in unfinished Standard records failure before choosing replacement', () => {
  const source = method('requestFreshDeal');
  assertOrdered(source, 'recordStandardFailureIfReplacing', 'selectStandardDeal');
  assertOrdered(source, "kind:'standard-served'", 'startNewInCurrentMode');
});

test('switching modes can record Standard failure but restart and menu toggles do not', () => {
  const startSelected = method('startSelectedMode');
  assert.match(startSelected, /recordStandardFailureIfReplacing/);

  const restart = method('restartDeal');
  assert.match(restart, /flow\.restart\(\)/);
  assert.doesNotMatch(restart, /standard-served|standard-failed|recordStandardFailure/);

  const openMenu = method('openMainMenu');
  assert.doesNotMatch(openMenu, /standard-served|standard-failed|recordStandardFailure/);

  const closeMenu = method('closeMainMenu');
  assert.doesNotMatch(closeMenu, /standard-served|standard-failed|recordStandardFailure/);
});

test('Standard completion still resets the failure streak through complete meta operation', () => {
  const finish = method('finishOrdinaryAttempt');
  assert.match(finish, /completionEvent\(mode,elapsedMs\)/);
  assert.match(finish, /dispatchMeta\(event\)/);
  assert.match(metaOperations, /case 'complete'/);
  assert.match(metaOperations, /failureStreak:\s*0/);
});
