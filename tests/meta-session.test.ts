import test from 'node:test';
import assert from 'node:assert/strict';

import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import type { MetaOperation } from '../src/meta/MetaOperations.ts';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import type { PlayerStorage } from '../src/platform/services.ts';
import { createBrowserPlayerStorage } from '../src/platform/services.ts';

class MemoryStorage implements MetaJournalStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function begin(attemptId: string): MetaOperation {
  return { kind: 'begin', attemptId, mode: 'winnable' };
}

function complete(attemptId: string): MetaOperation {
  return {
    kind: 'complete',
    attemptId,
    mode: 'winnable',
    elapsedMs: 4_000,
    trustedDay: '2026-09-08',
    trustedWeek: '2026-W37',
  };
}

function cloudData(state: MetaSave): Record<string, unknown> {
  return { cascadeMeta: structuredClone(state) };
}

test('failed load enters error state and flush never overwrites cloud with defaults', async () => {
  let writes = 0;
  const storage: PlayerStorage = {
    load: async () => { throw new Error('offline'); },
    save: async () => { writes += 1; },
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', new MemoryStorage()));

  assert.equal(await session.load(), false);
  assert.equal(session.status, 'error');
  assert.equal(await session.flush(), false);
  assert.equal(writes, 0);
});

test('browser profile write failure cannot acknowledge the durable operation journal', async () => {
  const disk=new MemoryStorage();
  let fail=true;
  const browserStorage={getItem:(key:string)=>disk.getItem(key),setItem:(key:string,value:string)=>{
    if (key==='cascadePlayerData' && fail) throw new Error('quota');
    disk.setItem(key,value);
  }};
  const journal=new MetaJournal('browser-local',browserStorage);
  const session=new MetaSession(createBrowserPlayerStorage(browserStorage),journal);
  await session.load();
  session.dispatch(begin('quota-test'));
  assert.equal(await session.flush(),false);
  assert.equal(session.saveError,true);
  assert.equal(journal.pending.length,1);
  fail=false;
  assert.equal(await session.flush(),true);
  assert.equal(journal.pending.length,0);
});

test('purchase is rejected until a profile load succeeds', async () => {
  const journal = new MetaJournal('player-1', new MemoryStorage());
  const storage: PlayerStorage = {
    load: async () => { throw new Error('offline'); },
    save: async () => undefined,
  };
  const session = new MetaSession(storage, journal);

  assert.equal(session.dispatch({ kind: 'purchase', themeId: 'navy_study' }), false);
  await session.load();
  assert.equal(session.dispatch({ kind: 'purchase', themeId: 'navy_study' }), false);
  assert.equal(journal.pending.length, 0);
});

test('load can retry after a failed profile read', async () => {
  let fail = true;
  const remote = createDefaultMetaSave();
  remote.progression.coins = 75;
  const storage: PlayerStorage = {
    load: async () => {
      if (fail) throw new Error('offline');
      return cloudData(remote);
    },
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', new MemoryStorage()));

  assert.equal(await session.load(), false);
  fail = false;

  assert.equal(await session.load(), true);
  assert.equal(session.status, 'ready');
  assert.equal(session.state.progression.coins, 75);
});

test('operation dispatched before load replays over cloud state', async () => {
  const remote = createDefaultMetaSave();
  remote.stats.winnable.played = 5;
  const storage: PlayerStorage = {
    load: async () => cloudData(remote),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', new MemoryStorage()));

  assert.equal(session.dispatch(begin('early-attempt')), true);
  assert.equal(session.state.stats.winnable.played, 1);

  assert.equal(await session.load(), true);
  assert.equal(session.state.stats.winnable.played, 6);
});

test('persisted operation replays once after remote save succeeded but local acknowledgement failed', async () => {
  const local = new MemoryStorage();
  const journal = new MetaJournal('player-1', local);
  let remote = createDefaultMetaSave();
  const storage: PlayerStorage = {
    load: async () => cloudData(remote),
    save: async (data) => { remote = structuredClone(data.cascadeMeta as MetaSave); },
  };
  const firstSession = new MetaSession(storage, journal);
  await firstSession.load();
  firstSession.dispatch(begin('attempt-once'));
  const originalSetItem = local.setItem.bind(local);
  local.setItem = () => { throw new Error('failed local acknowledgement'); };

  assert.equal(await firstSession.flush(), false);
  assert.equal(remote.stats.winnable.played, 1);

  local.setItem = originalSetItem;
  const reloaded = new MetaSession(storage, new MetaJournal('player-1', local));
  assert.equal(await reloaded.load(), true);
  assert.equal(reloaded.state.stats.winnable.played, 1);
  assert.equal(await reloaded.flush(), true);
  assert.equal(new MetaJournal('player-1', local).pending.length, 0);
});

test('operation arriving during a slow save remains pending after that snapshot', async () => {
  let releaseFirstSave: (() => void) | undefined;
  let saves = 0;
  const storage: PlayerStorage = {
    load: async () => cloudData(createDefaultMetaSave()),
    save: async () => {
      saves += 1;
      if (saves === 1) await new Promise<void>((resolve) => { releaseFirstSave = resolve; });
      if (saves === 2) throw new Error('second save offline');
    },
  };
  const journal = new MetaJournal('player-1', new MemoryStorage());
  const session = new MetaSession(storage, journal);
  await session.load();
  session.dispatch(begin('attempt-1'));
  const flushing = session.flush();
  await Promise.resolve();
  session.dispatch(begin('attempt-2'));
  releaseFirstSave?.();

  assert.equal(await flushing, false);
  assert.equal(session.state.stats.winnable.played, 2);
  assert.equal(journal.pending.length, 1);
  assert.equal(journal.pending[0].sequence, 2);
});

test('failed cloud write remains retryable and clears save error after success', async () => {
  let fail = true;
  const storage: PlayerStorage = {
    load: async () => cloudData(createDefaultMetaSave()),
    save: async () => {
      if (fail) throw new Error('offline');
    },
  };
  const journal = new MetaJournal('player-1', new MemoryStorage());
  const session = new MetaSession(storage, journal);
  await session.load();
  session.dispatch(begin('retry-attempt'));

  assert.equal(await session.flush(), false);
  assert.equal(session.saveError, true);
  assert.equal(journal.pending.length, 1);

  fail = false;
  assert.equal(await session.flush(), true);
  assert.equal(session.saveError, false);
  assert.equal(journal.pending.length, 0);
});

test('journal append failure does not apply a commerce operation', async () => {
  const local: MetaJournalStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('blocked'); },
  };
  const storage: PlayerStorage = {
    load: async () => cloudData(createDefaultMetaSave()),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', local));
  await session.load();
  const before = structuredClone(session.state);

  assert.equal(session.dispatch({ kind: 'purchase', themeId: 'navy_study' }), false);
  assert.deepEqual(session.state, before);
});

test('state changes notify observers for provisional dispatch, load, and save status', async () => {
  const storage: PlayerStorage = {
    load: async () => cloudData(createDefaultMetaSave()),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', new MemoryStorage()));
  let changes = 0;
  session.onChange = () => { changes += 1; };

  session.dispatch(begin('notified-attempt'));
  await session.load();
  await session.flush();

  assert.ok(changes >= 4);
});

test('completion reward is recalculated when provisional state replays over cloud', async () => {
  const remote = createDefaultMetaSave();
  remote.progression.lastWinDay = '2026-09-08';
  const storage: PlayerStorage = {
    load: async () => cloudData(remote),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, new MetaJournal('player-1', new MemoryStorage()));

  session.dispatch(complete('rewarded-attempt'));
  assert.ok(session.getReward('rewarded-attempt')?.lines.some(({ label }) =>
    label === 'Первая победа сегодня'));

  await session.load();

  assert.equal(session.getReward('rewarded-attempt')?.lines.some(({ label }) =>
    label === 'Первая победа сегодня'), false);
});

test('already receipted completion does not advertise a reward after load', async () => {
  const journal = new MetaJournal('player-1', new MemoryStorage());
  const envelope = journal.append(complete('already-saved-attempt'));
  assert.ok(envelope);
  const remote = createDefaultMetaSave();
  remote.progression.receipts[journal.stream] = envelope.sequence;
  remote.progression.completedAttempts.push('already-saved-attempt');
  const storage: PlayerStorage = {
    load: async () => cloudData(remote),
    save: async () => undefined,
  };
  const session = new MetaSession(storage, journal);

  await session.load();

  assert.equal(session.getReward('already-saved-attempt'), undefined);
});
