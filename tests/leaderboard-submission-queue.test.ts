import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardSubmissionQueue } from '../src/leaderboards/LeaderboardSubmissionQueue.ts';

test('submission queue serializes writes at least 1100 ms apart', async () => {
  let now = 0;
  const calls: Array<{ name: string; score: number; at: number }> = [];
  const waits: number[] = [];

  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => {
      calls.push({ name, score, at: now });
    },
    async (ms) => {
      waits.push(ms);
      now += ms;
    },
    () => now,
  );

  await Promise.all([
    queue.enqueue('standardbesttime', 5000),
    queue.enqueue('classicbesttime', 6000),
  ]);

  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.deepEqual(waits, [1100]);
  assert.equal(queue.pendingCount, 0);
});

test('pending writes for one board coalesce to the smallest score', async () => {
  const calls: Array<{ name: string; score: number }> = [];
  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => {
      calls.push({ name, score });
    },
    async () => undefined,
    () => 0,
  );

  const first = queue.enqueue('standardbesttime', 7000);
  const second = queue.enqueue('standardbesttime', 5000);
  const third = queue.enqueue('standardbesttime', 6000);

  await Promise.all([first, second, third]);

  assert.deepEqual(calls, [
    { name: 'standardbesttime', score: 5000 },
  ]);
  assert.equal(queue.pendingCount, 0);
});

test('failed board rejects all coalesced waiters and later boards still drain', async () => {
  let now = 0;
  const calls: Array<{ name: string; score: number; at: number }> = [];
  const failure = new Error('temporary Yandex failure');

  const queue = new LeaderboardSubmissionQueue(
    async (name, score) => {
      calls.push({ name, score, at: now });
      if (name === 'standardbesttime') {
        throw failure;
      }
    },
    async (ms) => {
      now += ms;
    },
    () => now,
  );

  const first = queue.enqueue('standardbesttime', 7000);
  const second = queue.enqueue('standardbesttime', 5000);
  const later = queue.enqueue('classicbesttime', 6000);

  const [firstResult, secondResult, laterResult] = await Promise.allSettled([
    first,
    second,
    later,
  ]);

  assert.equal(firstResult.status, 'rejected');
  assert.equal(secondResult.status, 'rejected');
  assert.equal(laterResult.status, 'fulfilled');
  if (firstResult.status === 'rejected') assert.equal(firstResult.reason, failure);
  if (secondResult.status === 'rejected') assert.equal(secondResult.reason, failure);
  assert.deepEqual(calls.map(({ name, score }) => ({ name, score })), [
    { name: 'standardbesttime', score: 5000 },
    { name: 'classicbesttime', score: 6000 },
  ]);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.equal(queue.pendingCount, 0);
});

test('queue rejects invalid scores without scheduling a submit', async () => {
  let calls = 0;
  const queue = new LeaderboardSubmissionQueue(async () => {
    calls += 1;
  });

  await assert.rejects(queue.enqueue('standardbesttime', Number.NaN), /finite and non-negative/);
  await assert.rejects(queue.enqueue('standardbesttime', -1), /finite and non-negative/);
  assert.equal(calls, 0);
  assert.equal(queue.pendingCount, 0);
});
