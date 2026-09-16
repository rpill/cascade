import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function method(name: string): string {
  const direct = scene.indexOf(`private ${name}`);
  const asyncStart = scene.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing ${name}`);
  const next = scene.indexOf('\n  private ', start + 1);
  return scene.slice(start, next === -1 ? scene.length : next);
}

test('starting a mode from a paused product menu reconciles Phaser scene activity after GameFlow becomes playing', () => {
  const startMenuMode = method('startMenuMode');
  const selectIndex = startMenuMode.indexOf('this.startSelectedMode(mode)');
  const reconcileIndex = startMenuMode.indexOf('this.reconcileGameplayActivity()');
  const startDealIndex = startMenuMode.indexOf('this.startDeal(deal)');
  assert.ok(selectIndex >= 0);
  assert.ok(reconcileIndex > selectIndex);
  assert.ok(reconcileIndex < startDealIndex);
});

test('Standard Play/New Deal from Home replaces a paused Standard directly from menu instead of resuming the old board first', () => {
  const startStandard = method('startStandardFromProductHome');
  assert.doesNotMatch(startStandard, /closeMainMenu\(\)/);
  assert.match(startStandard, /startStandardFromPausedProductMenu/);
  const pausedStart = method('startStandardFromPausedProductMenu');
  assert.match(pausedStart, /beforeFreshStandardDeal\(\)/);
  assert.match(pausedStart, /startMenuMode\('winnable'\)/);
});
