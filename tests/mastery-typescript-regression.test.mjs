import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');

test('MasteryScene layout helper does not keep an unused viewport parameter', () => {
  assert.doesNotMatch(source, /layoutMasterySections\(\s*viewport:\s*ResolvedUiViewport,/u);
  assert.doesNotMatch(source, /layoutMasterySections\(viewport,\s*bounds,/u);
});

test('MasteryScene only draws path diamonds when the path backdrop exists', () => {
  assert.match(source, /const\s+pathBackdrop\s*=\s*this\.pathBackdrop;[\s\S]*?if\s*\(pathBackdrop\)\s*\{[\s\S]*?drawDiamond\(pathBackdrop,/u);
});
