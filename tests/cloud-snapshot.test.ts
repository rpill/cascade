import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { createCard } from '../src/game/model/cards.ts';
import { createOriginalDeal } from '../src/game/model/deal.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';
import { createActiveGameSave } from '../src/persistence/ActiveGameSave.ts';
import { CLOUD_SNAPSHOT_VERSION, normalizeCloudSnapshot } from '../src/cloud/CloudSnapshot.ts';

function activeSave() {
  const seed = 42n;
  const snapshot = new SolitaireGame(createOriginalDeal(seed, 'winnable')).snapshot();
  return createActiveGameSave({
    mode: 'winnable',
    seed,
    snapshot,
    attemptStarted: true,
    elapsedMs: 1200,
    standard: { partition: 'easy', difficulty: 'easy' },
    uiState: 'playing',
  });
}

test('cloud snapshot normalizes MetaSave and a valid active game checkpoint', () => {
  const normalized = normalizeCloudSnapshot({
    schemaVersion: 1,
    meta: createDefaultMetaSave(),
    activeGame: { save: activeSave(), updatedAtMs: 1234 },
  });
  assert.equal(CLOUD_SNAPSHOT_VERSION, 1);
  assert.equal(normalized?.schemaVersion, 1);
  assert.equal(normalized?.meta.version, 9);
  assert.equal(normalized?.activeGame?.updatedAtMs, 1234);
  assert.equal(normalized?.activeGame?.save.snapshot.stock[0]?.id, activeSave().snapshot.stock[0]?.id);
  assert.deepEqual(createCard('spades', 1), createCard('spades', 1));
});

test('cloud snapshot rejects invalid schema or invalid active save', () => {
  assert.equal(normalizeCloudSnapshot({ schemaVersion: 2, meta: createDefaultMetaSave() }), null);
  assert.equal(normalizeCloudSnapshot({
    schemaVersion: 1,
    meta: createDefaultMetaSave(),
    activeGame: { save: { nope: true }, updatedAtMs: 1 },
  }), null);
  assert.equal(normalizeCloudSnapshot({
    schemaVersion: 1,
    meta: createDefaultMetaSave(),
    activeGame: { save: activeSave(), updatedAtMs: -1 },
  }), null);
});
