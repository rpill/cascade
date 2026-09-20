import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync('src/game/scenes/GameScene.ts','utf8');

test('GameScene builds cloud sync only behind backend identity and configured backend URL',()=>{
  assert.match(scene,/platform\?\.backendIdentity/);
  assert.match(scene,/resolveBackendUrl\(\)/);
  assert.match(scene,/new CloudSyncCoordinator\(/);
});

test('authorization keeps Yandex scope-transfer path but Pikabu uses cloud authorization merge',()=>{
  assert.match(scene,/authorizationUsesProfileScopeTransfer/);
  assert.match(scene,/usesScopeTransfer[\s\S]{0,300}stageProfileMergeTransfer/);
  assert.match(scene,/cloudSync\?\.sync\('authorization'\)/);
});

test('cloud sync has non-blocking online completion and home triggers with teardown',()=>{
  assert.match(scene,/window\.addEventListener\('online',[\s\S]{0,80}handleCloudOnline/);
  assert.match(scene,/cloudSync\?\.sync\('game-complete'\)/);
  assert.match(scene,/cloudSync\?\.sync\('home'\)/);
  assert.match(scene,/window\.removeEventListener\('online',[\s\S]{0,80}handleCloudOnline/);
});

test('Daily official submit carries frozen completion metadata',()=>{
  assert.match(scene,/completedOnTime:\s*dailyRecord\?\.completedOnTime === true/);
  assert.match(scene,/attemptId:\s*dailyRecord\?\.rankingAttemptId/);
});
