
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

function method(name) {
  const start = source.indexOf(`private ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('restoring a persisted Daily session closes product UI before rebuilding the game scene', () => {
  const restore = method('tryRestoreDailySession');
  const stop = restore.indexOf('this.stopProductUiScenes()');
  const startDeal = restore.indexOf('this.startDeal(deal, { restored: save })');
  assert.ok(stop >= 0, 'Daily restore must stop product UI scenes');
  assert.ok(startDeal >= 0, 'Daily restore must restart the deal');
  assert.ok(stop < startDeal, 'product UI must be stopped before the restored board is started');
});
