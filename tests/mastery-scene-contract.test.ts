import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('MasteryScene uses semantic Cascade rank artwork and returns to Home', () => {
  assert.equal(existsSync('src/ui/scenes/MasteryScene.ts'), true);
  const source = readFileSync('src/ui/scenes/MasteryScene.ts', 'utf8');
  assert.match(source, /buildMasteryViewModel/);
  assert.match(source, /CASCADE_UI_ART_KEYS\.rank/);
  assert.match(source, /ProgressMeter/);
  assert.match(source, /scene\.start\('HomeScene'\)/);
});
