import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boardSource = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('autocomplete continuously launches available suits without restarting active flights', () => {
  assert.match(boardSource, /readonly autoFoundationStep: \(excludedSuits: ReadonlySet<Suit>\) => Card \| null;/);
  assert.match(boardSource, /autoFoundationFlightsBySuit = new Map<Suit, string>\(\)/);
  assert.match(boardSource, /new Set\(this\.autoFoundationFlightsBySuit\.keys\(\)\)/);
  assert.match(boardSource, /const movedCard = this\.actions\.autoFoundationStep\(busySuits\);/);
  assert.match(boardSource, /new Set\(this\.autoFoundationFlightsBySuit\.values\(\)\)/);
  assert.match(boardSource, /this\.sync\('foundation', activeFlightIds, new Map\(\), landingSounds\);/);
  assert.match(boardSource, /this\.scheduleAutoFoundationStep\(getFoundationStreamInterval\(\)\);/);
  assert.doesNotMatch(boardSource, /getFoundationWaveStepDelay/);
  assert.match(sceneSource, /autoFoundationStep: \(excludedSuits\) => gameState\.autoMoveToFoundation\(excludedSuits\)/);
});
