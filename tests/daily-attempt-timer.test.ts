import test from 'node:test';
import assert from 'node:assert/strict';

import { DailyAttemptTimer } from '../src/meta/DailyAttemptTimer.ts';

test('timer measures one active attempt', () => {
  const timer = new DailyAttemptTimer();
  timer.start(100);
  assert.equal(timer.finish(1_350), 1_250);
});

test('paused time is excluded', () => {
  const timer = new DailyAttemptTimer();
  timer.start(100);
  timer.pause(600);
  timer.resume(2_600);
  assert.equal(timer.finish(3_100), 1_000);
});

test('pause resume and finish are idempotent around inactive state', () => {
  const timer = new DailyAttemptTimer();
  timer.pause(100);
  timer.resume(200);
  assert.throws(() => timer.finish(300), /not started/i);
});

test('running and reset expose the attempt lifecycle', () => {
  const timer = new DailyAttemptTimer();

  assert.equal(timer.running, false);
  timer.start(10);
  assert.equal(timer.running, true);
  timer.reset();
  assert.equal(timer.running, false);
  assert.throws(() => timer.finish(20), /not started/i);
});
