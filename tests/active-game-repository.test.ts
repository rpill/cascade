import test from 'node:test';
import assert from 'node:assert/strict';

import { createOriginalDeal } from '../src/game/model/deal.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';
import { createActiveGameSave } from '../src/persistence/ActiveGameSave.ts';
import {
  ActiveGameRepository,
  type ActiveGameStorageLike,
} from '../src/persistence/ActiveGameRepository.ts';

class FakeStorage implements ActiveGameStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function checkpoint() {
  const seed = 77n;
  const deal = createOriginalDeal(seed, 'original');

  return createActiveGameSave({
    mode: 'original',
    seed,
    snapshot: new SolitaireGame(deal).snapshot(),
    attemptStarted: true,
    elapsedMs: 9001,
    uiState: 'menu-paused',
  });
}

test('active game repository survives recreation and clears the checkpoint', () => {
  const storage = new FakeStorage();
  new ActiveGameRepository(storage).save(checkpoint());

  const restored = new ActiveGameRepository(storage).load();
  assert.equal(restored?.seed, '77');
  assert.equal(restored?.uiState, 'menu-paused');

  new ActiveGameRepository(storage).clear();
  assert.equal(new ActiveGameRepository(storage).load(), null);
});

test('active game repository discards corrupt JSON best-effort', () => {
  const storage = new FakeStorage();
  storage.setItem('cascadeActiveGame', '{not-json');

  assert.equal(new ActiveGameRepository(storage).load(), null);
  assert.equal(storage.getItem('cascadeActiveGame'), null);
});

test('active game repository discards structurally invalid data best-effort', () => {
  const storage = new FakeStorage();
  storage.setItem('cascadeActiveGame', JSON.stringify({ version: 99 }));

  assert.equal(new ActiveGameRepository(storage).load(), null);
  assert.equal(storage.getItem('cascadeActiveGame'), null);
});

test('active game repository never propagates browser storage failures', () => {
  const storage: ActiveGameStorageLike = {
    getItem(): string | null { throw new Error('blocked'); },
    setItem(): void { throw new Error('blocked'); },
    removeItem(): void { throw new Error('blocked'); },
  };
  const repository = new ActiveGameRepository(storage);

  assert.doesNotThrow(() => repository.save(checkpoint()));
  assert.equal(repository.load(), null);
  assert.doesNotThrow(() => repository.clear());
});
