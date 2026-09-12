import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveGameplayActivity,
} from '../src/platform/GameplayActivity.ts';

const active = {
  attemptStarted: true,
  attemptFinalized: false,
  flowPlaying: true,
  localInteractionBlocked: false,
  documentVisible: true,
  platformPaused: false,
} as const;

test('active visible gameplay runs timer starts markup and keeps scene live', () => {
  assert.deepEqual(deriveGameplayActivity(active), {
    timerShouldRun: true,
    sceneShouldPause: false,
    markupAction: 'start',
  });
});

test('menu is a local blocker that stops timer and gameplay markup', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    flowPlaying: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('a blocking gameplay modal stops timer and gameplay markup without changing flow state', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    localInteractionBlocked: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('hidden document is a local blocker that stops timer and gameplay markup', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    documentVisible: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('external platform pause freezes timer and scene without issuing a local markup stop', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    platformPaused: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: true,
    markupAction: 'keep',
  });
});

test('menu remains stopped while the platform is also paused', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    flowPlaying: false,
    platformPaused: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: true,
    markupAction: 'stop',
  });
});

test('finalized attempts stay stopped after platform resume', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    attemptFinalized: true,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});

test('an attempt that has not reached the playable boundary is not marked as gameplay', () => {
  assert.deepEqual(deriveGameplayActivity({
    ...active,
    attemptStarted: false,
  }), {
    timerShouldRun: false,
    sceneShouldPause: false,
    markupAction: 'stop',
  });
});
