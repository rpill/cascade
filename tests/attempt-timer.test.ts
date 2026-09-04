import test from 'node:test';
import assert from 'node:assert/strict';

import { AttemptTimer } from '../src/meta/AttemptTimer.ts';

test('timer measures one active attempt', () => {
  const timer = new AttemptTimer();
  timer.start(100);
  assert.equal(timer.finish(1_350), 1_250);
});

test('paused time is excluded', () => {
  const timer = new AttemptTimer();
  timer.start(100);
  timer.pause(600);
  timer.resume(2_600);
  assert.equal(timer.finish(3_100), 1_000);
});

test('pause resume and finish are idempotent around inactive state', () => {
  const timer = new AttemptTimer();
  timer.pause(100);
  timer.resume(200);
  assert.throws(() => timer.finish(300), /not started/i);
});

test('running paused and reset expose the attempt lifecycle', () => {
  const timer = new AttemptTimer();

  assert.equal(timer.running, false);
  assert.equal(timer.paused, false);

  timer.start(10);
  assert.equal(timer.running, true);
  assert.equal(timer.paused, false);

  timer.pause(20);
  assert.equal(timer.running, true);
  assert.equal(timer.paused, true);

  timer.resume(30);
  assert.equal(timer.running, true);
  assert.equal(timer.paused, false);

  timer.reset();
  assert.equal(timer.running, false);
  assert.equal(timer.paused, false);
  assert.equal(timer.elapsed(40), 0);
  assert.throws(() => timer.finish(40), /not started/i);
});

test('restored elapsed duration continues from the saved checkpoint', () => {
  const timer = new AttemptTimer();

  timer.start(1_000, 4_500);
  assert.equal(timer.elapsed(1_250), 4_750);
  timer.pause(1_500);
  assert.equal(timer.elapsed(9_999), 5_000);
  timer.resume(12_000);
  assert.equal(timer.finish(12_500), 5_500);
});

test('elapsed reads do not mutate the timer', () => {
  const timer = new AttemptTimer();
  timer.start(1_000, 500.4);

  assert.equal(timer.elapsed(1_250), 750);
  assert.equal(timer.elapsed(1_250), 750);
  assert.equal(timer.finish(1_500), 1_000);
});

test('timer rejects invalid restored elapsed durations', () => {
  const timer = new AttemptTimer();

  assert.throws(() => timer.start(100, -1), /elapsed/i);
  assert.throws(() => timer.start(100, Number.NaN), /elapsed/i);
  assert.throws(() => timer.start(100, Number.POSITIVE_INFINITY), /elapsed/i);
});

test('timer rejects backwards active timestamps', () => {
  const timer = new AttemptTimer();
  timer.start(1_000, 250);

  assert.throws(() => timer.elapsed(999), /backwards/i);
  assert.throws(() => timer.pause(999), /backwards/i);
  assert.throws(() => timer.finish(999), /backwards/i);
});
