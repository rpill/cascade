import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');

test('Rules utility opens the game-level How to Play overlay', () => {
  assert.match(shellSource, /onClick:\s*\(\)\s*=>\s*actions\.navigate\('rules'\)/);
  assert.match(sceneSource, /new RulesView\(this\.game\.canvas\.parentElement!/);
  assert.match(sceneSource, /openRulesOverlay\(false\)/);
  assert.match(sceneSource, /this\.rulesView\.show\(\{ onboarding \}\)/);
  assert.match(sceneSource, /this\.rulesView\.hide\(\)/);
  assert.match(sceneSource, /this\.rulesView\.destroy\(\)/);
});

test('Rules no longer becomes a shell destination/page', () => {
  assert.doesNotMatch(sceneSource, /rulesReturnDestination/);
  assert.doesNotMatch(sceneSource, /this\.shellDestination = 'rules'/);
  assert.doesNotMatch(sceneSource, /this\.appShell\.setDestination\('rules'\)/);
  assert.doesNotMatch(sceneSource, /new RulesView\(this\.appShell\.contentHost/);
});
