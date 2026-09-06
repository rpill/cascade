import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);

test('Rules utility enters the shell Rules destination and GameScene owns the page lifecycle', () => {
  assert.match(shellSource, /onClick:\s*\(\)\s*=>\s*actions\.navigate\('rules'\)/);
  assert.match(sceneSource, /new RulesView\(this\.appShell\.contentHost/);
  assert.match(sceneSource, /this\.rulesView\.show\(\)/);
  assert.match(sceneSource, /this\.rulesView\.hide\(\)/);
  assert.match(sceneSource, /this\.rulesView\.destroy\(\)/);
});

test('Rules Back restores the previous shell destination instead of closing into a modal stack', () => {
  assert.match(sceneSource, /rulesReturnDestination/);
  assert.match(sceneSource, /closeRules/);
  assert.match(sceneSource, /statistics/);
  assert.match(sceneSource, /play/);
  assert.doesNotMatch(sceneSource, /RulesView[\s\S]{0,240}meta-modal/);
});
