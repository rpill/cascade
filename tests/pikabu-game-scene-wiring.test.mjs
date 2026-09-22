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

test('Pikabu adapter creates one shared bridge session and reuses it for leaderboards',()=>{
  const pikabu = readFileSync('src/platform/pikabu.ts','utf8');
  const creations = pikabu.match(/new BridgeSessionManager\(/g) ?? [];
  assert.equal(creations.length, 1);
  assert.match(pikabu,/identity:\s*backendIdentity/);
  assert.doesNotMatch(pikabu,/provisioning|backendProvisioning/);
  assert.match(pikabu,/new BackendClient\(backendUrl,\s*backendSession\)/);
  assert.match(pikabu,/backendSession,/);
});

test('GameScene reuses platform backendSession for cloud profile sync',()=>{
  assert.match(scene,/platform\?\.backendSession/);
  assert.match(scene,/new BackendClient\(backendUrl,\s*session\)/);
  assert.doesNotMatch(scene,/new BridgeSessionManager\(/);
});


test('Pikabu remains the only product/auth platform with no provisioning SDK',()=>{
  const pikabu = readFileSync('src/platform/pikabu.ts','utf8');
  assert.match(pikabu,/sdk\.auth\.openAuthDialog/);
  assert.match(pikabu,/sdk\.player\.getSignedData/);
  assert.match(pikabu,/sdk\.gameStarted/);
  assert.match(pikabu,/sdk\.ads\.fullscreen/);
  assert.match(pikabu,/rewarded/);
  assert.doesNotMatch(pikabu,/GamePush|game-score|onGPInit|backendProvisioning|gp\.player|gp\.leaderboard|gp\.ads/);
});
