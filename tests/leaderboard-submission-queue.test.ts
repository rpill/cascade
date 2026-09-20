import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardSubmissionQueue } from '../src/leaderboards/LeaderboardSubmissionQueue.ts';

test('submission queue serializes writes at least 1100 ms apart', async () => {
  let now = 0;
  const calls: Array<{ name: string; score: number; at: number }> = [];
  const waits: number[] = [];
  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => { calls.push({ name, score, at: now }); },
    async (ms) => { waits.push(ms); now += ms; },
    () => now,
  );

  await Promise.all([
    queue.enqueue('standardwinstreak', 5),
    queue.enqueue('dailyfastest', 20_000_000_000),
  ]);

  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.deepEqual(waits, [1100]);
  assert.equal(queue.pendingCount, 0);
});

test('pending writes for one descending board coalesce to the largest score', async () => {
  const calls: Array<{ name: string; score: number }> = [];
  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => { calls.push({ name, score }); },
    async () => undefined,
    () => 0,
  );

  const first = queue.enqueue('standardwinstreak', 7);
  const second = queue.enqueue('standardwinstreak', 9);
  const third = queue.enqueue('standardwinstreak', 8);
  await Promise.all([first, second, third]);

  assert.deepEqual(calls, [{ name: 'standardwinstreak', score: 9 }]);
  assert.equal(queue.pendingCount, 0);
});

test('failed board rejects coalesced waiters and later boards still drain', async () => {
  let now = 0;
  const calls: Array<{ name: string; score: number; at: number }> = [];
  const failure = new Error('temporary Yandex failure');
  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => {
      calls.push({ name, score, at: now });
      if (name === 'standardwinstreak') throw failure;
    },
    async (ms) => { now += ms; },
    () => now,
  );

  const first = queue.enqueue('standardwinstreak', 7);
  const second = queue.enqueue('standardwinstreak', 9);
  const later = queue.enqueue('dailyfastest', 20_000_000_000);
  const [a, b, c] = await Promise.allSettled([first, second, later]);

  assert.equal(a.status, 'rejected');
  assert.equal(b.status, 'rejected');
  assert.equal(c.status, 'fulfilled');
  assert.deepEqual(calls.map(({ name, score }) => ({ name, score })), [
    { name: 'standardwinstreak', score: 9 },
    { name: 'dailyfastest', score: 20_000_000_000 },
  ]);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.equal(queue.pendingCount, 0);
});

test('queue rejects invalid scores without scheduling a submit', async () => {
  let calls = 0;
  const queue = new LeaderboardSubmissionQueue(async () => { calls += 1; });
  await assert.rejects(queue.enqueue('standardwinstreak', Number.NaN), /finite and positive/);
  await assert.rejects(queue.enqueue('standardwinstreak', 0), /finite and positive/);
  await assert.rejects(queue.enqueue('standardwinstreak', -1), /finite and positive/);
  assert.equal(calls, 0);
  assert.equal(queue.pendingCount, 0);
});

test('latest coalescing keeps a downward streak update instead of max score', async () => {
  const calls: Array<{name:string;score:number}> = [];
  let now = 0;
  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => { calls.push({name,score}); },
    async (ms) => { now += ms; },
    () => now,
    0,
  );
  const first = queue.enqueue('dailystreak', 900015, undefined, 'latest');
  const second = queue.enqueue('dailystreak', 15, undefined, 'latest');
  await Promise.all([first, second]);
  assert.deepEqual(calls, [{ name: 'dailystreak', score: 15 }]);
});


test('coalesced write keeps context that corresponds to the retained score', async () => {
  const calls: Array<{ name: string; score: number; context: unknown }> = [];
  const queue = new LeaderboardSubmissionQueue(
    async (name, score, context) => { calls.push({ name, score, context }); },
    async () => undefined,
    () => 0,
    0,
  );
  const a = queue.enqueue('standardwinstreak', 7, { kind: 'standard', bestStreak: 7 }, 'max');
  const b = queue.enqueue('standardwinstreak', 9, { kind: 'standard', bestStreak: 9 }, 'max');
  const c = queue.enqueue('standardwinstreak', 8, { kind: 'standard', bestStreak: 8 }, 'max');
  await Promise.all([a, b, c]);
  assert.deepEqual(calls, [{ name: 'standardwinstreak', score: 9, context: { kind: 'standard', bestStreak: 9 } }]);

  const d = queue.enqueue('dailystreak', 10, { kind: 'streak', todayId: '2026-09-19' }, 'latest');
  const e = queue.enqueue('dailystreak', 5, { kind: 'streak', todayId: '2026-09-20' }, 'latest');
  await Promise.all([d, e]);
  assert.deepEqual(calls[1], { name: 'dailystreak', score: 5, context: { kind: 'streak', todayId: '2026-09-20' } });
});
