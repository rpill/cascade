import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const overlayUrl = new URL('../src/ui/game/NewDealConfirmOverlay.ts', import.meta.url);

test('in-table New Deal confirmation uses the Trifold Phaser modal instead of the legacy DOM dialog', () => {
  assert.equal(existsSync(overlayUrl), true, 'expected NewDealConfirmOverlay product component');
  const overlay = readFileSync(overlayUrl, 'utf8');
  assert.match(overlay, /ModalShell/);
  assert.match(overlay, /ActionCard/);
  assert.match(scene, /NewDealConfirmOverlay/);
  assert.doesNotMatch(scene, /NewDealConfirmView/);
});
