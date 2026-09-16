import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MetaJournal,
  type MetaJournalStorage,
} from '../src/meta/MetaJournal.ts';
import type { MetaOperation } from '../src/meta/MetaOperations.ts';

class MemoryStorage implements MetaJournalStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function begin(attemptId: string): MetaOperation {
  return { kind: 'begin', attemptId, mode: 'winnable' };
}

test('journal persists one stable stream and monotonically increasing sequence', () => {
  const storage = new MemoryStorage();
  const first = new MetaJournal('player-1', storage);

  const one = first.append(begin('attempt-1'));
  const two = first.append(begin('attempt-2'));
  const reloaded = new MetaJournal('player-1', storage);
  const three = reloaded.append(begin('attempt-3'));

  assert.ok(one);
  assert.ok(two);
  assert.ok(three);
  assert.equal(one.stream, two.stream);
  assert.equal(two.stream, three.stream);
  assert.deepEqual(
    reloaded.pending.map(({ sequence }) => sequence),
    [1, 2, 3],
  );

  assert.equal(reloaded.acknowledge(reloaded.pending), true);
  const afterCompaction = new MetaJournal('player-1', storage);
  assert.equal(afterCompaction.append(begin('attempt-4'))?.sequence, 4);
});

test('journal scopes browser state to the selected player', () => {
  const storage = new MemoryStorage();
  const firstPlayer = new MetaJournal('player-1', storage);
  const secondPlayer = new MetaJournal('player-2', storage);

  firstPlayer.append(begin('first-player-attempt'));
  secondPlayer.append(begin('second-player-attempt'));

  assert.notEqual(firstPlayer.stream, secondPlayer.stream);
  assert.equal(new MetaJournal('player-1', storage).pending[0].operation.kind, 'begin');
  assert.equal(
    (new MetaJournal('player-2', storage).pending[0].operation as { attemptId: string }).attemptId,
    'second-player-attempt',
  );
});

test('journal rejects corrupt persisted state instead of replaying malformed operations', () => {
  const storage = new MemoryStorage();
  const seeded = new MetaJournal('player-1', storage);
  seeded.append(begin('valid-before-corruption'));
  const [key] = storage.values.keys();
  storage.values.set(key, JSON.stringify({
    version: 1,
    stream: seeded.stream,
    nextSequence: 10,
    pending: [{ stream: seeded.stream, sequence: 9, operation: { kind: 'purchase' } }],
  }));

  const recovered = new MetaJournal('player-1', storage);

  assert.deepEqual(recovered.pending, []);
  assert.equal(recovered.append(begin('after-corruption'))?.sequence, 1);
});

test('journal uses memory when browser storage is unavailable and reports non-durability', () => {
  const journal = new MetaJournal('local', null);

  const envelope = journal.append(begin('memory-attempt'));

  assert.ok(envelope);
  assert.equal(journal.durable, false);
  assert.equal(journal.pending.length, 1);
});

test('failed persistence rejects append without changing the in-memory journal', () => {
  const storage: MetaJournalStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota exceeded'); },
  };
  const journal = new MetaJournal('player-1', storage);

  const envelope = journal.append(begin('unsaved-attempt'));

  assert.equal(envelope, null);
  assert.equal(journal.durable, false);
  assert.deepEqual(journal.pending, []);
});

test('acknowledging a snapshot removes only included envelopes', () => {
  const journal = new MetaJournal('player-1', new MemoryStorage());
  const first = journal.append(begin('attempt-1'));
  const second = journal.append(begin('attempt-2'));
  assert.ok(first);
  assert.ok(second);
  const included = journal.pending;
  const third = journal.append(begin('attempt-3'));
  assert.ok(third);

  assert.equal(journal.acknowledge(included), true);

  assert.deepEqual(journal.pending, [third]);
});


test('journal restores explicit Standard product operations', () => {
  const storage = new MemoryStorage();
  const journal = new MetaJournal('player-difficulty', storage);

  assert.ok(journal.append({ kind: 'set-standard-difficulty', difficulty: 'hard' }));
  assert.ok(journal.append({ kind: 'standard-served', seed: '4294967295', partition: 'hard', difficulty: 'hard' }));
  assert.ok(journal.append({ kind: 'standard-failed', attemptId: 'attempt-standard-1' }));

  const restored = new MetaJournal('player-difficulty', storage);
  assert.deepEqual(restored.pending.map(({ operation }) => operation), [
    { kind: 'set-standard-difficulty', difficulty: 'hard' },
    { kind: 'standard-served', seed: '4294967295', partition: 'hard', difficulty: 'hard' },
    { kind: 'standard-failed', attemptId: 'attempt-standard-1' },
  ]);
});

test('journal rejects malformed Standard product operations', () => {
  const invalidOperations = [
    { kind: 'set-standard-difficulty', difficulty: 'nightmare' },
    { kind: 'standard-served', seed: '0', partition: 'easy', difficulty: 'easy' },
    { kind: 'standard-served', seed: '12', partition: 'nightmare', difficulty: 'hard' },
    { kind: 'standard-failed', attemptId: '' },
  ];

  for (const [index, operation] of invalidOperations.entries()) {
    const storage = new MemoryStorage();
    const seeded = new MetaJournal(`invalid-${index}`, storage);
    seeded.append(begin('seed'));
    const [key] = storage.values.keys();
    storage.values.set(key, JSON.stringify({
      version: 1,
      stream: seeded.stream,
      nextSequence: 2,
      pending: [{ stream: seeded.stream, sequence: 1, operation }],
    }));
    assert.deepEqual(new MetaJournal(`invalid-${index}`, storage).pending, []);
  }
});

test('journal restores Daily ranking eligibility and persisted hint usage', () => {
  const storage = new MemoryStorage();
  const journal = new MetaJournal('player-daily-rules', storage);

  assert.ok(journal.append({
    kind: 'begin',
    attemptId: 'daily-attempt-1',
    mode: 'daily',
    dailyId: '2026-09-16',
    weekId: '2026-W38',
    dailyRankingEligible: true,
  }));
  assert.ok(journal.append({ kind: 'daily-hint-used', dailyId: '2026-09-16' }));

  const restored = new MetaJournal('player-daily-rules', storage);
  assert.deepEqual(restored.pending.map(({ operation }) => operation), [
    {
      kind: 'begin',
      attemptId: 'daily-attempt-1',
      mode: 'daily',
      dailyId: '2026-09-16',
      weekId: '2026-W38',
      dailyRankingEligible: true,
    },
    { kind: 'daily-hint-used', dailyId: '2026-09-16' },
  ]);
});
