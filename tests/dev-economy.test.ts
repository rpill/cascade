import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

class MemoryStorage implements MetaJournalStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function cloudData(state: MetaSave): Record<string, unknown> {
  return { cascadeMeta: structuredClone(state) };
}

test('development coin floor gives the loaded profile enough balance for normal theme purchases', async () => {
  const remote = createDefaultMetaSave();
  remote.progression.coins = 180;
  const storage: PlayerStorage = {
    load: async () => cloudData(remote),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('dev-profile', new MemoryStorage()));
  await session.load();

  const candidate = session as MetaSession & {
    setDevelopmentCoinFloor?: (coins: number) => boolean;
  };
  assert.equal(typeof candidate.setDevelopmentCoinFloor, 'function', 'MetaSession.setDevelopmentCoinFloor must exist');

  assert.equal(candidate.setDevelopmentCoinFloor!(999_999), true);
  assert.equal(session.state.progression.coins, 999_999);

  assert.equal(session.dispatch({ kind: 'purchase', themeId: 'navy_study' }), true);
  assert.equal(session.state.progression.coins, 999_699);
  assert.ok(session.state.collection.ownedThemes.includes('navy_study'));
});

test('GameScene enables the development coin floor only in DEV builds', () => {
  const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(source, /import\.meta\.env\.DEV[\s\S]{0,180}setDevelopmentCoinFloor\(999_999\)/);
});
