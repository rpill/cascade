import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function method(name: string): string {
  const starts = [`private ${name}`, `private async ${name}`];
  const start = starts.map((needle) => source.indexOf(needle)).find((index) => index !== -1) ?? -1;
  assert.notEqual(start, -1, `missing ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('authorization stages the guest profile before opening Yandex auth and reloads profile after success', () => {
  const authorize = method('authorizeLeaderboard');
  const stage = authorize.indexOf('stageProfileMergeTransfer');
  const request = authorize.indexOf('service.requestAuthorization()');
  const reload = authorize.indexOf('await this.loadMetaProfile()');
  assert.ok(stage !== -1 && request !== -1 && stage < request, 'guest snapshot must be durable before auth can switch Player');
  assert.ok(reload > request, 'successful auth must bind/load the authorized profile before leaderboard sync');
  assert.match(authorize, /clearProfileMergeTransfer/);
});

test('profile load applies a staged guest transfer only after the target account profile loads', () => {
  const load = method('loadMetaProfile');
  const sessionLoad = load.indexOf('await this.metaSession.load()');
  const merge = load.indexOf('applyPendingProfileMerge');
  assert.ok(sessionLoad !== -1 && merge > sessionLoad, 'cloud target must load before merge');
});

test('authorization waits for durable meta and no save in flight', () => {
  const canAuthorize = method('canAuthorizeLeaderboard');
  assert.match(canAuthorize, /!this\.metaSession\.saving/);
});

test('authorization remains available while an unfinished game is paused in the menu', () => {
  const canAuthorize = method('canAuthorizeLeaderboard');
  assert.doesNotMatch(canAuthorize, /gameState\s*===\s*null|gameState\.isWon/);
});

test('authorization checkpoints an unfinished game before Yandex can switch Player', () => {
  const authorize = method('authorizeLeaderboard');
  const checkpoint = authorize.indexOf('this.checkpointActiveGame(this.gameState)');
  const stage = authorize.indexOf('stageProfileMergeTransfer');
  assert.ok(checkpoint !== -1 && stage !== -1 && checkpoint < stage,
    'active game must be durable before auth/profile scope changes');
});

test('profile scope change preserves the current board only for the staged guest-to-account merge', () => {
  const load = method('loadMetaProfile');
  assert.match(load, /shouldPreserveActiveGameForProfileMerge/);
  assert.match(load, /if \(!preserveActiveGame\) \{/);
});
