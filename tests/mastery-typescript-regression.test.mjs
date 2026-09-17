import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');

test('MasteryScene layout helper does not keep an unused viewport parameter', () => {
  assert.doesNotMatch(source, /layoutMasterySections\(\s*viewport:\s*ResolvedUiViewport,/u);
  assert.doesNotMatch(source, /layoutMasterySections\(viewport,\s*bounds,/u);
});

test('MasteryScene path chrome has no decorative diamonds', () => {
  assert.match(source, /const\s+pathBackdrop\s*=\s*this\.pathBackdrop;/u);
  assert.match(source, /drawPathConnectors/u);
  assert.doesNotMatch(source, /drawDiamond/u);
});
